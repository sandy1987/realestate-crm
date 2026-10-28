/**
 * src/services/audit.service.js
 *
 * Audit logging and retrieval service.
 * Enforces metadata sanitization, immutable persistence,
 * and tenant-scoped audit querying.
 */

import { AuditLog } from '../models/AuditLog.model.js';
import { ALL_AUDIT_EVENTS } from '../constants/auditEvents.js';
import { logger } from '../config/logger.js';
import { isValidObjectId } from '../utils/objectId.js';
import { parsePagination, buildPaginationMeta } from '../utils/paginate.js';

// Keys that are strictly forbidden in audit log metadata
const FORBIDDEN_METADATA_KEYS = new Set([
  'password',
  'passwordhash',
  'token',
  'refreshtoken',
  'tokenhash',
  'owner',
  'source',
  'notes',
  'ownerphone',
  'owneremail',
  'owneraddress',
  'sourcephone',
  'sourceemail',
  'sourcetype',
  'nationalid',
  'aadhaar',
  'ssn',
  'authorization',
  'cookie',
]);

/**
 * Sanitizes arbitrary metadata object, removing any sensitive fields.
 *
 * @param {object} metadata
 * @returns {object} Clean metadata
 */
export function sanitizeAuditMetadata(metadata = {}) {
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) {
    return {};
  }

  const clean = {};
  for (const [key, val] of Object.entries(metadata)) {
    if (FORBIDDEN_METADATA_KEYS.has(key.toLowerCase())) {
      continue;
    }
    // Deep sanitize nested objects
    if (val && typeof val === 'object' && !Array.isArray(val) && !(val instanceof Date)) {
      clean[key] = sanitizeAuditMetadata(val);
    } else {
      clean[key] = val;
    }
  }
  return clean;
}

/**
 * Records an audit event safely.
 * Will not throw or disrupt primary business flow if persistence fails.
 */
export async function recordAuditEvent({
  eventType,
  actorUserId = null,
  actorRole = null,
  firmId = null,
  resourceType,
  resourceId = null,
  action,
  outcome = 'success',
  requestId = null,
  ipAddress = null,
  userAgent = null,
  metadata = {},
}, { strict = false } = {}) {
  if (!ALL_AUDIT_EVENTS.includes(eventType)) {
    logger.warn({ eventType }, 'Attempted to record unapproved audit event type');
    throw new Error(`Unapproved audit event type: ${eventType}`);
  }

  try {
    const sanitizedMeta = sanitizeAuditMetadata(metadata);

    const log = new AuditLog({
      eventType,
      actorUserId: actorUserId && isValidObjectId(actorUserId) ? actorUserId : null,
      actorRole,
      firmId: firmId && isValidObjectId(firmId) ? firmId : null,
      resourceType,
      resourceId: resourceId ? String(resourceId) : null,
      action,
      outcome,
      requestId,
      ipAddress,
      userAgent,
      metadata: sanitizedMeta,
    });

    await log.save();
    return log.toSafeObject();
  } catch (err) {
    logger.error({ err, eventType, resourceType }, 'Audit log recording failed');
    if (strict) {
      throw new Error(`Strict audit persistence failed for event '${eventType}': ${err.message}`);
    }
    return null;
  }
}

/**
 * Lists audit logs for an authenticated firm with pagination and filters.
 */
export async function listFirmAuditLogs({ firmId, query = {} }) {
  const allowedSortFields = ['createdAt', 'eventType', 'resourceType', 'outcome', 'action'];
  const { page, limit, skip, sortBy, sortOrder } = parsePagination(query, allowedSortFields);

  const filter = { firmId };

  if (query.eventType) {
    filter.eventType = query.eventType;
  }

  if (query.actorUserId && isValidObjectId(query.actorUserId)) {
    filter.actorUserId = query.actorUserId;
  }

  if (query.resourceType) {
    filter.resourceType = query.resourceType;
  }

  if (query.resourceId) {
    filter.resourceId = query.resourceId;
  }

  if (query.outcome) {
    filter.outcome = query.outcome;
  }

  if (query.dateFrom || query.dateTo) {
    filter.createdAt = {};
    if (query.dateFrom) {
      const fromDate = new Date(query.dateFrom);
      if (!isNaN(fromDate.getTime())) {
        filter.createdAt.$gte = fromDate;
      }
    }
    if (query.dateTo) {
      const toDate = new Date(query.dateTo);
      if (!isNaN(toDate.getTime())) {
        filter.createdAt.$lte = toDate;
      }
    }
  }

  const [total, items] = await Promise.all([
    AuditLog.countDocuments(filter),
    AuditLog.find(filter)
      .sort({ [sortBy]: sortOrder === 'asc' ? 1 : -1 })
      .skip(skip)
      .limit(limit),
  ]);

  return {
    items: items.map((log) => log.toSafeObject()),
    meta: buildPaginationMeta(total, page, limit),
  };
}

/**
 * Lists audit logs for platform administrators (SUPER_ADMIN only).
 */
export async function listPlatformAuditLogs({ query = {} }) {
  const allowedSortFields = ['createdAt', 'eventType', 'resourceType', 'outcome', 'action'];
  const { page, limit, skip, sortBy, sortOrder } = parsePagination(query, allowedSortFields);

  const filter = {};

  if (query.platformOnly === 'true') {
    filter.firmId = null;
  } else if (query.firmId && isValidObjectId(query.firmId)) {
    filter.firmId = query.firmId;
  }

  if (query.eventType) {
    filter.eventType = query.eventType;
  }

  if (query.actorUserId && isValidObjectId(query.actorUserId)) {
    filter.actorUserId = query.actorUserId;
  }

  if (query.resourceType) {
    filter.resourceType = query.resourceType;
  }

  if (query.resourceId) {
    filter.resourceId = query.resourceId;
  }

  if (query.outcome) {
    filter.outcome = query.outcome;
  }

  if (query.dateFrom || query.dateTo) {
    filter.createdAt = {};
    if (query.dateFrom) {
      const fromDate = new Date(query.dateFrom);
      if (!isNaN(fromDate.getTime())) {
        filter.createdAt.$gte = fromDate;
      }
    }
    if (query.dateTo) {
      const toDate = new Date(query.dateTo);
      if (!isNaN(toDate.getTime())) {
        filter.createdAt.$lte = toDate;
      }
    }
  }

  const [total, items] = await Promise.all([
    AuditLog.countDocuments(filter),
    AuditLog.find(filter)
      .sort({ [sortBy]: sortOrder === 'asc' ? 1 : -1 })
      .skip(skip)
      .limit(limit),
  ]);

  return {
    items: items.map((log) => log.toSafeObject()),
    meta: buildPaginationMeta(total, page, limit),
  };
}

export default {
  sanitizeAuditMetadata,
  recordAuditEvent,
  listFirmAuditLogs,
  listPlatformAuditLogs,
};
