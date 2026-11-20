import { describe, it, before } from 'node:test';
import assert from 'node:assert/strict';

process.env.NODE_ENV = 'test';
process.env.MONGODB_URI ??= 'mongodb://127.0.0.1:27017/seocheck_test';

let validateEnv;

before(async () => {
  ({ validateEnv } = await import('../../config/env.js'));
});

const VALID_URI = 'mongodb+srv://user:pass@cluster.example.net/seocheck';

describe('validateEnv', () => {
  it('applies the master-plan defaults when optional values are missing', () => {
    const { env, errors } = validateEnv({ MONGODB_URI: VALID_URI });

    assert.deepEqual(errors, []);
    assert.equal(env.NODE_ENV, 'development');
    assert.equal(env.PORT, 5000);
    assert.equal(env.CLIENT_ORIGIN, 'http://localhost:5173');
    assert.equal(env.FETCH_TIMEOUT_MS, 10000);
    assert.equal(env.FETCH_MAX_BYTES, 2097152);
    assert.equal(env.FETCH_MAX_REDIRECTS, 5);
    assert.equal(env.RATE_LIMIT_ANALYZE_PER_15MIN, 10);
    assert.equal(env.RATE_LIMIT_GLOBAL_PER_15MIN, 200);
  });

  it('fails when MONGODB_URI is missing', () => {
    const { errors } = validateEnv({});
    assert.ok(errors.includes('MONGODB_URI is required'));
  });

  it('rejects invalid numbers, NODE_ENV and CLIENT_ORIGIN', () => {
    const { errors } = validateEnv({
      MONGODB_URI: VALID_URI,
      NODE_ENV: 'staging',
      PORT: 'abc',
      FETCH_MAX_REDIRECTS: '-1',
      CLIENT_ORIGIN: 'not a url',
    });

    assert.equal(errors.length, 4);
  });

  it('normalises CLIENT_ORIGIN to an exact origin', () => {
    const { env } = validateEnv({ MONGODB_URI: VALID_URI, CLIENT_ORIGIN: 'https://seocheck.example.com/' });
    assert.equal(env.CLIENT_ORIGIN, 'https://seocheck.example.com');
  });
});

