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

    const delRes = await request(app).delete('/api/audits/123').expect(400);
    assert.equal(delRes.body.error.code, 'VALIDATION_ERROR');
  });

  it('rejects invalid pagination query params on GET /api/audits with 400 VALIDATION_ERROR', async () => {
    const badPage = await request(app).get('/api/audits?page=0').expect(400);
    assert.equal(badPage.body.error.code, 'VALIDATION_ERROR');

    const badLimit = await request(app).get('/api/audits?limit=-5').expect(400);
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
      .expect(200);
    assert.equal(listResA.body.data.length, 0);

    const matchingListRes = await request(app)
      .get(`/api/audits?page=1&limit=100&search=${encodeURIComponent(specialSearch)}`)
      .set('X-Client-Id', clientA)
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
    const listResB = await request(app).get('/api/audits').set('X-Client-Id', clientB).expect(200);
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
