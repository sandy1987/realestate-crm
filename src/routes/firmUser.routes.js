/**
 * src/routes/firmUser.routes.js
 *
 * Firm-scoped user administration routes.
 *
 * Security:
 *  - requireAuth: Ensures caller is authenticated.
 *  - requireTenantContext: Derives req.tenant and rejects SUPER_ADMIN.
 *  - requireRole(ROLES.FIRM_ADMIN): Only FIRM_ADMIN can administer firm staff.
 */

import { Router } from 'express';
import { requireAuth } from '../middleware/auth.middleware.js';
import { requireTenantContext } from '../middleware/tenant.middleware.js';
import { requireRole } from '../middleware/role.middleware.js';
import { validate } from '../middleware/validate.middleware.js';
import { ROLES } from '../constants/roles.js';
import {
  createFirmUserSchema,
  updateFirmUserSchema,
  updateFirmUserStatusSchema,
  queryFirmUserSchema,
} from '../schemas/firmUser.schema.js';
import * as firmUserController from '../controllers/firmUser.controller.js';

const router = Router();

// Protect all firm user administration routes with auth, tenant context, and FIRM_ADMIN role guard
router.use(requireAuth);
router.use(requireTenantContext);
router.use(requireRole(ROLES.FIRM_ADMIN));

router.post(
  '/',
  validate(createFirmUserSchema),
  firmUserController.createStaffUser
);

router.get(
  '/',
  validate(queryFirmUserSchema, 'query'),
  firmUserController.listFirmUsers
);

router.get(
  '/:userId',
  firmUserController.getFirmUser
);

router.patch(
  '/:userId',
  validate(updateFirmUserSchema),
  firmUserController.updateFirmUser
);

router.patch(
  '/:userId/status',
  validate(updateFirmUserStatusSchema),
  firmUserController.updateFirmUserStatus
);

export default router;
