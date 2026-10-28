/**
 * src/routes/plot.routes.js
 *
 * Plot listing, search, filtering, and management endpoints.
 * Scoped strictly to authenticated firm member via requireAuth + requireTenantContext.
 */

import { Router } from 'express';
import { requireAuth } from '../middleware/auth.middleware.js';
import { requireTenantContext } from '../middleware/tenant.middleware.js';
import { requirePermission } from '../middleware/permission.middleware.js';
import { validate } from '../middleware/validate.middleware.js';
import { PERMS } from '../constants/permissions.js';
import {
  createPlotSchema,
  updatePlotSchema,
  queryPlotSchema,
} from '../schemas/plot.schema.js';
import {
  putPlotPrivateSchema,
  patchPlotPrivateSchema,
} from '../schemas/plotPrivate.schema.js';
import * as plotController from '../controllers/plot.controller.js';
import * as plotPrivateController from '../controllers/plotPrivate.controller.js';

const router = Router();

// Enforce authentication and tenant context on all plot routes
router.use(requireAuth);
router.use(requireTenantContext);

router.post(
  '/',
  requirePermission(PERMS.PLOTS_WRITE),
  validate(createPlotSchema),
  plotController.createPlot
);

router.get(
  '/',
  requirePermission(PERMS.PLOTS_READ),
  validate(queryPlotSchema, 'query'),
  plotController.listPlots
);

router.get(
  '/:plotId',
  requirePermission(PERMS.PLOTS_READ),
  plotController.getPlot
);

router.get(
  '/:plotId/share-whatsapp',
  requirePermission(PERMS.PLOTS_READ),
  plotController.getPlotWhatsAppShare
);

router.patch(
  '/:plotId',
  requirePermission(PERMS.PLOTS_WRITE),
  validate(updatePlotSchema),
  plotController.updatePlot
);

router.delete(
  '/:plotId',
  requirePermission(PERMS.PLOTS_DELETE),
  plotController.deactivatePlot
);

// --- Private Owner/Source Endpoints (Phase 5) ---
router.get(
  '/:plotId/private',
  requirePermission(PERMS.PRIVATE_READ),
  plotPrivateController.getPlotPrivate
);

router.put(
  '/:plotId/private',
  requirePermission(PERMS.PRIVATE_WRITE),
  validate(putPlotPrivateSchema),
  plotPrivateController.putPlotPrivate
);

router.patch(
  '/:plotId/private',
  requirePermission(PERMS.PRIVATE_WRITE),
  validate(patchPlotPrivateSchema),
  plotPrivateController.patchPlotPrivate
);

router.delete(
  '/:plotId/private',
  requirePermission(PERMS.PRIVATE_WRITE),
  plotPrivateController.deletePlotPrivate
);

export default router;
