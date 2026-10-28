/**
 * src/services/firmUser.service.js
 *
 * Firm-scoped user administration service.
 * Enforces strict multi-tenant boundaries:
 *  - All queries are double-fenced with firmId.
 *  - Firm administrators can only create FIRM_STAFF accounts.
 *  - Prevents promotion to SUPER_ADMIN or cross-firm access.
 *  - Automatically revokes refresh tokens on staff deactivation/suspension.
 */

import { User } from '../models/User.model.js';
import { ROLES } from '../constants/roles.js';
import { isValidObjectId } from '../utils/objectId.js';
import { hashPassword } from '../utils/password.js';
import { parsePagination, buildPaginationMeta } from '../utils/paginate.js';
import { revokeAllUserTokens } from './token.service.js';
import { recordAuditEvent } from './audit.service.js';
import { AUDIT_EVENTS } from '../constants/auditEvents.js';

function escapeRegex(str) {
  return typeof str === 'string' ? str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') : '';
}

/**
 * Creates a new FIRM_STAFF account within the authenticated firm.
 */
export async function createStaffUser({ firmId, data, creatorId }) {
  const email = (data.email || '').trim().toLowerCase();

  // Enforce global email uniqueness
  const existing = await User.findOne({ email });
  if (existing) {
    const error = new Error('A user with this email address already exists');
    error.statusCode = 409;
    error.code = 'EMAIL_ALREADY_EXISTS';
    throw error;
  }

  // Hash password using Argon2id
  const passwordHash = await hashPassword(data.password);

  const user = new User({
    email,
    passwordHash,
    role: ROLES.FIRM_STAFF, // Tenant admins can only create FIRM_STAFF
    firmId,
    permissions: data.permissions || [],
    firstName: data.firstName ?? null,
    lastName: data.lastName ?? null,
    isActive: true,
    isSuspended: false,
    createdBy: creatorId,
  });

  await user.save();

  await recordAuditEvent({
    eventType: AUDIT_EVENTS.USER_CREATED,
    actorUserId: creatorId,
    firmId,
    resourceType: 'user',
    resourceId: user._id.toString(),
    action: 'create',
    metadata: { targetEmail: user.email, targetRole: user.role },
  });

  return user.toSafeObject();
}

/**
 * Lists all users belonging to the authenticated firm with pagination and filters.
 */
export async function listFirmUsers({ firmId, query = {} }) {
  const allowedSortFields = [
    'createdAt',
    'email',
    'firstName',
    'lastName',
    'role',
    'isActive',
    'lastLoginAt',
  ];

  const { page, limit, skip, sortBy, sortOrder } = parsePagination(query, allowedSortFields);

  const filter = { firmId };

  if (query.search) {
    const searchRegex = new RegExp(escapeRegex(query.search), 'i');
    filter.$or = [
      { email: searchRegex },
      { firstName: searchRegex },
      { lastName: searchRegex },
    ];
  }

  if (query.role) {
    filter.role = query.role;
  }

  if (query.isActive !== undefined) {
    filter.isActive = query.isActive === 'true' || query.isActive === true;
  }

  if (query.isSuspended !== undefined) {
    filter.isSuspended = query.isSuspended === 'true' || query.isSuspended === true;
  }

  const [total, items] = await Promise.all([
    User.countDocuments(filter),
    User.find(filter)
      .sort({ [sortBy]: sortOrder === 'asc' ? 1 : -1 })
      .skip(skip)
      .limit(limit),
  ]);

  return {
    items: items.map((user) => user.toSafeObject()),
    meta: buildPaginationMeta(total, page, limit),
  };
}

/**
 * Retrieves a single user strictly scoped to the authenticated firm.
 */
export async function getFirmUserById({ userId, firmId }) {
  if (!isValidObjectId(userId)) {
    const error = new Error('User not found');
    error.statusCode = 404;
    error.code = 'USER_NOT_FOUND';
    throw error;
  }

  const user = await User.findOne({ _id: userId, firmId });
  if (!user) {
    const error = new Error('User not found');
    error.statusCode = 404;
    error.code = 'USER_NOT_FOUND';
    throw error;
  }

  return user.toSafeObject();
}

/**
 * Updates profile and permission fields for a user belonging to the authenticated firm.
 */
export async function updateFirmUser({ userId, firmId, data, actorUserId = null, actorRole = null }) {
  if (!isValidObjectId(userId)) {
    const error = new Error('User not found');
    error.statusCode = 404;
    error.code = 'USER_NOT_FOUND';
    throw error;
  }

  const user = await User.findOne({ _id: userId, firmId });
  if (!user) {
    const error = new Error('User not found');
    error.statusCode = 404;
    error.code = 'USER_NOT_FOUND';
    throw error;
  }

  if (data.firstName !== undefined) user.firstName = data.firstName;
  if (data.lastName !== undefined) user.lastName = data.lastName;
  if (data.permissions !== undefined) user.permissions = data.permissions;

  await user.save();

  await recordAuditEvent({
    eventType: AUDIT_EVENTS.USER_UPDATED,
    actorUserId,
    actorRole,
    firmId,
    resourceType: 'user',
    resourceId: user._id.toString(),
    action: 'update',
    metadata: {
      updatedFields: Object.keys(data).filter((k) => data[k] !== undefined),
    },
  });

  return user.toSafeObject();
}

/**
 * Activates or deactivates / suspends a user belonging to the authenticated firm.
 */
export async function updateFirmUserStatus({ userId, firmId, data, currentUserId, actorRole = null }) {
  if (!isValidObjectId(userId)) {
    const error = new Error('User not found');
    error.statusCode = 404;
    error.code = 'USER_NOT_FOUND';
    throw error;
  }

  const user = await User.findOne({ _id: userId, firmId });
  if (!user) {
    const error = new Error('User not found');
    error.statusCode = 404;
    error.code = 'USER_NOT_FOUND';
    throw error;
  }

  // Prevent administrator from modifying their own active/suspended status
  if (user._id.toString() === currentUserId.toString()) {
    const error = new Error('Administrators cannot deactivate or suspend their own account');
    error.statusCode = 400;
    error.code = 'CANNOT_MODIFY_OWN_STATUS';
    throw error;
  }

  if (data.isActive !== undefined) user.isActive = data.isActive;
  if (data.isSuspended !== undefined) user.isSuspended = data.isSuspended;

  // If user is deactivated or suspended, revoke all active refresh-token sessions
  if (!user.isActive || user.isSuspended) {
    await revokeAllUserTokens(user._id);
  }

  await user.save();

  const isSuspension = data.isSuspended === true || data.isActive === false;
  await recordAuditEvent({
    eventType: isSuspension ? AUDIT_EVENTS.USER_SUSPENDED : AUDIT_EVENTS.USER_ACTIVATED,
    actorUserId: currentUserId,
    actorRole,
    firmId,
    resourceType: 'user',
    resourceId: user._id.toString(),
    action: isSuspension ? 'suspend' : 'activate',
    metadata: {
      isActive: user.isActive,
      isSuspended: user.isSuspended,
    },
  });

  return user.toSafeObject();
}

export default {
  createStaffUser,
  listFirmUsers,
  getFirmUserById,
  updateFirmUser,
  updateFirmUserStatus,
};
