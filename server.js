/**
 * server.js
 *
 * Application entry point.
 * Connects to MongoDB, starts HTTP server, and manages graceful shutdown.
 */

import app from './src/app.js';
import { config } from './src/config/env.js';
import { connectDB, disconnectDB } from './src/config/db.js';
import { logger } from './src/config/logger.js';

let server;

async function startServer() {
  try {
    await connectDB();

    server = app.listen(config.PORT, () => {
      logger.info(`Server running on port ${config.PORT} in ${config.NODE_ENV} mode`);
    });
  } catch (err) {
    logger.fatal({ err }, 'Failed to start server');
    process.exit(1);
  }
}

async function shutdown(signal) {
  logger.info(`Received ${signal}. Starting graceful shutdown...`);

  if (server) {
    server.close(async () => {
      logger.info('HTTP server closed');
      try {
        await disconnectDB();
        logger.info('Graceful shutdown completed');
        process.exit(0);
      } catch (err) {
        logger.error({ err }, 'Error during database disconnection');
        process.exit(1);
      }
    });

    // Forced exit if graceful shutdown takes longer than 10 seconds
    setTimeout(() => {
      logger.error('Forced shutdown after timeout');
      process.exit(1);
    }, 10_000).unref();
  } else {
    process.exit(0);
  }
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

process.on('unhandledRejection', (reason) => {
  logger.fatal({ reason }, 'Unhandled Promise Rejection');
  process.exit(1);
});

process.on('uncaughtException', (err) => {
  logger.fatal({ err }, 'Uncaught Exception');
  process.exit(1);
});

startServer();
