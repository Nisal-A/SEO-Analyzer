import AppError from '../utils/AppError.js';
import logger from '../utils/logger.js';

// body-parser (used by express.json) tags its errors with `type`; map them to safe messages.
const BODY_PARSER_ERRORS = {
  'entity.too.large': 'Request body is too large.',
  'entity.parse.failed': 'Request body is not valid JSON.',
  'encoding.unsupported': 'Request body encoding is not supported.',
  'charset.unsupported': 'Request body charset is not supported.',
  'request.aborted': 'Request was aborted.',
};

const normalizeError = (err) => {
  if (err instanceof AppError && err.isOperational) return err;

  if (err && Object.hasOwn(BODY_PARSER_ERRORS, err.type)) {
    const statusCode = Number.isInteger(err.status) && err.status >= 400 && err.status < 500 ? err.status : 400;
    return new AppError('VALIDATION_ERROR', BODY_PARSER_ERRORS[err.type], { statusCode });
  }

  return new AppError('INTERNAL_ERROR');
};

// Express identifies error middleware by its 4-argument signature, so `next` must stay.
// eslint-disable-next-line no-unused-vars
const errorHandler = (err, req, res, next) => {
  if (res.headersSent) {
    next(err);
    return;
  }

  const appError = normalizeError(err);

  if (appError.statusCode >= 500) {
    // Full detail goes to the server log only; the client gets the generic message.
    logger.error('Unhandled request error', { method: req.method, path: req.originalUrl, error: err });
  }

  res.status(appError.statusCode).json({
    success: false,
    error: { code: appError.code, message: appError.message },
  });
};

export default errorHandler;

