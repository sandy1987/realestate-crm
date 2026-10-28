/**
 * src/services/colony.service.js
 *
 * Colony management service.
 * Enforces firm scoping, duplicate name prevention within a firm,
 * and active plot dependency checks before deactivation.
 */

import { Colony } from '../models/Colony.model.js';
import { Plot } from '../models/Plot.model.js';
import { isValidObjectId } from '../utils/objectId.js';
import { parsePagination, buildPaginationMeta } from '../utils/paginate.js';
import { recordAuditEvent } from './audit.service.js';
import { AUDIT_EVENTS } from '../constants/auditEvents.js';

function escapeRegex(str) {
  return typeof str === 'string' ? str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') : '';
}

/**
 * Creates a new colony within the authenticated firm.
 */
export async function createColony({ firmId, data, userId }) {
  // Check for duplicate colony name within this firm (case-insensitive)
  const existing = await Colony.findOne({
    firmId,
    name: { $regex: new RegExp(`^${escapeRegex(data.name)}$`, 'i') },
  });

  if (existing) {
    const error = new Error('A colony with this name already exists in your firm');
    error.statusCode = 409;
    error.code = 'COLONY_NAME_CONFLICT';
    throw error;
  }

  const effectiveMapUrl = data.mapImageUrl || data.mapImage?.url || null;
  const effectiveMapImage = data.mapImage?.url
    ? data.mapImage
    : effectiveMapUrl
    ? { url: effectiveMapUrl, publicId: data.mapImage?.publicId || null }
    : null;

  const colony = new Colony({
    name: data.name,
    description: data.description ?? null,
    address: data.address ?? null,
    city: data.city ?? null,
    state: data.state ?? null,
    country: data.country ?? 'India',
    pincode: data.pincode ?? null,
    mapImageUrl: effectiveMapUrl,
    mapImage: effectiveMapImage,
    isActive: true,
    firmId,
    createdBy: userId,
    updatedBy: userId,
  });

  await colony.save();

  await recordAuditEvent({
    eventType: AUDIT_EVENTS.COLONY_CREATED,
    actorUserId: userId,
    firmId,
    resourceType: 'colony',
    resourceId: colony._id.toString(),
    action: 'create',
    metadata: { colonyName: colony.name },
  });

  return colony.toSafeObject();
}

/**
 * Lists colonies within the authenticated firm with pagination, searching, and filters.
 */
export async function listColonies({ firmId, query = {} }) {
  const allowedSortFields = ['createdAt', 'name', 'city', 'state', 'isActive'];
  const { page, limit, skip, sortBy, sortOrder } = parsePagination(query, allowedSortFields);

  const filter = { firmId };

  if (query.search) {
    const searchRegex = new RegExp(escapeRegex(query.search), 'i');
    filter.$or = [
      { name: searchRegex },
      { city: searchRegex },
      { state: searchRegex },
      { address: searchRegex },
    ];
  }

  if (query.isActive !== undefined) {
    filter.isActive = query.isActive === 'true' || query.isActive === true;
  }

  if (query.city) {
    filter.city = new RegExp(escapeRegex(query.city), 'i');
  }

  if (query.state) {
    filter.state = new RegExp(escapeRegex(query.state), 'i');
  }

  const [total, items] = await Promise.all([
    Colony.countDocuments(filter),
    Colony.find(filter)
      .sort({ [sortBy]: sortOrder === 'asc' ? 1 : -1 })
      .skip(skip)
      .limit(limit),
  ]);

  return {
    items: items.map((colony) => colony.toSafeObject()),
    meta: buildPaginationMeta(total, page, limit),
  };
}

/**
 * Retrieves a single colony by ID, strictly scoped to the authenticated firm.
 */
export async function getColonyById({ colonyId, firmId }) {
  if (!isValidObjectId(colonyId)) {
    const error = new Error('Colony not found');
    error.statusCode = 404;
    error.code = 'COLONY_NOT_FOUND';
    throw error;
  }

  const colony = await Colony.findOne({ _id: colonyId, firmId });
  if (!colony) {
    const error = new Error('Colony not found');
    error.statusCode = 404;
    error.code = 'COLONY_NOT_FOUND';
    throw error;
  }

  return colony.toSafeObject();
}

/**
 * Updates an existing colony within the authenticated firm.
 */
