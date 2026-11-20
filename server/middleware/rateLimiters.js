import { rateLimit } from 'express-rate-limit';
import env from '../config/env.js';
import AppError from '../utils/AppError.js';

const FIFTEEN_MINUTES_MS = 15 * 60 * 1000;

// Shared factory so the strict analyze limiter (P5-T3) reuses the same behaviour.
const createLimiter = (limit) =>
  rateLimit({
    windowMs: FIFTEEN_MINUTES_MS,
    limit,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    // Route through the central error handler so 429s use the standard envelope.
    handler: (req, res, next) => next(new AppError('RATE_LIMITED')),
  });

export const globalLimiter = createLimiter(env.RATE_LIMIT_GLOBAL_PER_15MIN);

