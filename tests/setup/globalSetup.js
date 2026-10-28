/**
 * tests/setup/globalSetup.js
 *
 * Vitest global setup hook.
 * Starts in-memory MongoDB instance and injects required environment variables.
 */

import { MongoMemoryServer } from 'mongodb-memory-server';

let mongodInstance;

export async function setup() {
  process.env.NODE_ENV = 'test';
  process.env.LOG_LEVEL = 'silent';
  process.env.JWT_ACCESS_SECRET = 'test-access-secret-minimum-32-characters-for-jwt-signing!';
  process.env.JWT_REFRESH_SECRET = 'test-refresh-secret-minimum-32-characters-for-jwt-signing!';
  process.env.CORS_ALLOWED_ORIGINS = 'http://localhost:5173,http://localhost:3000';

  try {
    mongodInstance = await MongoMemoryServer.create();
    process.env.MONGODB_URI = mongodInstance.getUri();
  } catch (err) {
    process.env.MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/agent_broker_test';
  }

  // Return teardown function for Vitest
  return async () => {
    if (mongodInstance) {
      await mongodInstance.stop();
    }
  };
}

export async function teardown() {
  if (mongodInstance) {
    await mongodInstance.stop();
  }
}

export default setup;
