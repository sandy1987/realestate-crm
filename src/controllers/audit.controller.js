/**
 * src/controllers/audit.controller.js
 *
 * Route handlers for firm and platform audit queries.
 */

import { asyncHandler } from '../utils/asyncHandler.js';
import { sendSuccess } from '../utils/apiResponse.js';
import * as auditService from '../services/audit.service.js';

export const listFirmAuditLogs = asyncHandler(async (req, res) => {
  const result = await auditService.listFirmAuditLogs({
    firmId: req.tenant.firmId,
    query: req.query,
  });

  return sendSuccess(res, result.items, 200, result.meta);
});

export const listPlatformAuditLogs = asyncHandler(async (req, res) => {
  const result = await auditService.listPlatformAuditLogs({
    query: req.query,
  });

  return sendSuccess(res, result.items, 200, result.meta);
});

export default {
  listFirmAuditLogs,
  listPlatformAuditLogs,
};
