/**
 * src/controllers/colony.controller.js
 *
 * Route handlers for Colony management.
 */

import { asyncHandler } from '../utils/asyncHandler.js';
import { sendSuccess } from '../utils/apiResponse.js';
import * as colonyService from '../services/colony.service.js';

export const createColony = asyncHandler(async (req, res) => {
  const result = await colonyService.createColony({
    firmId: req.tenant.firmId,
    data: req.body,
    userId: req.user.id,
  });

  return sendSuccess(res, result, 201);
});

export const listColonies = asyncHandler(async (req, res) => {
  const result = await colonyService.listColonies({
    firmId: req.tenant.firmId,
    query: req.query,
  });

  return sendSuccess(res, result.items, 200, result.meta);
});

export const getColony = asyncHandler(async (req, res) => {
  const result = await colonyService.getColonyById({
    colonyId: req.params.colonyId,
    firmId: req.tenant.firmId,
  });

  return sendSuccess(res, result, 200);
});

export const updateColony = asyncHandler(async (req, res) => {
  const result = await colonyService.updateColony({
    colonyId: req.params.colonyId,
    firmId: req.tenant.firmId,
    data: req.body,
    userId: req.user.id,
  });

  return sendSuccess(res, result, 200);
});

export const deactivateColony = asyncHandler(async (req, res) => {
  const result = await colonyService.deactivateColony({
    colonyId: req.params.colonyId,
    firmId: req.tenant.firmId,
    userId: req.user.id,
  });

  return sendSuccess(res, result, 200);
});

export default {
  createColony,
  listColonies,
  getColony,
  updateColony,
  deactivateColony,
};