export async function updateColony({ colonyId, firmId, data, userId }) {
  if (!isValidObjectId(colonyId)) {
    const error = new Error('Colony not found');
    error.statusCode = 404;
    error.code = 'COLONY_NOT_FOUND';
    throw error;
  }

  const colony = await Colony.findOne({ _id: colonyId, firmId });
  if (!colony) {
    const error = new Error('Colony not found');
    error.statusCode = 404;
    error.code = 'COLONY_NOT_FOUND';
    throw error;
  }

  // If name is being changed, verify uniqueness within the firm
  if (data.name && data.name.toLowerCase() !== colony.name.toLowerCase()) {
    const existing = await Colony.findOne({
      firmId,
      name: { $regex: new RegExp(`^${escapeRegex(data.name)}$`, 'i') },
      _id: { $ne: colonyId },
    });

    if (existing) {
      const error = new Error('A colony with this name already exists in your firm');
      error.statusCode = 409;
      error.code = 'COLONY_NAME_CONFLICT';
      throw error;
    }
    colony.name = data.name;
  }

  // If deactivating, ensure no active plots reference this colony
  if (data.isActive === false && colony.isActive === true) {
    const activePlotsCount = await Plot.countDocuments({
      colonyId,
      firmId,
      isActive: true,
    });

    if (activePlotsCount > 0) {
      const error = new Error('Cannot deactivate colony with active plots');
      error.statusCode = 400;
      error.code = 'COLONY_IN_USE';
      throw error;
    }
    colony.isActive = false;
  } else if (data.isActive === true) {
    colony.isActive = true;
  }

  if (data.description !== undefined) colony.description = data.description;
  if (data.address !== undefined) colony.address = data.address;
  if (data.city !== undefined) colony.city = data.city;
  if (data.state !== undefined) colony.state = data.state;
  if (data.country !== undefined) colony.country = data.country;
  if (data.pincode !== undefined) colony.pincode = data.pincode;

  if (data.mapImageUrl !== undefined || data.mapImage !== undefined) {
    const effectiveMapUrl = data.mapImageUrl !== undefined ? data.mapImageUrl : data.mapImage?.url || null;
    colony.mapImageUrl = effectiveMapUrl;
    colony.mapImage = data.mapImage?.url
      ? data.mapImage
      : effectiveMapUrl
      ? { url: effectiveMapUrl, publicId: data.mapImage?.publicId || null }
      : null;
  }

  colony.updatedBy = userId;
  await colony.save();

  await recordAuditEvent({
    eventType: AUDIT_EVENTS.COLONY_UPDATED,
    actorUserId: userId,
    firmId,
    resourceType: 'colony',
    resourceId: colony._id.toString(),
    action: 'update',
    metadata: { colonyName: colony.name },
  });

  return colony.toSafeObject();
}

/**
 * Deactivates a colony (soft deletion), ensuring no active plots depend on it.
 */
export async function deactivateColony({ colonyId, firmId, userId }) {
  if (!isValidObjectId(colonyId)) {
    const error = new Error('Colony not found');
    error.statusCode = 404;
    error.code = 'COLONY_NOT_FOUND';
    throw error;
  }

  const colony = await Colony.findOne({ _id: colonyId, firmId });
  if (!colony) {
    const error = new Error('Colony not found');
    error.statusCode = 404;
    error.code = 'COLONY_NOT_FOUND';
    throw error;
  }

  // Prevent deactivation if active plots exist
  const activePlotsCount = await Plot.countDocuments({
    colonyId,
    firmId,
    isActive: true,
  });

  if (activePlotsCount > 0) {
    const error = new Error('Cannot deactivate colony with active plots');
    error.statusCode = 400;
    error.code = 'COLONY_IN_USE';
    throw error;
  }

  colony.isActive = false;
  colony.updatedBy = userId;
  await colony.save();

  await recordAuditEvent({
    eventType: AUDIT_EVENTS.COLONY_DELETED,
    actorUserId: userId,
    firmId,
    resourceType: 'colony',
    resourceId: colony._id.toString(),
    action: 'deactivate',
    metadata: { colonyName: colony.name },
  });

  return colony.toSafeObject();
}

export default {
  createColony,
  listColonies,
  getColonyById,
  updateColony,
  deactivateColony,
};
