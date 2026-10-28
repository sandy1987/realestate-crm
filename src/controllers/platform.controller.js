/**
 * src/controllers/platform.controller.js
 *
 * Route handlers for platform administration (SUPER_ADMIN only).
 */

import { asyncHandler } from '../utils/asyncHandler.js';
import { sendSuccess } from '../utils/apiResponse.js';
import * as firmService from '../services/firm.service.js';

export const createFirm = asyncHandler(async (req, res) => {
  const result = await firmService.provisionFirm({
    ...req.body,
    creatorId: req.user.id,
  });

  return sendSuccess(res, result, 201);
});

export const listFirms = asyncHandler(async (req, res) => {
  const result = await firmService.listFirms(req.query);
  return sendSuccess(res, result.items, 200, result.meta);
});

export const getFirm = asyncHandler(async (req, res) => {
  const result = await firmService.getFirmById(req.params.firmId);
  return sendSuccess(res, result, 200);
});

export const suspendFirm = asyncHandler(async (req, res) => {
  const result = await firmService.suspendFirm(req.params.firmId);
  return sendSuccess(res, result, 200);
});

export const activateFirm = asyncHandler(async (req, res) => {
  const result = await firmService.activateFirm(req.params.firmId);
  return sendSuccess(res, result, 200);
});

export default {
  createFirm,
  listFirms,
  getFirm,
  suspendFirm,
  activateFirm,
};
