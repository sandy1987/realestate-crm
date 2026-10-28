/**
 * src/config/logger.js
 *
 * Application-wide structured Pino logger.
 * All src/ code must use this logger — no console.log / console.error.
 *
 * Sensitive fields are redacted at the transport level so they never appear
 * in log output even if they are accidentally passed to logger calls.
 */

import pino from 'pino';
import config from './env.js';

const logger = pino({
  level: config.LOG_LEVEL,

  // Redact sensitive paths before any log line is written.
  // 'censor' replaces the value; the key name remains visible in the log.
  redact: {
    paths: [
      'password',
      'passwordHash',
      'nationalId',
      'token',
      'tokenHash',
      'owner',
      'source',
      'owner.phone',
      'owner.email',
      'source.phone',
      'source.email',
      'req.headers.authorization',
      'req.headers.cookie',
      'req.body.password',
      'req.body.nationalId',
      'req.body.owner',
      'req.body.source',
      'req.body.ownerPhone',
      'req.body.ownerEmail',
      'req.body.sourcePhone',
      'req.body.sourceEmail',
      'err.config.headers.authorization', // axios-style leaked headers
    ],
    censor: '[REDACTED]',
  },
});

export { logger };
export default logger;
