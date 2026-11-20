import logger from '../utils/logger.js';

// Defaults come from PROJECT_MASTER_PLAN.md §11 / ADR-007 / ADR-018.
// MONGODB_URI deliberately has no default: the app must not start without a database.
const NODE_ENVS = ['development', 'production', 'test'];

const NUMERIC_VARS = {
  PORT: { default: 5000, min: 1, max: 65535 },
  FETCH_TIMEOUT_MS: { default: 10000, min: 1 },
  FETCH_MAX_BYTES: { default: 2097152, min: 1 },
  FETCH_MAX_REDIRECTS: { default: 5, min: 0 },
  RATE_LIMIT_ANALYZE_PER_15MIN: { default: 10, min: 1 },
  RATE_LIMIT_GLOBAL_PER_15MIN: { default: 200, min: 1 },
};

const DEFAULT_CLIENT_ORIGIN = 'http://localhost:5173';

const readString = (source, name) => {
  const value = source[name];
  return typeof value === 'string' ? value.trim() : '';
};

const parseInteger = (source, name, rule, errors) => {
  const raw = readString(source, name);
  if (raw === '') return rule.default;

  const value = Number(raw);
  const max = rule.max ?? Number.MAX_SAFE_INTEGER;
  if (!Number.isInteger(value) || value < rule.min || value > max) {
    errors.push(`${name} must be an integer between ${rule.min} and ${max} (received "${raw}")`);
    return rule.default;
  }
  return value;
};

const parseOrigin = (raw, errors) => {
  try {
    const url = new URL(raw);
    if (!['http:', 'https:'].includes(url.protocol)) throw new Error('bad protocol');
    // CORS compares exact origins, so normalise away any path or trailing slash.
    return url.origin;
  } catch {
    errors.push(`CLIENT_ORIGIN must be an http(s) origin such as ${DEFAULT_CLIENT_ORIGIN} (received "${raw}")`);
    return DEFAULT_CLIENT_ORIGIN;
  }
};

/**
 * Pure validation so it can be unit tested without touching process.env.
 * @param {Record<string, string | undefined>} source
 * @returns {{ env: object, errors: string[] }}
 */
export const validateEnv = (source) => {
  const errors = [];

  const nodeEnv = readString(source, 'NODE_ENV') || 'development';
  if (!NODE_ENVS.includes(nodeEnv)) {
    errors.push(`NODE_ENV must be one of ${NODE_ENVS.join(', ')} (received "${nodeEnv}")`);
  }

  const mongoUri = readString(source, 'MONGODB_URI');
  if (mongoUri === '') {
    errors.push('MONGODB_URI is required');
  } else if (!/^mongodb(\+srv)?:\/\//.test(mongoUri)) {
    errors.push('MONGODB_URI must start with mongodb:// or mongodb+srv://');
  }

  const clientOrigin = parseOrigin(readString(source, 'CLIENT_ORIGIN') || DEFAULT_CLIENT_ORIGIN, errors);

  const numeric = Object.fromEntries(
    Object.entries(NUMERIC_VARS).map(([name, rule]) => [name, parseInteger(source, name, rule, errors)]),
  );

  const env = Object.freeze({
    NODE_ENV: nodeEnv,
    MONGODB_URI: mongoUri,
    CLIENT_ORIGIN: clientOrigin,
    ...numeric,
    isProduction: nodeEnv === 'production',
    isTest: nodeEnv === 'test',
  });

  return { env, errors };
};

const { env, errors } = validateEnv(process.env);

if (errors.length > 0) {
  // Fail fast: a misconfigured server should never start serving traffic.
  // Only variable names and reasons are logged, never the values of secrets.
  logger.error('Invalid environment configuration', { errors });
  process.exit(1);
}

export default env;

