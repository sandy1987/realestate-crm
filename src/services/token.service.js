/**
 * src/services/token.service.js
 *
 * Token lifecycle service managing JWT access tokens and cryptographically
 * secure refresh tokens with rotation and replay-attack detection.
 */

import crypto from 'node:crypto';
import jwt from 'jsonwebtoken';
import { config } from '../config/env.js';
import { RefreshToken } from '../models/RefreshToken.model.js';
import { User } from '../models/User.model.js';

/**
 * Computes a SHA-256 hash of a raw token.
 *
 * @param {string} token - Raw token string
 * @returns {string} Hex-encoded SHA-256 hash
 */
export function hashToken(token) {
  if (typeof token !== 'string' || token.length === 0) {
    throw new TypeError('Token must be a non-empty string');
  }
  return crypto.createHash('sha256').update(token).digest('hex');
}

/**
 * Parses duration strings like '15m', '7d', '1h' into milliseconds.
 *
 * @param {string|number} duration
 * @returns {number} Milliseconds
 */
export function parseDurationToMs(duration) {
  if (typeof duration === 'number') return duration;
  const match = /^(\d+)([smhd])$/.exec(String(duration).trim());
  if (!match) return 7 * 24 * 60 * 60 * 1000; // default 7 days

  const value = parseInt(match[1], 10);
  const unit = match[2];

  switch (unit) {
    case 's': return value * 1000;
    case 'm': return value * 60 * 1000;
    case 'h': return value * 60 * 60 * 1000;
    case 'd': return value * 24 * 60 * 60 * 1000;
    default:  return 7 * 24 * 60 * 60 * 1000;
  }
}

// Explicitly approved JWT algorithm
export const JWT_ALGORITHM = 'HS256';

/**
 * Generates a short-lived JWT access token for an authenticated user.
 *
 * @param {object} user - User document or safe user object
 * @returns {string} Signed JWT access token
 */
export function generateAccessToken(user) {
  const userId = user._id ? user._id.toString() : user.id;
  const firmId = user.firmId ? user.firmId.toString() : null;

  const payload = {
    sub: userId,
    role: user.role,
    firmId,
  };

  return jwt.sign(payload, config.JWT_ACCESS_SECRET, {
    algorithm: JWT_ALGORITHM,
    expiresIn: config.JWT_ACCESS_EXPIRES_IN,
  });
}

/**
 * Verifies and decodes a JWT access token, enforcing the exact approved algorithm.
 *
 * @param {string} token - JWT access token
 * @returns {object} Decoded token payload
 */
export function verifyAccessToken(token) {
  return jwt.verify(token, config.JWT_ACCESS_SECRET, {
    algorithms: [JWT_ALGORITHM],
  });
}

/**
 * Creates a new refresh token session and saves only its hash to MongoDB.
 *
 * @param {object} params
 * @param {object} params.user
 * @param {string|null} [params.ipAddress]
 * @param {string|null} [params.userAgent]
 * @returns {Promise<{ refreshToken: string, expiresAt: Date }>}
 */
export async function createRefreshTokenSession({ user, ipAddress = null, userAgent = null }) {
  // Generate 40-byte cryptographically secure random token (80 hex chars)
  const rawRefreshToken = crypto.randomBytes(40).toString('hex');
  const tokenHash = hashToken(rawRefreshToken);

  const ttlMs = parseDurationToMs(config.JWT_REFRESH_EXPIRES_IN);
  const expiresAt = new Date(Date.now() + ttlMs);

  const userId = user._id || user.id;
  const firmId = user.firmId || null;

  await RefreshToken.create({
    userId,
    firmId,
    tokenHash,
    expiresAt,
    ipAddress,
    userAgent,
    isRevoked: false,
  });

  return {
    refreshToken: rawRefreshToken,
    expiresAt,
  };
}

