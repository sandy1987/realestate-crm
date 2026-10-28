/**
 * src/services/plotPrivate.service.js
 *
 * PlotPrivate owner and source management service.
 * Enforces strict multi-tenant fences:
 *  - Plot ownership is verified before any private record operation.
 *  - Both plot and private record must belong to req.tenant.firmId.
 *  - Creator and updater IDs are derived strictly from authenticated user.
 */

import { PlotPrivate } from '../models/PlotPrivate.model.js';
import { Plot } from '../models/Plot.model.js';
import { isValidObjectId } from '../utils/objectId.js';
import { recordAuditEvent } from './audit.service.js';
import { AUDIT_EVENTS } from '../constants/auditEvents.js';

/**
 * Retrieves private owner and source details for a plot.
 */
export async function getPlotPrivate({ plotId, firmId }) {
  if (!isValidObjectId(plotId)) {
    const error = new Error('Plot not found');
    error.statusCode = 404;
    error.code = 'PLOT_NOT_FOUND';
    throw error;
  }

  // 1. Verify parent plot exists and belongs to the authenticated firm
  const plot = await Plot.findOne({ _id: plotId, firmId });
  if (!plot) {
    const error = new Error('Plot not found');
    error.statusCode = 404;
    error.code = 'PLOT_NOT_FOUND';
    throw error;
  }

  // 2. Fetch isolated private record scoped by plotId and firmId
  const record = await PlotPrivate.findOne({ plotId, firmId });
  if (!record) {
    const error = new Error('Private details not found for this plot');
    error.statusCode = 404;
    error.code = 'PRIVATE_RECORD_NOT_FOUND';
    throw error;
  }

  await recordAuditEvent({
    eventType: AUDIT_EVENTS.PRIVATE_DATA_READ,
    firmId,
    resourceType: 'plotPrivate',
    resourceId: String(plotId),
    action: 'read',
    metadata: { plotId: String(plotId) }, // Strictly no private values
  });

  return record.toSafeObject();
}

/**
 * Creates or completely replaces private owner/source details for a plot (PUT /upsert).
 */
export async function putPlotPrivate({ plotId, firmId, data, userId }) {
  if (!isValidObjectId(plotId)) {
    const error = new Error('Plot not found');
    error.statusCode = 404;
    error.code = 'PLOT_NOT_FOUND';
    throw error;
  }

  // 1. Verify parent plot exists and belongs to this firm
  const plot = await Plot.findOne({ _id: plotId, firmId });
  if (!plot) {
    const error = new Error('Plot not found');
    error.statusCode = 404;
    error.code = 'PLOT_NOT_FOUND';
    throw error;
  }

  // 2. Normalize owner subdocument
  const owner = {
    name: data.owner?.name !== undefined ? data.owner.name : (data.ownerName ?? null),
    phone: data.owner?.phone !== undefined ? data.owner.phone : (data.ownerPhone ?? null),
    email: data.owner?.email !== undefined ? data.owner.email : (data.ownerEmail ?? null),
    address: data.owner?.address !== undefined ? data.owner.address : (data.ownerAddress ?? null),
  };

  // 3. Normalize source subdocument
  const source = {
    name: data.source?.name !== undefined ? data.source.name : (data.sourceName ?? null),
    phone: data.source?.phone !== undefined ? data.source.phone : (data.sourcePhone ?? null),
    email: data.source?.email !== undefined ? data.source.email : (data.sourceEmail ?? null),
    type: data.source?.type !== undefined ? data.source.type : (data.sourceType ?? null),
  };

  const notes = data.notes ?? null;

  // 4. Upsert private record
  let record = await PlotPrivate.findOne({ plotId, firmId });
  if (record) {
    record.owner = owner;
    record.source = source;
    record.notes = notes;
    record.updatedBy = userId;
    await record.save();
  } else {
    record = new PlotPrivate({
      plotId,
      firmId,
      owner,
      source,
      notes,
      createdBy: userId,
      updatedBy: userId,
    });
    await record.save();
  }

  await recordAuditEvent({
    eventType: AUDIT_EVENTS.PRIVATE_DATA_UPSERT,
    actorUserId: userId,
    firmId,
    resourceType: 'plotPrivate',
    resourceId: String(plotId),
    action: 'upsert',
    metadata: { plotId: String(plotId) },
  });

  return record.toSafeObject();
}

