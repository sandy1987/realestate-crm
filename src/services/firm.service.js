/**
 * src/services/firm.service.js
 *
 * Firm tenant provisioning and platform administration service.
 */

import { Firm } from '../models/Firm.model.js';
import { User } from '../models/User.model.js';
import { ROLES } from '../constants/roles.js';
import { isValidObjectId } from '../utils/objectId.js';
import { parsePagination, buildPaginationMeta } from '../utils/paginate.js';
import { hashPassword } from '../utils/password.js';
import { recordAuditEvent } from './audit.service.js';
import { AUDIT_EVENTS } from '../constants/auditEvents.js';

/**
 * Provisions a new firm tenant organization.
 * Optionally provisions the first FIRM_ADMIN simultaneously.
 *
 * @param {object} params
 * @param {string} params.name
 * @param {string} params.slug
 * @param {string|null} [params.contactEmail]
 * @param {string|null} [params.contactPhone]
 * @param {object} [params.settings]
 * @param {string} [params.adminEmail]
 * @param {string} [params.adminPassword]
 * @param {string} [params.adminFirstName]
 * @param {string} [params.adminLastName]
 * @param {string|mongoose.Types.ObjectId} [params.creatorId]
 * @returns {Promise<{ firm: object, admin?: object }>}
 */
export async function provisionFirm({
  name,
  slug,
  contactEmail = null,
  contactPhone = null,
  settings,
  adminEmail,
  adminPassword,
  adminFirstName,
  adminLastName,
  creatorId = null,
}) {
  const normalizedSlug = slug.trim().toLowerCase();

  // 1. Verify slug uniqueness
  const existingFirm = await Firm.findOne({ slug: normalizedSlug });
  if (existingFirm) {
    const error = new Error(`Firm with slug '${normalizedSlug}' already exists`);
    error.statusCode = 409;
    error.code = 'CONFLICT';
    throw error;
  }

  // 2. If initial admin is requested, verify admin email uniqueness
  if (adminEmail) {
    const normalizedAdminEmail = adminEmail.trim().toLowerCase();
    const existingUser = await User.findOne({ email: normalizedAdminEmail });
    if (existingUser) {
      const error = new Error(`User with email '${normalizedAdminEmail}' already exists`);
      error.statusCode = 409;
      error.code = 'CONFLICT';
      throw error;
    }
  }

  // 3. Create firm document
  const firm = await Firm.create({
    name,
    slug: normalizedSlug,
    contactEmail,
    contactPhone,
    settings,
    createdBy: creatorId,
  });

  // 4. Optionally create initial FIRM_ADMIN
  let adminSafe = null;
  if (adminEmail && adminPassword) {
    const passwordHash = await hashPassword(adminPassword);
    const admin = await User.create({
      email: adminEmail.trim().toLowerCase(),
      passwordHash,
      role: ROLES.FIRM_ADMIN,
      firmId: firm._id,
      firstName: adminFirstName || null,
      lastName: adminLastName || null,
      createdBy: creatorId,
    });
    adminSafe = admin.toSafeObject();
  }

  const result = { firm: firm.toSafeObject() };
  if (adminSafe) {
    result.admin = adminSafe;
  }

  await recordAuditEvent({
    eventType: AUDIT_EVENTS.FIRM_PROVISIONED,
    actorUserId: creatorId,
    actorRole: ROLES.SUPER_ADMIN,
    firmId: firm._id,
    resourceType: 'firm',
    resourceId: firm._id.toString(),
    action: 'provision',
    metadata: { firmName: firm.name, slug: firm.slug },
  });

  return result;
}

/**
 * Lists all firms with pagination for platform administrators.
 *
 * @param {object} query - Express req.query
 * @returns {Promise<{ items: object[], meta: object }>}
 */
export async function listFirms(query = {}) {
  const allowedSortFields = ['createdAt', 'name', 'slug', 'isActive'];
  const { page, limit, skip, sortBy, sortOrder } = parsePagination(query, allowedSortFields);

  const filter = {};
  if (query.search && typeof query.search === 'string') {
    const searchRegex = new RegExp(query.search.trim(), 'i');
    filter.$or = [{ name: searchRegex }, { slug: searchRegex }];
  }

  const [total, firms] = await Promise.all([
    Firm.countDocuments(filter),
    Firm.find(filter)
      .sort({ [sortBy]: sortOrder === 'asc' ? 1 : -1 })
      .skip(skip)
      .limit(limit),
  ]);

  return {
    items: firms.map((f) => f.toSafeObject()),
    meta: buildPaginationMeta(total, page, limit),
  };
}

/**
 * Retrieves a single firm by its ObjectId.
 *
 * @param {string} firmId
 * @returns {Promise<object>}
 */
export async function getFirmById(firmId) {
  if (!isValidObjectId(firmId)) {
    const error = new Error('Invalid firm identifier format');
    error.statusCode = 400;
    error.code = 'INVALID_IDENTIFIER';
    throw error;
  }

  const firm = await Firm.findById(firmId);
  if (!firm) {
    const error = new Error('Firm not found');
    error.statusCode = 404;
    error.code = 'FIRM_NOT_FOUND';
    throw error;
  }

  return firm.toSafeObject();
}

/**
 * Suspends a firm (disables access for all firm members).
 *
 * @param {string} firmId
 * @returns {Promise<object>}
 */
export async function suspendFirm(firmId) {
  if (!isValidObjectId(firmId)) {
    const error = new Error('Invalid firm identifier format');
    error.statusCode = 400;
    error.code = 'INVALID_IDENTIFIER';
    throw error;
  }

  const firm = await Firm.findById(firmId);
  if (!firm) {
    const error = new Error('Firm not found');
    error.statusCode = 404;
    error.code = 'FIRM_NOT_FOUND';
    throw error;
  }

  firm.isActive = false;
  await firm.save();

  await recordAuditEvent({
    eventType: AUDIT_EVENTS.FIRM_SUSPENDED,
    firmId: firm._id,
    resourceType: 'firm',
    resourceId: firm._id.toString(),
    action: 'suspend',
    metadata: { slug: firm.slug },
  });

  return firm.toSafeObject();
}

/**
 * Activates a suspended firm.
 *
 * @param {string} firmId
 * @returns {Promise<object>}
 */
export async function activateFirm(firmId) {
  if (!isValidObjectId(firmId)) {
    const error = new Error('Invalid firm identifier format');
    error.statusCode = 400;
    error.code = 'INVALID_IDENTIFIER';
    throw error;
  }

  const firm = await Firm.findById(firmId);
  if (!firm) {
    const error = new Error('Firm not found');
    error.statusCode = 404;
    error.code = 'FIRM_NOT_FOUND';
    throw error;
  }

  firm.isActive = true;
  await firm.save();

  await recordAuditEvent({
    eventType: AUDIT_EVENTS.FIRM_ACTIVATED,
    firmId: firm._id,
    resourceType: 'firm',
    resourceId: firm._id.toString(),
    action: 'activate',
    metadata: { slug: firm.slug },
  });

  return firm.toSafeObject();
}

export default {
  provisionFirm,
  listFirms,
  getFirmById,
  suspendFirm,
  activateFirm,
};
