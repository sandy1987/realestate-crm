/**
 * api/index.js
 *
 * Serverless entry point for Vercel deployment.
 * Connects to MongoDB (caching the connection) and delegates requests to Express app.
 */

import app from '../src/app.js';
import { connectDB } from '../src/config/db.js';

export default async function handler(req, res) {
  // Fast path for CORS preflight OPTIONS requests (no DB connection needed)
  if (req.method === 'OPTIONS') {
    return app(req, res);
  }

  try {
    await connectDB();
  } catch (err) {
    console.error('Database connection error in serverless handler:', err);
  }

  return app(req, res);
}