/**
 * Partially updates private owner/source details for a plot (PATCH).
 */
export async function patchPlotPrivate({ plotId, firmId, data, userId }) {
  if (!isValidObjectId(plotId)) {
    const error = new Error('Plot not found');
    error.statusCode = 404;
    error.code = 'PLOT_NOT_FOUND';
    throw error;
  }

  // 1. Verify parent plot exists and belongs to this firm
  const plot = await Plot.findOne({ _id: plotId, firmId });
  if (!plot) {
    const error = new Error('Plot not found');
    error.statusCode = 404;
    error.code = 'PLOT_NOT_FOUND';
    throw error;
  }

  // 2. Find existing private record
  const record = await PlotPrivate.findOne({ plotId, firmId });
  if (!record) {
    const error = new Error('Private details not found for this plot');
    error.statusCode = 404;
    error.code = 'PRIVATE_RECORD_NOT_FOUND';
    throw error;
  }

  // 3. Partial updates on owner
  if (data.owner) {
    if (data.owner.name !== undefined) record.owner.name = data.owner.name;
    if (data.owner.phone !== undefined) record.owner.phone = data.owner.phone;
    if (data.owner.email !== undefined) record.owner.email = data.owner.email;
    if (data.owner.address !== undefined) record.owner.address = data.owner.address;
  }
  if (data.ownerName !== undefined) record.owner.name = data.ownerName;
  if (data.ownerPhone !== undefined) record.owner.phone = data.ownerPhone;
  if (data.ownerEmail !== undefined) record.owner.email = data.ownerEmail;
  if (data.ownerAddress !== undefined) record.owner.address = data.ownerAddress;

  // 4. Partial updates on source
  if (data.source) {
    if (data.source.name !== undefined) record.source.name = data.source.name;
    if (data.source.phone !== undefined) record.source.phone = data.source.phone;
    if (data.source.email !== undefined) record.source.email = data.source.email;
    if (data.source.type !== undefined) record.source.type = data.source.type;
  }
  if (data.sourceName !== undefined) record.source.name = data.sourceName;
  if (data.sourcePhone !== undefined) record.source.phone = data.sourcePhone;
  if (data.sourceEmail !== undefined) record.source.email = data.sourceEmail;
  if (data.sourceType !== undefined) record.source.type = data.sourceType;

  // 5. Notes
  if (data.notes !== undefined) record.notes = data.notes;

  record.updatedBy = userId;
  await record.save();

  await recordAuditEvent({
    eventType: AUDIT_EVENTS.PRIVATE_DATA_UPDATED,
    actorUserId: userId,
    firmId,
    resourceType: 'plotPrivate',
    resourceId: String(plotId),
    action: 'update',
    metadata: { plotId: String(plotId) },
  });

  return record.toSafeObject();
}

/**
 * Removes private details for a plot (DELETE).
 */
export async function deletePlotPrivate({ plotId, firmId }) {
  if (!isValidObjectId(plotId)) {
    const error = new Error('Plot not found');
    error.statusCode = 404;
    error.code = 'PLOT_NOT_FOUND';
    throw error;
  }

  // Verify plot belongs to this firm
  const plot = await Plot.findOne({ _id: plotId, firmId });
  if (!plot) {
    const error = new Error('Plot not found');
    error.statusCode = 404;
    error.code = 'PLOT_NOT_FOUND';
    throw error;
  }

  const record = await PlotPrivate.findOneAndDelete({ plotId, firmId });
  if (!record) {
    const error = new Error('Private details not found for this plot');
    error.statusCode = 404;
    error.code = 'PRIVATE_RECORD_NOT_FOUND';
    throw error;
  }

  await recordAuditEvent({
    eventType: AUDIT_EVENTS.PRIVATE_DATA_DELETED,
    firmId,
    resourceType: 'plotPrivate',
    resourceId: String(plotId),
    action: 'delete',
    metadata: { plotId: String(plotId) },
  });

  return { message: 'Private details removed successfully' };
}

export default {
  getPlotPrivate,
  putPlotPrivate,
  patchPlotPrivate,
  deletePlotPrivate,
};
