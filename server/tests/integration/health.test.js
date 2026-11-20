import { describe, it, before } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';

// Env must be set before app.js (and config/env.js) is imported.
// No real database is contacted: health must still answer and report "disconnected".
process.env.NODE_ENV = 'test';
process.env.MONGODB_URI ??= 'mongodb://127.0.0.1:27017/seocheck_test';
process.env.CLIENT_ORIGIN ??= 'http://localhost:5173';

let app;

before(async () => {
  ({ default: app } = await import('../../app.js'));
});

describe('GET /api/health', () => {
  it('returns 200 with the standard success envelope and DB status', async () => {
    const res = await request(app).get('/api/health').expect('Content-Type', /json/).expect(200);

    assert.equal(res.body.success, true);
    assert.equal(res.body.data.status, 'ok');
    assert.ok(['connected', 'disconnected'].includes(res.body.data.db));
    assert.ok(!Number.isNaN(Date.parse(res.body.data.timestamp)), 'timestamp is an ISO date');
  });

  it('sends security headers and allows only the configured CORS origin', async () => {
    const res = await request(app).get('/api/health').set('Origin', 'http://localhost:5173').expect(200);

    assert.equal(res.headers['access-control-allow-origin'], 'http://localhost:5173');
    assert.equal(res.headers['x-content-type-options'], 'nosniff');
    assert.equal(res.headers['x-powered-by'], undefined);
  });
});

describe('Unknown routes', () => {
  it('returns 404 NOT_FOUND in the standard error envelope', async () => {
    const res = await request(app).get('/api/does-not-exist').expect('Content-Type', /json/).expect(404);

    assert.deepEqual(res.body, {
      success: false,
      error: { code: 'NOT_FOUND', message: 'The requested resource was not found.' },
    });
  });
});

