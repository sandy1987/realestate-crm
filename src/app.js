/**
 * src/app.js
 *
 * Express application factory.
 * Configures security, parsing, logging, routing, and error handling.
 *
 * RULES:
 *  - Does NOT connect to MongoDB directly — server.js or tests initiate connectDB().
 *  - Enforces 10kb body parser limit (rejects with 413).
 *  - Configures Helmet and strict CORS based on environment configuration.
 *  - Mounts standard routes and centralized errorHandler.
 */

import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import pinoHttp from 'pino-http';
import { config } from './config/env.js';
import { logger } from './config/logger.js';
import { globalRateLimiter } from './middleware/rateLimiter.middleware.js';
import { errorHandler } from './middleware/errorHandler.middleware.js';
import { sendError } from './utils/apiResponse.js';
import routes from './routes/index.js';

export function createApp() {
  const app = express();

  // 1. Trust proxy if running behind reverse proxy
  app.set('trust proxy', 1);

  // 2. HTTP Security headers
  app.use(helmet());

  // 3. CORS configuration
  const allowedOrigins = (config.CORS_ALLOWED_ORIGINS || '')
    .split(',')
    .map((origin) => origin.trim().replace(/\/+$/, ''))
    .filter(Boolean);

  const corsOptions = {
    origin: (origin, callback) => {
      // Allow requests with no origin (like mobile apps, curl, or internal service calls)
      if (!origin) return callback(null, true);
      const cleanOrigin = origin.replace(/\/+$/, '');
      if (
        allowedOrigins.includes('*') ||
        allowedOrigins.includes(cleanOrigin) ||
        cleanOrigin.endsWith('.vercel.app')
      ) {
        return callback(null, true);
      }
      return callback(new Error(`Origin '${origin}' not permitted by CORS policy`));
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Accept', 'X-Requested-With'],
  };

  app.use(cors(corsOptions));
  app.options('*', cors(corsOptions));

  // 4. Structured HTTP logging
  app.use(
    pinoHttp({
      logger,
      autoLogging: (process.env.NODE_ENV || config.NODE_ENV) !== 'test',
    })
  );

  // 5. Body parsers with strict size limits
  app.use(express.json({ limit: '10kb' }));
  app.use(express.urlencoded({ extended: true, limit: '10kb' }));

  // 6. Global rate limiter (skip during unit/integration tests to prevent false positives)
  if ((process.env.NODE_ENV || config.NODE_ENV) !== 'test') {
    app.use(globalRateLimiter);
  }

  // 7. Mount routes
  app.use(routes);

  // 8. 404 handler for unmatched routes
  app.use((req, res) => {
    sendError(res, {
      statusCode: 404,
      code: 'NOT_FOUND',
      message: `Endpoint ${req.method} ${req.originalUrl} not found`,
    });
  });

  // 9. Centralized error handling
  app.use(errorHandler);

  return app;
}

export const app = createApp();
export default app;
