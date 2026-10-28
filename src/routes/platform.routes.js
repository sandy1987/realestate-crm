/**
 * src/routes/platform.routes.js
 *
 * Platform administration routes (SUPER_ADMIN only).
 *
 * Strict Isolation:
 *  - Protected by requireAuth AND requirePlatformAdmin.
 *  - Tenant members (FIRM_ADMIN, FIRM_STAFF) are rejected with 403.
 *  - tenant.middleware is NEVER mounted on platform routes.
 */

import { Router } from 'express';
import { requireAuth } from '../middleware/auth.middleware.js';
import { requirePlatformAdmin } from '../middleware/platform.middleware.js';
import { validate } from '../middleware/validate.middleware.js';
import { createFirmSchema } from '../schemas/firm.schema.js';
import { queryPlatformAuditSchema } from '../schemas/audit.schema.js';
import * as platformController from '../controllers/platform.controller.js';
import * as auditController from '../controllers/audit.controller.js';

const router = Router();

// Apply platform authentication and authorization guards to all routes
router.use(requireAuth);
router.use(requirePlatformAdmin);

// Firm provisioning and management
router.post('/firms', validate(createFirmSchema), platformController.createFirm);
router.get('/firms', platformController.listFirms);
router.get('/firms/:firmId', platformController.getFirm);
router.post('/firms/:firmId/suspend', platformController.suspendFirm);
router.post('/firms/:firmId/activate', platformController.activateFirm);

// Platform Audit Log Trail (SUPER_ADMIN only)
router.get(
  '/audit',
  validate(queryPlatformAuditSchema, 'query'),
  auditController.listPlatformAuditLogs
);

export default router;
