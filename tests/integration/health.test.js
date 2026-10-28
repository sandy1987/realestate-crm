/**
 * tests/integration/health.test.js
 *
 * Integration tests for health probes, payload size limits, and routing.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import mongoose from 'mongoose';
import { app } from '../../src/app.js';
import { connectDB, disconnectDB } from '../../src/config/db.js';

describe('Health Integration Tests', () => {
  beforeAll(async () => {
    await connectDB();
  });

  afterAll(async () => {
    await disconnectDB();
  });

  it('GET /health returns 200 with status ok (AC-2)', async () => {
    const res = await request(app).get('/health');

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      success: true,
      data: {
        status: 'ok',
      },
    });
  });

  it('GET /health/ready returns 200 when database is connected (AC-3)', async () => {
    const res = await request(app).get('/health/ready');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.status).toBe('ok');
    expect(res.body.data.database).toBe('connected');
  });

  it('GET /health/ready returns 503 when database is disconnected (AC-3)', async () => {
    // Disconnect Mongoose to verify 503 behavior
    await mongoose.connection.close();

    const res = await request(app).get('/health/ready');

    expect(res.status).toBe(503);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('SERVICE_UNAVAILABLE');

    // Reconnect for teardown
    await connectDB();
  });

  it('rejects JSON payloads larger than 10kb with 413 PAYLOAD_TOO_LARGE (AC-8)', async () => {
    const largePayload = {
      data: 'a'.repeat(11 * 1024), // 11kb
    };

    const res = await request(app)
      .post('/health')
      .send(largePayload)
      .set('Content-Type', 'application/json');

    expect(res.status).toBe(413);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('PAYLOAD_TOO_LARGE');
  });

  it('returns standard 404 NOT_FOUND envelope for unmatched routes', async () => {
    const res = await request(app).get('/unknown-api-route');

    expect(res.status).toBe(404);
    expect(res.body).toEqual({
      success: false,
      error: {
        code: 'NOT_FOUND',
        message: 'Endpoint GET /unknown-api-route not found',
      },
    });
  });
});
