/**
 * src/controllers/plotPrivate.controller.js
 *
 * Route handlers for PlotPrivate owner and source details.
 */

import { asyncHandler } from '../utils/asyncHandler.js';
import { sendSuccess } from '../utils/apiResponse.js';
import * as plotPrivateService from '../services/plotPrivate.service.js';

export const getPlotPrivate = asyncHandler(async (req, res) => {
  const result = await plotPrivateService.getPlotPrivate({
    plotId: req.params.plotId,
    firmId: req.tenant.firmId,
  });

  return sendSuccess(res, result, 200);
});

export const putPlotPrivate = asyncHandler(async (req, res) => {
  const result = await plotPrivateService.putPlotPrivate({
    plotId: req.params.plotId,
    firmId: req.tenant.firmId,
    data: req.body,
    userId: req.user.id,
  });

  return sendSuccess(res, result, 200);
});

export const patchPlotPrivate = asyncHandler(async (req, res) => {
  const result = await plotPrivateService.patchPlotPrivate({
    plotId: req.params.plotId,
    firmId: req.tenant.firmId,
    data: req.body,
    userId: req.user.id,
  });

  return sendSuccess(res, result, 200);
});

export const deletePlotPrivate = asyncHandler(async (req, res) => {
  const result = await plotPrivateService.deletePlotPrivate({
    plotId: req.params.plotId,
    firmId: req.tenant.firmId,
  });

  return sendSuccess(res, result, 200);
});

export default {
  getPlotPrivate,
  putPlotPrivate,
  patchPlotPrivate,
  deletePlotPrivate,
};
