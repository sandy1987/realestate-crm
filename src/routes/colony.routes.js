/**
 * src/routes/colony.routes.js
 *
 * Colony management endpoints.
 * Scoped strictly to authenticated firm member via requireAuth + requireTenantContext.
 */

import { Router } from 'express';
import { requireAuth } from '../middleware/auth.middleware.js';
import { requireTenantContext } from '../middleware/tenant.middleware.js';
import { requirePermission } from '../middleware/permission.middleware.js';
import { validate } from '../middleware/validate.middleware.js';
import { PERMS } from '../constants/permissions.js';
import {
  createColonySchema,
  updateColonySchema,
  queryColonySchema,
} from '../schemas/colony.schema.js';
import * as colonyController from '../controllers/colony.controller.js';

const router = Router();

// Enforce authentication and tenant context on all colony routes
router.use(requireAuth);
router.use(requireTenantContext);

router.post(
  '/',
  requirePermission(PERMS.COLONIES_WRITE),
  validate(createColonySchema),
  colonyController.createColony
);

router.get(
  '/',
  requirePermission(PERMS.COLONIES_READ),
  validate(queryColonySchema, 'query'),
  colonyController.listColonies
);

router.get(
  '/:colonyId',
  requirePermission(PERMS.COLONIES_READ),
  colonyController.getColony
);

router.patch(
  '/:colonyId',
  requirePermission(PERMS.COLONIES_WRITE),
  validate(updateColonySchema),
  colonyController.updateColony
);

router.delete(
  '/:colonyId',
  requirePermission(PERMS.COLONIES_WRITE),
  colonyController.deactivateColony
);

export default router;
