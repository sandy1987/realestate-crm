/**
 * src/controllers/plot.controller.js
 *
 * Route handlers for Plot listing and management.
 */

import { asyncHandler } from '../utils/asyncHandler.js';
import { sendSuccess } from '../utils/apiResponse.js';
import * as plotService from '../services/plot.service.js';

export const createPlot = asyncHandler(async (req, res) => {
  const result = await plotService.createPlot({
    firmId: req.tenant.firmId,
    data: req.body,
    userId: req.user.id,
    firmSettings: req.firm?.settings,
  });

  return sendSuccess(res, result, 201);
});

export const listPlots = asyncHandler(async (req, res) => {
  const result = await plotService.listPlots({
    firmId: req.tenant.firmId,
    query: req.query,
  });

  return sendSuccess(res, result.items, 200, result.meta);
});

export const getPlot = asyncHandler(async (req, res) => {
  const result = await plotService.getPlotById({
    plotId: req.params.plotId,
    firmId: req.tenant.firmId,
  });

  return sendSuccess(res, result, 200);
});

export const updatePlot = asyncHandler(async (req, res) => {
  const result = await plotService.updatePlot({
    plotId: req.params.plotId,
    firmId: req.tenant.firmId,
    data: req.body,
    userId: req.user.id,
    firmSettings: req.firm?.settings,
  });

  return sendSuccess(res, result, 200);
});

export const deactivatePlot = asyncHandler(async (req, res) => {
  const result = await plotService.deactivatePlot({
    plotId: req.params.plotId,
    firmId: req.tenant.firmId,
    userId: req.user.id,
  });

  return sendSuccess(res, result, 200);
});

export const getPlotWhatsAppShare = asyncHandler(async (req, res) => {
  const result = await plotService.getPlotWhatsAppShare({
    plotId: req.params.plotId,
    firmId: req.tenant.firmId,
    userId: req.user?.id,
  });

  return sendSuccess(res, result, 200);
});

export default {
  createPlot,
  listPlots,
  getPlot,
  updatePlot,
  deactivatePlot,
  getPlotWhatsAppShare,
};
