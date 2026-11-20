import { describe, it, before } from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import request from 'supertest';

process.env.NODE_ENV = 'test';
process.env.MONGODB_URI ??= 'mongodb://127.0.0.1:27017/seocheck_test';
process.env.CLIENT_ORIGIN ??= 'http://localhost:5173';

let app;
let errorHandler;
let AppError;

before(async () => {
  ({ default: app } = await import('../../app.js'));
  ({ default: errorHandler } = await import('../../middleware/errorHandler.js'));
  ({ default: AppError } = await import('../../utils/AppError.js'));
});

const assertNoLeak = (body) => {
  const text = JSON.stringify(body);
  assert.ok(!/stack|at .+\.js|mongodb:\/\//i.test(text), `response leaked internals: ${text}`);
};

describe('JSON body handling', () => {
  it('rejects bodies over 10kb with 413 in the standard envelope', async () => {
    const payload = { data: 'x'.repeat(11 * 1024) };
    const res = await request(app).post('/api/health').send(payload).expect(413);

    assert.equal(res.body.success, false);
    assert.equal(res.body.error.code, 'VALIDATION_ERROR');
    assertNoLeak(res.body);
  });

  it('rejects malformed JSON with 400 VALIDATION_ERROR', async () => {
    const res = await request(app)
      .post('/api/health')
      .set('Content-Type', 'application/json')
      .send('{"url": ')
      .expect(400);

    assert.equal(res.body.error.code, 'VALIDATION_ERROR');
    assertNoLeak(res.body);
  });
});

describe('errorHandler', () => {
  const buildApp = (handler) => express().get('/boom', handler).use(errorHandler);

  it('maps unexpected errors to 500 INTERNAL_ERROR without leaking details', async () => {
    const appWithBug = buildApp(async () => {
      throw new Error('MongoServerError at mongodb://admin:secret@10.0.0.5/db');
    });

    const res = await request(appWithBug).get('/boom').expect(500);

    assert.deepEqual(res.body, {
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Something went wrong. Please try again later.' },
    });
    assertNoLeak(res.body);
  });

  it('passes AppError code, status and message through', async () => {
    const res = await request(buildApp(() => {
      throw new AppError('BLOCKED_URL');
    }))
      .get('/boom')
      .expect(400);

    assert.deepEqual(res.body.error, { code: 'BLOCKED_URL', message: 'This address cannot be analyzed.' });
  });

  it('treats unknown AppError codes as INTERNAL_ERROR', async () => {
    const res = await request(buildApp(() => {
      throw new AppError('NOT_A_REAL_CODE', 'internal detail');
    }))
      .get('/boom')
      .expect(500);

    assert.equal(res.body.error.code, 'INTERNAL_ERROR');
    assert.equal(res.body.error.message, 'Something went wrong. Please try again later.');
  });
});

