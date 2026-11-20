import crypto from 'node:crypto';
import env from '../config/env.js';
import AppError from '../utils/AppError.js';

// Hashing both values to fixed-length SHA-256 digests lets timingSafeEqual always run on
// equal-length buffers, so neither the key's contents nor its length leak through timing.
const digest = (value) => crypto.createHash('sha256').update(value, 'utf8').digest();

const keysMatch = (provided, expected) => crypto.timingSafeEqual(digest(provided), digest(expected));

/**
 * Builds middleware that only allows requests whose `X-Admin-Key` header matches `expectedKey`.
 * An empty `expectedKey` locks the route for everyone (403 FORBIDDEN).
 *
 * @param {string} expectedKey
 */
export const createRequireAdminKey = (expectedKey) => {
  const configuredKey = typeof expectedKey === 'string' ? expectedKey : '';

  return (req, res, next) => {
    const provided = req.get('x-admin-key') ?? '';

    if (configuredKey === '' || provided === '' || !keysMatch(provided, configuredKey)) {
      next(new AppError('FORBIDDEN'));
      return;
    }

    next();
  };
};

export const requireAdminKey = createRequireAdminKey(env.ADMIN_API_KEY);

export default requireAdminKey;
