/**
 * src/routes/health.routes.js
 *
 * Health and readiness probe endpoints.
 * Publicly accessible, no authentication or tenant context required.
 *
 * - GET /health       : Liveness probe (returns 200 when Node process is up)
 * - GET /health/ready : Readiness probe (checks active MongoDB connection)
 */

import { Router } from 'express';
import mongoose from 'mongoose';
import { sendSuccess, sendError } from '../utils/apiResponse.js';

const router = Router();

router.get('/', (req, res) => {
  return sendSuccess(res, { status: 'ok' });
});

router.get('/ready', (req, res) => {
  // readyState: 0 = disconnected, 1 = connected, 2 = connecting, 3 = disconnecting
  if (mongoose.connection.readyState === 1) {
    return sendSuccess(res, { status: 'ok', database: 'connected' });
  }

  return sendError(res, {
    statusCode: 503,
    code: 'SERVICE_UNAVAILABLE',
    message: 'Database connection is not ready',
    details: { readyState: mongoose.connection.readyState },
  });
});

export default router;
