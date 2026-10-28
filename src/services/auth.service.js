/**
 * src/services/auth.service.js
 *
 * Authentication business logic: login with timing attack protection,
 * token rotation, logout, me lookup, and authenticated password changes.
 */

import { User } from '../models/User.model.js';
import { RefreshToken } from '../models/RefreshToken.model.js';
import { verifyDummyPassword, hashPassword } from '../utils/password.js';
import {
  generateAccessToken,
  createRefreshTokenSession,
  rotateRefreshToken,
  revokeRefreshToken,
  revokeAllUserTokens,
  hashToken,
} from './token.service.js';
import { recordAuditEvent } from './audit.service.js';
import { AUDIT_EVENTS } from '../constants/auditEvents.js';

/**
 * Authenticates a user by email and password.
 * Employs timing-equalization if the requested account does not exist.
 *
 * @param {object} params
 * @param {string} params.email
 * @param {string} params.password
 * @param {string|null} [params.ipAddress]
 * @param {string|null} [params.userAgent]
 * @returns {Promise<{ user: object, accessToken: string, refreshToken: string, expiresAt: Date }>}
 */
export async function login({ email, password, ipAddress = null, userAgent = null }) {
  const normalizedEmail = email.trim().toLowerCase();

  // Find user and explicitly select passwordHash
  const user = await User.findOne({ email: normalizedEmail }).select('+passwordHash');

  if (!user) {
    // Timing defense: execute dummy argon2 verify to prevent timing enumeration
    await verifyDummyPassword(password);
    await recordAuditEvent({
      eventType: AUDIT_EVENTS.AUTH_LOGIN_FAILURE,
      actorUserId: null,
      firmId: null,
      resourceType: 'user',
      action: 'login',
      outcome: 'failure',
      metadata: { email: normalizedEmail, reason: 'user_not_found', ipAddress, userAgent },
    });
    const error = new Error('Invalid email or password');
    error.statusCode = 401;
    error.code = 'INVALID_CREDENTIALS';
    throw error;
  }

  // Account status check
  if (!user.isActive || user.isSuspended) {
    await recordAuditEvent({
      eventType: AUDIT_EVENTS.AUTH_LOGIN_FAILURE,
      actorUserId: user._id.toString(),
      actorRole: user.role,
      firmId: user.firmId,
      resourceType: 'user',
      resourceId: user._id.toString(),
      action: 'login',
      outcome: 'failure',
      metadata: { email: normalizedEmail, reason: 'account_disabled', ipAddress, userAgent },
    });
    const error = new Error('Your account has been deactivated or suspended');
    error.statusCode = 403;
    error.code = 'ACCOUNT_DISABLED';
    throw error;
  }

  // Password verification
  const isMatch = await user.verifyPassword(password);
  if (!isMatch) {
    await recordAuditEvent({
      eventType: AUDIT_EVENTS.AUTH_LOGIN_FAILURE,
      actorUserId: user._id.toString(),
      actorRole: user.role,
      firmId: user.firmId,
      resourceType: 'user',
      resourceId: user._id.toString(),
      action: 'login',
      outcome: 'failure',
      metadata: { email: normalizedEmail, reason: 'invalid_credentials', ipAddress, userAgent },
    });
    const error = new Error('Invalid email or password');
    error.statusCode = 401;
    error.code = 'INVALID_CREDENTIALS';
    throw error;
  }

  // Update last login timestamp
  user.lastLoginAt = new Date();
  await user.save();

  // Issue tokens
  const accessToken = generateAccessToken(user);
  const refreshSession = await createRefreshTokenSession({
    user,
    ipAddress,
    userAgent,
  });

  await recordAuditEvent({
    eventType: AUDIT_EVENTS.AUTH_LOGIN_SUCCESS,
    actorUserId: user._id.toString(),
    actorRole: user.role,
    firmId: user.firmId,
    resourceType: 'user',
    resourceId: user._id.toString(),
    action: 'login',
    outcome: 'success',
    metadata: { email: user.email, ipAddress, userAgent },
  });

  return {
    user: user.toSafeObject(),
    accessToken,
    refreshToken: refreshSession.refreshToken,
    expiresAt: refreshSession.expiresAt,
  };
}

/**
 * Rotates a refresh token and returns a new access + refresh token pair.
 *
 * @param {object} params
 * @param {string} params.refreshToken
 * @param {string|null} [params.ipAddress]
 * @param {string|null} [params.userAgent]
 * @returns {Promise<object>}
 */
export async function refresh({ refreshToken, ipAddress = null, userAgent = null }) {
  return rotateRefreshToken(refreshToken, { ipAddress, userAgent });
}

/**
 * Logs out a user by revoking the specified refresh token session.
 *
 * @param {object} params
 * @param {string} params.refreshToken
 * @returns {Promise<boolean>}
 */
export async function logout({ refreshToken }) {
  const tokenHash = hashToken(refreshToken);
  const tokenDoc = await RefreshToken.findOne({ tokenHash });
  const result = await revokeRefreshToken(refreshToken);

  if (tokenDoc) {
    const user = await User.findById(tokenDoc.userId);
    await recordAuditEvent({
      eventType: AUDIT_EVENTS.AUTH_LOGOUT,
      actorUserId: tokenDoc.userId.toString(),
      actorRole: user?.role || null,
      firmId: user?.firmId || null,
      resourceType: 'user',
      resourceId: tokenDoc.userId.toString(),
      action: 'logout',
      outcome: 'success',
    });
  }

  return result;
}

/**
 * Retrieves the current user's profile identity.
 *
 * @param {string} userId
 * @returns {Promise<object>} Safe user profile
 */
export async function getMe(userId) {
  const user = await User.findById(userId);

  if (!user) {
    const error = new Error('User not found');
    error.statusCode = 404;
    error.code = 'USER_NOT_FOUND';
    throw error;
  }

  if (!user.isActive || user.isSuspended) {
    const error = new Error('Account has been deactivated or suspended');
    error.statusCode = 403;
    error.code = 'ACCOUNT_DISABLED';
    throw error;
  }

  return user.toSafeObject();
}

/**
 * Changes an authenticated user's password and revokes all active refresh tokens.
 *
 * @param {string} userId
 * @param {object} params
 * @param {string} params.currentPassword
 * @param {string} params.newPassword
 * @param {string|null} [actorRole]
 * @returns {Promise<{ message: string }>}
 */
export async function changePassword(userId, { currentPassword, newPassword }, actorRole = null) {
  const user = await User.findById(userId).select('+passwordHash');

  if (!user) {
    const error = new Error('User not found');
    error.statusCode = 404;
    error.code = 'USER_NOT_FOUND';
    throw error;
  }

  const isMatch = await user.verifyPassword(currentPassword);
  if (!isMatch) {
    const error = new Error('Current password is incorrect');
    error.statusCode = 400;
    error.code = 'INVALID_CREDENTIALS';
    throw error;
  }

  // Hash new password and save
  user.passwordHash = await hashPassword(newPassword);
  await user.save();

  // Invalidate all active sessions across all devices for security
  await revokeAllUserTokens(user._id);

  await recordAuditEvent({
    eventType: AUDIT_EVENTS.AUTH_PASSWORD_CHANGED,
    actorUserId: user._id.toString(),
    actorRole: actorRole || user.role,
    firmId: user.firmId,
    resourceType: 'user',
    resourceId: user._id.toString(),
    action: 'change_password',
    outcome: 'success',
  });

  return { message: 'Password changed successfully' };
}

export default {
  login,
  refresh,
  logout,
  getMe,
  changePassword,
};
