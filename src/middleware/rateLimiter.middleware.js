/**
 * src/middleware/rateLimiter.middleware.js
 *
 * Rate limiting middleware using express-rate-limit.
 * Exports:
 *  - globalRateLimiter: applied to all incoming API traffic
 *  - authRateLimiter: stricter limiter reserved for authentication endpoints
 */

import rateLimit from 'express-rate-limit';
import { config } from '../config/env.js';
import { sendError } from '../utils/apiResponse.js';

export const globalRateLimiter = rateLimit({
  windowMs: config.RATE_LIMIT_WINDOW_MS,
  max: config.RATE_LIMIT_MAX,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    return sendError(res, {
      statusCode: 429,
      code: 'RATE_LIMITED',
      message: 'Too many requests, please try again later.',
    });
  },
});

export const authRateLimiter = rateLimit({
  windowMs: config.RATE_LIMIT_WINDOW_MS,
  max: (req) => {
    if ((process.env.NODE_ENV || config.NODE_ENV) === 'test' && !req.headers['x-test-rate-limit']) {
      return 1000;
    }
    return config.AUTH_RATE_LIMIT_MAX;
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    return sendError(res, {
      statusCode: 429,
      code: 'RATE_LIMITED',
      message: 'Too many authentication attempts, please try again later.',
    });
  },
});

export default globalRateLimiter;
