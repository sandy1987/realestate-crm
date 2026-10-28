/**
 * src/middleware/errorHandler.middleware.js
 *
 * Centralized Express error-handling middleware.
 * Maps application and library errors (Zod, Mongoose, JWT, BodyParser)
 * to consistent standard error responses:
 *
 * {
 *   success: false,
 *   error: {
 *     code: 'ERROR_CODE',
 *     message: 'Safe message',
 *     details?: [ ... ]
 *   }
 * }
 *
 * In production mode, stack traces and internal error details are NEVER exposed.
 */

import { logger } from '../config/logger.js';
import { sendError } from '../utils/apiResponse.js';

export function errorHandler(err, req, res, _next) {
  const isProduction = (process.env.NODE_ENV || 'development') === 'production';

  // 1. Express body-parser payload too large
  if (err.type === 'entity.too.large' || err.status === 413 || err.statusCode === 413) {
    return sendError(res, {
      statusCode: 413,
      code: 'PAYLOAD_TOO_LARGE',
      message: 'Request payload exceeds maximum permitted size of 10kb',
    });
  }

  // 2. Express malformed JSON in body
  if (err instanceof SyntaxError && (err.status === 400 || err.statusCode === 400) && 'body' in err) {
    return sendError(res, {
      statusCode: 400,
      code: 'INVALID_JSON',
      message: 'Request body contains invalid JSON syntax',
    });
  }

  // 3. Zod validation error (if thrown outside validate middleware)
  if (err.name === 'ZodError' && Array.isArray(err.issues)) {
    const details = err.issues.map((issue) => ({
      field: issue.path.join('.'),
      message: issue.message,
    }));
    return sendError(res, {
      statusCode: 400,
      code: 'VALIDATION_ERROR',
      message: 'Request validation failed',
      details,
    });
  }

  // 4. Mongoose validation error
  if (err.name === 'ValidationError' && err.errors) {
    const details = Object.entries(err.errors).map(([field, errorObj]) => ({
      field,
      message: errorObj.message,
    }));
    return sendError(res, {
      statusCode: 400,
      code: 'VALIDATION_ERROR',
      message: 'Database schema validation failed',
      details,
    });
  }

  // 5. Mongoose CastError (e.g., malformed ObjectId)
  if (err.name === 'CastError') {
    return sendError(res, {
      statusCode: 400,
      code: 'INVALID_IDENTIFIER',
      message: `Invalid format for field '${err.path}'`,
    });
  }

  // 6. MongoDB duplicate key error (code 11000)
  if (err.code === 11000) {
    const fields = Object.keys(err.keyPattern || {});
    return sendError(res, {
      statusCode: 409,
      code: 'CONFLICT',
      message: `Resource with unique field (${fields.join(', ')}) already exists`,
    });
  }

  // 7. JWT errors
  if (err.name === 'JsonWebTokenError') {
    return sendError(res, {
      statusCode: 401,
      code: 'UNAUTHORIZED',
      message: 'Invalid authorization token',
    });
  }
  if (err.name === 'TokenExpiredError') {
    return sendError(res, {
      statusCode: 401,
      code: 'UNAUTHORIZED',
      message: 'Authorization token has expired',
    });
  }

  // 8. Explicit HTTP errors with custom status codes
  const statusCode = err.statusCode || err.status || 500;
  const isServerError = statusCode >= 500;

  if (isServerError) {
    // Log unexpected 500 errors
    logger.error({
      err,
      method: req.method,
      url: req.originalUrl,
      ip: req.ip,
    }, 'Unhandled server error');
  }

  const code = err.code || (isServerError ? 'INTERNAL_ERROR' : 'BAD_REQUEST');
  const message = isServerError && isProduction
    ? 'Internal server error'
    : (err.message || 'Internal server error');

  return sendError(res, {
    statusCode,
    code,
    message,
    details: !isProduction && isServerError && err.stack ? { stack: err.stack } : (err.details || null),
  });
}

export default errorHandler;
