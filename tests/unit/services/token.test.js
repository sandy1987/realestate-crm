/**
 * tests/unit/services/token.test.js
 *
 * Unit tests for token service: JWT access tokens, cryptographically secure
 * refresh tokens, rotation, replay attack detection, and session revocation.
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import mongoose from 'mongoose';
import { connectDB, disconnectDB } from '../../../src/config/db.js';
import { User } from '../../../src/models/User.model.js';
import { RefreshToken } from '../../../src/models/RefreshToken.model.js';
import { ROLES } from '../../../src/constants/roles.js';
import { hashPassword } from '../../../src/utils/password.js';
import {
  generateAccessToken,
  verifyAccessToken,
  createRefreshTokenSession,
  rotateRefreshToken,
  revokeRefreshToken,
  revokeAllUserTokens,
  hashToken,
} from '../../../src/services/token.service.js';

describe('Token Service Unit Tests (AC-14)', () => {
  let testUser;

  beforeAll(async () => {
    await connectDB();
  });

  afterAll(async () => {
    await disconnectDB();
  });

  beforeEach(async () => {
    await User.deleteMany({});
    await RefreshToken.deleteMany({});

    testUser = await User.create({
      email: 'token-test@example.com',
      passwordHash: await hashPassword('Password123!'),
      role: ROLES.FIRM_ADMIN,
      firmId: new mongoose.Types.ObjectId(),
    });
  });

  it('generates valid JWT access tokens with correct minimal claims', () => {
    const token = generateAccessToken(testUser);
    expect(typeof token).toBe('string');

    const decoded = verifyAccessToken(token);
    expect(decoded.sub).toBe(testUser._id.toString());
    expect(decoded.role).toBe(ROLES.FIRM_ADMIN);
    expect(decoded.firmId).toBe(testUser.firmId.toString());
    expect(decoded.exp).toBeDefined();
    expect(decoded.iat).toBeDefined();
    // Verify no password hash or secrets are exposed in claims
    expect(decoded.passwordHash).toBeUndefined();
  });

  it('creates refresh token session storing only SHA-256 hash in DB', async () => {
    const session = await createRefreshTokenSession({
      user: testUser,
      ipAddress: '127.0.0.1',
      userAgent: 'Vitest/2.0',
    });

    expect(session.refreshToken).toBeDefined();
    expect(session.expiresAt).toBeInstanceOf(Date);

    // Look up the record in DB using hash
    const expectedHash = hashToken(session.refreshToken);
    const dbRecord = await RefreshToken.findOne({ tokenHash: expectedHash });

    expect(dbRecord).not.toBeNull();
    expect(dbRecord.userId.toString()).toBe(testUser._id.toString());
    expect(dbRecord.isRevoked).toBe(false);
    expect(dbRecord.ipAddress).toBe('127.0.0.1');

    // Never store plaintext refresh token in database
    const rawMatch = await RefreshToken.findOne({ tokenHash: session.refreshToken });
    expect(rawMatch).toBeNull();
  });

  it('rotates refresh token: revokes old token and issues fresh token pair', async () => {
    const session1 = await createRefreshTokenSession({ user: testUser });
    const oldHash = hashToken(session1.refreshToken);

    const rotation = await rotateRefreshToken(session1.refreshToken, {
      ipAddress: '192.168.1.1',
    });

    expect(rotation.accessToken).toBeDefined();
    expect(rotation.refreshToken).toBeDefined();
    expect(rotation.refreshToken).not.toBe(session1.refreshToken);

    // Old token must now be marked revoked
    const oldDoc = await RefreshToken.findOne({ tokenHash: oldHash });
    expect(oldDoc.isRevoked).toBe(true);

    // New token must be active
    const newHash = hashToken(rotation.refreshToken);
    const newDoc = await RefreshToken.findOne({ tokenHash: newHash });
    expect(newDoc.isRevoked).toBe(false);
  });

  it('detects replay attack: reusing a revoked token revokes all user sessions', async () => {
    // Create two active sessions for the same user
    const session1 = await createRefreshTokenSession({ user: testUser });
    const session2 = await createRefreshTokenSession({ user: testUser });

    // Rotate session1 normally
    await rotateRefreshToken(session1.refreshToken);

    // Attempt to reuse session1.refreshToken (replay attack scenario)
    await expect(rotateRefreshToken(session1.refreshToken)).rejects.toMatchObject({
      code: 'TOKEN_REVOKED',
      statusCode: 401,
    });

    // All sessions for this user should now be revoked
    const activeSessions = await RefreshToken.find({
      userId: testUser._id,
      isRevoked: false,
    });
    expect(activeSessions).toHaveLength(0);
  });

  it('rejects expired refresh token', async () => {
    const rawToken = 'expired-token-string-sample-test';
    const tokenHash = hashToken(rawToken);

    await RefreshToken.create({
      userId: testUser._id,
      firmId: testUser.firmId,
      tokenHash,
      expiresAt: new Date(Date.now() - 10_000), // expired 10s ago
      isRevoked: false,
    });

    await expect(rotateRefreshToken(rawToken)).rejects.toMatchObject({
      code: 'TOKEN_EXPIRED',
      statusCode: 401,
    });
  });

  it('revokes single token on logout', async () => {
    const session = await createRefreshTokenSession({ user: testUser });
    const tokenHash = hashToken(session.refreshToken);

    const revoked = await revokeRefreshToken(session.refreshToken);
    expect(revoked).toBe(true);

    const dbRecord = await RefreshToken.findOne({ tokenHash });
    expect(dbRecord.isRevoked).toBe(true);
  });

  it('revokes all user tokens simultaneously', async () => {
    await createRefreshTokenSession({ user: testUser });
    await createRefreshTokenSession({ user: testUser });

    const count = await revokeAllUserTokens(testUser._id);
    expect(count).toBe(2);

    const activeCount = await RefreshToken.countDocuments({
      userId: testUser._id,
      isRevoked: false,
    });
    expect(activeCount).toBe(0);
  });
});
