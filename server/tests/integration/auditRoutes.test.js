import { describe, it, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import mongoose from 'mongoose';
import request from 'supertest';

process.env.NODE_ENV = 'test';
process.env.MONGODB_URI ??= 'mongodb://127.0.0.1:27017/seocheck_test';
process.env.CLIENT_ORIGIN ??= 'http://localhost:5173';
process.env.ADMIN_API_KEY = 'test-admin-key-0123456789abcdef';

const ADMIN_KEY = process.env.ADMIN_API_KEY;
const FORBIDDEN_FIELDS = ['_id', 'url', 'finalUrl', 'pageTitle', 'ownerId', 'analyzedAt'];

// Recursively collects every object key so tests can prove no per-audit field leaks.
const collectKeys = (value, keys = new Set()) => {
  if (Array.isArray(value)) {
    value.forEach((item) => collectKeys(item, keys));
  } else if (value && typeof value === 'object') {
    for (const [key, nested] of Object.entries(value)) {
      keys.add(key);
      collectKeys(nested, keys);
    }
  }
  return keys;
};

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const VALID_FIXTURE_PATH = path.join(__dirname, '..', 'fixtures', 'valid-page.html');

let app;
let safeFetch;
let escapeRegex;
let setAuditServiceDependencies;
let resetAuditServiceDependencies;
let validHtml;

// In-memory repository implementing the exact Audit persistence contract so
// `npm test` runs deterministically offline without requiring a live MongoDB daemon.
const createInMemoryRepository = () => {
  const store = new Map();

  const matchesFilter = (doc, filter) => {
    if (filter.ownerId && doc.ownerId !== filter.ownerId) return false;
    if (Array.isArray(filter.$or)) {
      return filter.$or.some((clause) => {
        const [field, regex] = Object.entries(clause)[0];
        return typeof doc[field] === 'string' && regex.test(doc[field]);
      });
    }
    return true;
  };

  return {
    store,
    clear() {
      store.clear();
    },
    async create(payload) {
      const _id = new mongoose.Types.ObjectId().toString();
      const now = new Date().toISOString();
      const doc = {
        _id,
        ...payload,
        analyzedAt: payload.analyzedAt instanceof Date ? payload.analyzedAt.toISOString() : now,
        createdAt: now,
        updatedAt: now,
      };
      store.set(_id, doc);
      return doc;
    },
    async findPaginated({ filter, skip, limit }) {
      const allMatching = [...store.values()]
        .filter((doc) => matchesFilter(doc, filter))
        .sort((a, b) => new Date(b.analyzedAt) - new Date(a.analyzedAt));

      return {
        items: allMatching.slice(skip, skip + limit),
        total: allMatching.length,
      };
    },
    async findByIdAndOwner({ id, ownerId }) {
      const doc = store.get(String(id));
      if (!doc || doc.ownerId !== ownerId) return null;
      return doc;
    },
    async deleteByIdAndOwner({ id, ownerId }) {
      const doc = store.get(String(id));
      if (!doc || doc.ownerId !== ownerId) return null;
      store.delete(String(id));
      return doc;
    },
    async aggregateGlobalStats() {
      const completed = [...store.values()].filter((doc) => doc.status === 'completed');
      if (completed.length === 0) return null;

      const sum = (pick) => completed.reduce((total, doc) => total + (pick(doc) ?? 0), 0);
      return {
        totalAudits: completed.length,
        averageScore: sum((doc) => doc.overallScore) / completed.length,
        averageCoverage: sum((doc) => doc.scoreCoverage) / completed.length,
        passed: sum((doc) => doc.summary?.passed),
        warning: sum((doc) => doc.summary?.warning),
        failed: sum((doc) => doc.summary?.failed),
        notTested: sum((doc) => doc.summary?.notTested),
      };
    },
  };
};

const inMemoryRepo = createInMemoryRepository();

const mockFetcher = async (url, options = {}) => {
  // Delegate SSRF / invalid URL checks to the real safeFetch validator!
  if (url.includes('127.0.0.1') || url.includes('169.254.169.254') || url.includes('localhost')) {
    return safeFetch(url, options);
  }

  if (url.endsWith('/robots.txt')) {
    return {
      url,
      finalUrl: url,
      status: 200,
      contentType: 'text/plain',
      body: 'User-agent: *\nAllow: /\nSitemap: https://example.com/sitemap.xml\n',
      redirectChain: [],
    };
  }

  if (url.endsWith('/sitemap.xml')) {
    return {
      url,
      finalUrl: url,
      status: 200,
      contentType: 'application/xml',
      body: '<?xml version="1.0" encoding="UTF-8"?><urlset><url><loc>https://example.com/</loc></url></urlset>',
      redirectChain: [],
    };
  }

  return {
    url,
    finalUrl: url,
    status: 200,
    contentType: 'text/html; charset=utf-8',
    body: validHtml,
    redirectChain: [],
  };
};

before(async () => {
  validHtml = await fs.readFile(VALID_FIXTURE_PATH, 'utf8');
  ({ default: app } = await import('../../app.js'));
  ({ default: safeFetch } = await import('../../services/fetch/safeFetch.js'));
  ({
    escapeRegex,
    setAuditServiceDependencies,
    resetAuditServiceDependencies,
  } = await import('../../services/auditService.js'));

  setAuditServiceDependencies({
    repository: inMemoryRepo,
    fetcher: mockFetcher,
  });
});

beforeEach(() => {
  inMemoryRepo.clear();
});

after(() => {
  resetAuditServiceDependencies();
});

describe('Audit REST API (/api/audits)', () => {
  it('rejects missing or invalid URL in POST /api/audits/analyze with 400 VALIDATION_ERROR', async () => {
    const emptyRes = await request(app).post('/api/audits/analyze').send({}).expect(400);
    assert.equal(emptyRes.body.success, false);
    assert.equal(emptyRes.body.error.code, 'VALIDATION_ERROR');

    const badTypeRes = await request(app).post('/api/audits/analyze').send({ url: 12345 }).expect(400);
    assert.equal(badTypeRes.body.error.code, 'VALIDATION_ERROR');
  });

  it('rejects SSRF blocked URLs in POST /api/audits/analyze with 400 BLOCKED_URL and does NOT save to DB', async () => {
    const res = await request(app)
      .post('/api/audits/analyze')
      .send({ url: 'http://169.254.169.254/latest/meta-data/' })
      .expect(400);

    assert.equal(res.body.success, false);
    assert.equal(res.body.error.code, 'BLOCKED_URL');
    assert.equal(inMemoryRepo.store.size, 0, 'Failed fetches must never be stored');
  });

  it('rejects malformed ObjectIds on GET and DELETE /api/audits/:id with 400 VALIDATION_ERROR', async () => {
    const getRes = await request(app).get('/api/audits/not-a-valid-objectid').expect(400);
    assert.equal(getRes.body.error.code, 'VALIDATION_ERROR');

    const delRes = await request(app).delete('/api/audits/123').set('X-Admin-Key', ADMIN_KEY).expect(400);
    assert.equal(delRes.body.error.code, 'VALIDATION_ERROR');
  });

  it('rejects invalid pagination query params on GET /api/audits with 400 VALIDATION_ERROR', async () => {
    const badPage = await request(app).get('/api/audits?page=0').set('X-Admin-Key', ADMIN_KEY).expect(400);
    assert.equal(badPage.body.error.code, 'VALIDATION_ERROR');

    const badLimit = await request(app).get('/api/audits?limit=-5').set('X-Admin-Key', ADMIN_KEY).expect(400);
    assert.equal(badLimit.body.error.code, 'VALIDATION_ERROR');
  });

  it('completes full CRUD lifecycle (POST 201 -> GET list 200 -> GET by id 200 -> DELETE 204 -> GET 404) with X-Client-Id isolation', async () => {
    const clientA = 'browser-client-aaa111';
    const clientB = 'browser-client-bbb222';

    // 1. Analyze and save (201)
    const createRes = await request(app)
      .post('/api/audits/analyze')
      .set('X-Client-Id', clientA)
      .send({ url: 'https://example.com/guides/on-page-seo' })
      .expect(201);

    assert.equal(createRes.body.success, true);
    const createdAudit = createRes.body.data;
    assert.ok(createdAudit._id);
    assert.equal(createdAudit.url, 'https://example.com/guides/on-page-seo');
    assert.equal(createdAudit.overallScore, 100);
    assert.equal(createdAudit.scoreCoverage, 100);
    assert.equal(createdAudit.seoChecks.length, 18);
    assert.equal(createdAudit.body, undefined, 'Raw HTML must never be stored');
    assert.equal(createdAudit.html, undefined, 'Raw HTML must never be stored');

    // 2. List audits for Client A with regex-special search query (200)
    const specialSearch = 'example.com/guides/on-page-seo';
    assert.equal(escapeRegex('a+b*c?^$()[]{}|\\'), 'a\\+b\\*c\\?\\^\\$\\(\\)\\[\\]\\{\\}\\|\\\\');

    const listResA = await request(app)
      .get(`/api/audits?page=1&limit=10&search=${encodeURIComponent('example.com (unmatched)[test]')}`)
      .set('X-Client-Id', clientA)
      .set('X-Admin-Key', ADMIN_KEY)
      .expect(200);
    assert.equal(listResA.body.data.length, 0);

    const matchingListRes = await request(app)
      .get(`/api/audits?page=1&limit=100&search=${encodeURIComponent(specialSearch)}`)
      .set('X-Client-Id', clientA)
      .set('X-Admin-Key', ADMIN_KEY)
      .expect(200);

    assert.equal(matchingListRes.body.success, true);
    assert.equal(matchingListRes.body.data.length, 1);
    assert.deepEqual(matchingListRes.body.meta, {
      page: 1,
      limit: 50, // capped at 50
      total: 1,
      totalPages: 1,
    });

    // 3. Client B cannot see or fetch Client A's audit (ADR-015 Option B isolation)
    const listResB = await request(app)
      .get('/api/audits')
      .set('X-Client-Id', clientB)
      .set('X-Admin-Key', ADMIN_KEY)
      .expect(200);
    assert.equal(listResB.body.data.length, 0);

    await request(app)
      .get(`/api/audits/${createdAudit._id}`)
      .set('X-Client-Id', clientB)
      .expect(404);

    // 4. Get full audit by ID for Client A (200)
    const getRes = await request(app)
      .get(`/api/audits/${createdAudit._id}`)
      .set('X-Client-Id', clientA)
      .expect(200);

    assert.equal(getRes.body.success, true);
    assert.equal(getRes.body.data._id, createdAudit._id);
    assert.equal(getRes.body.data.pageTitle, 'Complete Guide to On-Page Technical SEO Audits');

    // 5. Delete audit by ID for Client A (204)
    const deleteRes = await request(app)
      .delete(`/api/audits/${createdAudit._id}`)
      .set('X-Client-Id', clientA)
      .set('X-Admin-Key', ADMIN_KEY)
      .expect(204);
    assert.equal(deleteRes.text, '');

    // 6. Confirm subsequent GET returns 404 NOT_FOUND
    const notFoundRes = await request(app)
      .get(`/api/audits/${createdAudit._id}`)
      .set('X-Client-Id', clientA)
      .expect(404);
    assert.equal(notFoundRes.body.error.code, 'NOT_FOUND');
  });
});

describe('Global audit stats (GET /api/audits/stats)', () => {
  it('returns 200 with zero-safe defaults when no audits exist', async () => {
    const res = await request(app).get('/api/audits/stats').expect(200);

    assert.deepEqual(res.body, {
      success: true,
      data: {
        totalAudits: 0,
        averageScore: null,
        averageCoverage: null,
        totals: { passed: 0, warning: 0, failed: 0, notTested: 0 },
      },
    });
  });

  it('aggregates across ALL owners and never exposes URLs, titles, ids, owners, or timestamps', async () => {
    await request(app)
      .post('/api/audits/analyze')
      .set('X-Client-Id', 'stats-client-one')
      .send({ url: 'https://example.com/private-page-one' })
      .expect(201);
    await request(app)
      .post('/api/audits/analyze')
      .set('X-Client-Id', 'stats-client-two')
      .send({ url: 'https://example.com/private-page-two' })
      .expect(201);

    // Seed a lower-scoring audit directly so averages are meaningfully computed.
    await inMemoryRepo.create({
      ownerId: 'stats-client-three',
      url: 'https://secret.example.org/',
      finalUrl: 'https://secret.example.org/',
      pageTitle: 'Secret Page Title',
      status: 'completed',
      overallScore: 49,
      scoreCoverage: 89,
      summary: { passed: 6, warning: 4, failed: 6, notTested: 2 },
    });

    const res = await request(app).get('/api/audits/stats').set('X-Client-Id', 'unrelated-visitor').expect(200);

    assert.equal(res.body.success, true);
    assert.deepEqual(res.body.data, {
      totalAudits: 3,
      averageScore: 83, // (100 + 100 + 49) / 3 = 83
      averageCoverage: 96, // (100 + 100 + 89) / 3 = 96.33
      totals: { passed: 42, warning: 4, failed: 6, notTested: 2 },
    });

    const keys = collectKeys(res.body);
    for (const field of FORBIDDEN_FIELDS) {
      assert.ok(!keys.has(field), `Stats response must not include "${field}"`);
    }
    assert.doesNotMatch(res.text, /example\.(com|org)|Secret Page Title|stats-client/);
  });
});

describe('Admin-only history endpoints (X-Admin-Key)', () => {
  const assertForbidden = (res) => {
    assert.equal(res.body.success, false);
    assert.equal(res.body.error.code, 'FORBIDDEN');
    assert.equal(res.body.error.message, 'Access to audit history is restricted.');
    assert.doesNotMatch(res.text, new RegExp(ADMIN_KEY));
  };

  it('returns 403 FORBIDDEN on GET /api/audits when X-Admin-Key is missing, empty, or wrong, and 200 when valid', async () => {
    assertForbidden(await request(app).get('/api/audits').expect(403));
    assertForbidden(await request(app).get('/api/audits').set('X-Admin-Key', '').expect(403));
    assertForbidden(await request(app).get('/api/audits').set('X-Admin-Key', 'wrong-key').expect(403));
    assertForbidden(
      await request(app).get('/api/audits').set('X-Admin-Key', `${ADMIN_KEY}x`).expect(403),
    );

    const ok = await request(app).get('/api/audits').set('X-Admin-Key', ADMIN_KEY).expect(200);
    assert.equal(ok.body.success, true);
    assert.ok(Array.isArray(ok.body.data));
  });

  it('returns 403 FORBIDDEN on DELETE /api/audits/:id without a valid key, keeps the audit, and deletes with a valid key', async () => {
    const clientId = 'delete-guard-client';
    const createRes = await request(app)
      .post('/api/audits/analyze')
      .set('X-Client-Id', clientId)
      .send({ url: 'https://example.com/delete-guard' })
      .expect(201);
    const auditId = createRes.body.data._id;

    assertForbidden(
      await request(app).delete(`/api/audits/${auditId}`).set('X-Client-Id', clientId).expect(403),
    );
    assertForbidden(
      await request(app)
        .delete(`/api/audits/${auditId}`)
        .set('X-Client-Id', clientId)
        .set('X-Admin-Key', 'wrong-key')
        .expect(403),
    );
    assert.ok(inMemoryRepo.store.has(auditId), 'Forbidden deletes must not remove the audit');

    // The owner can still open their own report immediately after analysis.
    await request(app).get(`/api/audits/${auditId}`).set('X-Client-Id', clientId).expect(200);

    await request(app)
      .delete(`/api/audits/${auditId}`)
      .set('X-Client-Id', clientId)
      .set('X-Admin-Key', ADMIN_KEY)
      .expect(204);
    assert.ok(!inMemoryRepo.store.has(auditId));
  });

  it('locks the endpoints for everyone when no ADMIN_API_KEY is configured', async () => {
    const { createRequireAdminKey } = await import('../../middleware/requireAdminKey.js');
    const locked = createRequireAdminKey('');

    for (const headerValue of [undefined, '', 'anything']) {
      const req = { get: () => headerValue };
      const err = await new Promise((resolve) => locked(req, {}, resolve));
      assert.equal(err?.code, 'FORBIDDEN');
      assert.equal(err?.statusCode, 403);
    }
  });
});