/**
 * Rotates an existing refresh token atomically:
 *  - Atomically claims the token via conditional single-document update
 *  - Only the request that successfully claims the unrevoked, unexpired token can issue a successor
 *  - Losing concurrent requests or replay attempts are safely rejected
 *
 * @param {string} rawToken
 * @param {object} context - { ipAddress, userAgent }
 * @returns {Promise<{ accessToken: string, refreshToken: string, expiresAt: Date, user: object }>}
 */
export async function rotateRefreshToken(rawToken, { ipAddress = null, userAgent = null } = {}) {
  const tokenHash = hashToken(rawToken);

  // 1. Atomically claim the refresh token (D-1 fix)
  // Matches only if token exists, is not revoked, and has not expired
  const claimedToken = await RefreshToken.findOneAndUpdate(
    {
      tokenHash,
      isRevoked: false,
      expiresAt: { $gt: new Date() },
    },
    {
      $set: { isRevoked: true },
    },
    { new: false } // Returns document prior to update
  );

  // 2. If the token could not be atomically claimed, determine the exact cause
  if (!claimedToken) {
    const existing = await RefreshToken.findOne({ tokenHash });

    if (!existing) {
      const error = new Error('Invalid refresh token');
      error.statusCode = 401;
      error.code = 'INVALID_TOKEN';
      throw error;
    }

    if (existing.isRevoked) {
      // Replay attack detection policy: reuse of a revoked token triggers revocation of all user sessions
      await RefreshToken.updateMany({ userId: existing.userId }, { isRevoked: true });
      const error = new Error('Refresh token has already been revoked. Suspicious activity detected.');
      error.statusCode = 401;
      error.code = 'TOKEN_REVOKED';
      throw error;
    }

    if (existing.expiresAt <= new Date()) {
      existing.isRevoked = true;
      await existing.save();
      const error = new Error('Refresh token has expired');
      error.statusCode = 401;
      error.code = 'TOKEN_EXPIRED';
      throw error;
    }

    const error = new Error('Invalid refresh token');
    error.statusCode = 401;
    error.code = 'INVALID_TOKEN';
    throw error;
  }

  // 3. Token was successfully claimed. Validate user status.
  const user = await User.findById(claimedToken.userId);
  if (!user || !user.isActive || user.isSuspended) {
    const error = new Error('User account is inactive or disabled');
    error.statusCode = 401;
    error.code = 'ACCOUNT_DISABLED';
    throw error;
  }

  // 4. Issue new token pair
  const newAccessToken = generateAccessToken(user);
  const newSession = await createRefreshTokenSession({
    user,
    ipAddress,
    userAgent,
  });

  return {
    accessToken: newAccessToken,
    refreshToken: newSession.refreshToken,
    expiresAt: newSession.expiresAt,
    user: user.toSafeObject(),
  };
}

/**
 * Revokes a refresh token session (used on logout) with explicit status validation (D-3 fix).
 *
 * @param {string} rawToken
 * @returns {Promise<boolean>} True if revoked
 */
export async function revokeRefreshToken(rawToken) {
  const tokenHash = hashToken(rawToken);
  const existing = await RefreshToken.findOne({ tokenHash });

  if (!existing) {
    const error = new Error('Invalid refresh token');
    error.statusCode = 401;
    error.code = 'INVALID_TOKEN';
    throw error;
  }

  if (existing.isRevoked) {
    const error = new Error('Refresh token has already been revoked');
    error.statusCode = 401;
    error.code = 'TOKEN_REVOKED';
    throw error;
  }

  existing.isRevoked = true;
  await existing.save();
  return true;
}

/**
 * Revokes all refresh token sessions for a specific user (e.g. on password change).
 *
 * @param {string|mongoose.Types.ObjectId} userId
 * @returns {Promise<number>} Number of revoked sessions
 */
export async function revokeAllUserTokens(userId) {
  const result = await RefreshToken.updateMany({ userId }, { isRevoked: true });
  return result.modifiedCount;
}

export default {
  hashToken,
  parseDurationToMs,
  generateAccessToken,
  verifyAccessToken,
  createRefreshTokenSession,
  rotateRefreshToken,
  revokeRefreshToken,
  revokeAllUserTokens,
};
