/**
 * src/config/db.js
 *
 * Mongoose connection management.
 *
 * RULES:
 *  - connectDB() is called by server.js on startup.
 *  - connectDB() is called by individual test suites that need a database.
 *  - app.js does NOT auto-connect — keeping the app factory clean for Supertest.
 *  - Shutdown signal handlers (SIGTERM/SIGINT) are registered in server.js,
 *    not here, to avoid registering duplicate handlers in tests.
 */

import dns from 'dns';
import mongoose from 'mongoose';
import config from './env.js';
import logger from './logger.js';

/**
 * Open a Mongoose connection.
 * Safe to call multiple times — skips if already connected (readyState === 1).
 *
 * @param {string} [uri] - override for tests (defaults to config.MONGODB_URI)
 */
export async function connectDB(uri) {
  if (mongoose.connection.readyState === 1) {
    return; // Already connected
  }

  const connectionUri = uri ?? config.MONGODB_URI;

  if (connectionUri.startsWith('mongodb+srv://')) {
    try {
      dns.setServers(['8.8.8.8', '1.1.1.1']);
    } catch {
      // safe fallback
    }
  }

  try {
    await mongoose.connect(connectionUri, {
      serverSelectionTimeoutMS: 5_000,
    });
    logger.info('MongoDB connected');
  } catch (err) {
    logger.error({ err }, 'MongoDB connection failed');
    throw err;
  }

  mongoose.connection.on('error', (err) => {
    logger.error({ err }, 'MongoDB runtime error');
  });

  mongoose.connection.on('disconnected', () => {
    logger.warn('MongoDB disconnected');
  });
}

/**
 * Gracefully close the Mongoose connection.
 * Called by server.js shutdown handler and by test teardown.
 */
export async function disconnectDB() {
  if (mongoose.connection.readyState !== 0) {
    await mongoose.connection.close();
    logger.info('MongoDB disconnected gracefully');
  }
}
