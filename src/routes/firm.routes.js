/**
 * src/routes/firm.routes.js
 *
 * Tenant firm routes.
 *
 * Protected strictly by requireAuth AND requireTenantContext:
 *  - Only authenticated FIRM_ADMIN and FIRM_STAFF can access these endpoints.
 *  - SUPER_ADMIN is explicitly rejected with 403.
 *  - req.firm and req.firmId are populated strictly from trusted database state.
 */

import { Router } from 'express';
import { sendSuccess } from '../utils/apiResponse.js';
import { requireAuth } from '../middleware/auth.middleware.js';
import { requireTenantContext } from '../middleware/tenant.middleware.js';
import { requirePermission } from '../middleware/permission.middleware.js';
import { validate } from '../middleware/validate.middleware.js';
import { PERMS } from '../constants/permissions.js';
import { queryFirmAuditSchema } from '../schemas/audit.schema.js';
import firmUserRouter from './firmUser.routes.js';
import * as auditController from '../controllers/audit.controller.js';

const router = Router();

router.use(requireAuth);
router.use(requireTenantContext);

// GET /me — Returns own firm profile for the authenticated tenant member
router.get('/me', (req, res) => {
  return sendSuccess(res, req.firm, 200);
});

// Firm-scoped User Administration (Phase 6 — FIRM_ADMIN only)
router.use('/users', firmUserRouter);

// Firm-scoped Audit Trail (Phase 7 — FIRM_ADMIN or FIRM_STAFF with audit:read)
router.get(
  '/audit',
  requirePermission(PERMS.AUDIT_READ),
  validate(queryFirmAuditSchema, 'query'),
  auditController.listFirmAuditLogs
);

export default router;
