/**
 * src/controllers/firmUser.controller.js
 *
 * Route handlers for firm-scoped user administration.
 */

import { asyncHandler } from '../utils/asyncHandler.js';
import { sendSuccess } from '../utils/apiResponse.js';
import * as firmUserService from '../services/firmUser.service.js';

export const createStaffUser = asyncHandler(async (req, res) => {
  const result = await firmUserService.createStaffUser({
    firmId: req.tenant.firmId,
    data: req.body,
    creatorId: req.user.id,
  });

  return sendSuccess(res, result, 201);
});

export const listFirmUsers = asyncHandler(async (req, res) => {
  const result = await firmUserService.listFirmUsers({
    firmId: req.tenant.firmId,
    query: req.query,
  });

  return sendSuccess(res, result.items, 200, result.meta);
});

export const getFirmUser = asyncHandler(async (req, res) => {
  const result = await firmUserService.getFirmUserById({
    userId: req.params.userId,
    firmId: req.tenant.firmId,
  });

  return sendSuccess(res, result, 200);
});

export const updateFirmUser = asyncHandler(async (req, res) => {
  const result = await firmUserService.updateFirmUser({
    userId: req.params.userId,
    firmId: req.tenant.firmId,
    data: req.body,
    actorUserId: req.user.id,
    actorRole: req.user.role,
  });

  return sendSuccess(res, result, 200);
});

export const updateFirmUserStatus = asyncHandler(async (req, res) => {
  const result = await firmUserService.updateFirmUserStatus({
    userId: req.params.userId,
    firmId: req.tenant.firmId,
    data: req.body,
    currentUserId: req.user.id,
    actorRole: req.user.role,
  });

  return sendSuccess(res, result, 200);
});

export default {
  createStaffUser,
  listFirmUsers,
  getFirmUser,
  updateFirmUser,
  updateFirmUserStatus,
};
