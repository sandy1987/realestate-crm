/**
 * src/routes/index.js
 *
 * Primary application router.
 * Mounts public health check endpoints and prepares mount points
 * for future phase routers (platform, auth, firm, colonies, plots).
 */

import { Router } from 'express';
import healthRouter from './health.routes.js';
import authRouter from './auth.routes.js';
import platformRouter from './platform.routes.js';
import firmRouter from './firm.routes.js';
import colonyRouter from './colony.routes.js';
import plotRouter from './plot.routes.js';
import mediaRouter from './media.routes.js';
import docsRouter from './docs.routes.js';

const router = Router();

// Health & readiness probes (public, no auth)
router.use('/health', healthRouter);

// API Documentation & Swagger UI (Phase 8)
router.use('/api/v1/docs', docsRouter);
router.use('/api/docs', docsRouter);

// Authentication & Identity (Phase 2)
router.use('/api/v1/auth', authRouter);
router.use('/api/auth', authRouter);

// Platform Administration (Phase 3 — SUPER_ADMIN only)
router.use('/api/v1/platform', platformRouter);
router.use('/api/platform', platformRouter);

// Tenant Firm Routes (Phase 3 — Tenant members only; SUPER_ADMIN rejected)
router.use('/api/v1/firm', firmRouter);
router.use('/api/firm', firmRouter);

// Tenant Colony Management (Phase 4)
router.use('/api/v1/colonies', colonyRouter);
router.use('/api/colonies', colonyRouter);

// Tenant Plot Management (Phase 4)
router.use('/api/v1/plots', plotRouter);
router.use('/api/plots', plotRouter);

// Tenant Media Management (Phase 5 / Cloudinary)
router.use('/api/v1/media', mediaRouter);
router.use('/api/media', mediaRouter);

export default router;
