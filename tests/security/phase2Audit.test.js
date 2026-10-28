/**
 * tests/security/phase2Audit.test.js
 *
 * Dedicated security verification tests for Phase 2 implementation.
 * Tests concurrency, race conditions, algorithm enforcement, index verification,
 * and session revocation behavior.
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import mongoose from 'mongoose';
import jwt from 'jsonwebtoken';
import { app } from '../../src/app.js';
import { connectDB, disconnectDB } from '../../src/config/db.js';
import { User } from '../../src/models/User.model.js';
import { RefreshToken } from '../../src/models/RefreshToken.model.js';
import { ROLES } from '../../src/constants/roles.js';
import { config } from '../../src/config/env.js';
import { createTestUser } from '../setup/fixtures.js';
import {
  createRefreshTokenSession,
  rotateRefreshToken,
  verifyAccessToken,
  JWT_ALGORITHM,
} from '../../src/services/token.service.js';

describe('Phase 2 Security Verification Suite', () => {
  beforeAll(async () => {
    await connectDB();
    await User.init();
    await RefreshToken.init();
  });

  afterAll(async () => {
    await disconnectDB();
  });

  beforeEach(async () => {
    await User.deleteMany({});
    await RefreshToken.deleteMany({});
  });

  describe('D-1: Refresh-token rotation concurrency & atomicity', () => {
    it('five simultaneous rotation requests: at most 1 succeeds, no duplicate successor sessions', async () => {
      const { user } = await createTestUser();
      const session = await createRefreshTokenSession({ user });
      const rawToken = session.refreshToken;

      // Submit 5 concurrent rotation requests simultaneously with the same token
      const results = await Promise.allSettled([
        rotateRefreshToken(rawToken),
        rotateRefreshToken(rawToken),
        rotateRefreshToken(rawToken),
        rotateRefreshToken(rawToken),
        rotateRefreshToken(rawToken),
      ]);

      const fulfilled = results.filter((r) => r.status === 'fulfilled');
      const rejected = results.filter((r) => r.status === 'rejected');

      // Requirement: At most one successful rotation
      expect(fulfilled.length).toBeLessThanOrEqual(1);

      // Requirement: Losing requests must be rejected
      expect(rejected.length).toBeGreaterThanOrEqual(4);

      // Verify rejection errors follow standard error contract
      for (const rej of rejected) {
        expect(rej.reason.statusCode).toBe(401);
        expect(rej.reason.code).toBe('TOKEN_REVOKED');
      }

      // Requirement: No duplicate successor sessions created
      const activeTokens = await RefreshToken.find({ userId: user._id, isRevoked: false });
      expect(activeTokens.length).toBeLessThanOrEqual(1);
    });
  });

  describe('D-2: JWT algorithm restriction', () => {
    it('accepts tokens signed with approved HS256 algorithm', async () => {
      const token = jwt.sign(
        { sub: new mongoose.Types.ObjectId().toString(), role: ROLES.FIRM_ADMIN },
        config.JWT_ACCESS_SECRET,
        { algorithm: JWT_ALGORITHM }
      );

      const decoded = verifyAccessToken(token);
      expect(decoded.role).toBe(ROLES.FIRM_ADMIN);
    });

    it('rejects tokens signed with disallowed algorithms (e.g. HS384, HS512)', () => {
      const tokenHS512 = jwt.sign(
        { sub: new mongoose.Types.ObjectId().toString(), role: ROLES.FIRM_ADMIN },
        config.JWT_ACCESS_SECRET,
        { algorithm: 'HS512' }
      );

      expect(() => verifyAccessToken(tokenHS512)).toThrowError(/invalid algorithm/i);
    });

    it('returns standard 401 INVALID_TOKEN envelope when protected route receives disallowed algorithm token', async () => {
      const tokenHS512 = jwt.sign(
        { sub: new mongoose.Types.ObjectId().toString(), role: ROLES.FIRM_ADMIN },
        config.JWT_ACCESS_SECRET,
        { algorithm: 'HS512' }
      );

      const res = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${tokenHS512}`);

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('INVALID_TOKEN');
      expect(res.body.error.message).toBe('Authentication token is invalid');
    });
  });

  describe('D-3: Correct logout handling', () => {
    it('rejects unknown/invalid refresh tokens with 401 INVALID_TOKEN', async () => {
      const res = await request(app)
        .post('/api/auth/logout')
        .send({ refreshToken: 'non-existent-fake-token' });

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('INVALID_TOKEN');
      expect(res.body.error.message).toBe('Invalid refresh token');
    });

    it('rejects already-revoked refresh tokens with 401 TOKEN_REVOKED', async () => {
      const { user } = await createTestUser();
      const session = await createRefreshTokenSession({ user });

      // First logout succeeds
      const res1 = await request(app)
        .post('/api/auth/logout')
        .send({ refreshToken: session.refreshToken });
      expect(res1.status).toBe(200);

      // Second logout with same token must be rejected
      const res2 = await request(app)
        .post('/api/auth/logout')
        .send({ refreshToken: session.refreshToken });
      expect(res2.status).toBe(401);
      expect(res2.body.error.code).toBe('TOKEN_REVOKED');
      expect(res2.body.error.message).toBe('Refresh token has already been revoked');
    });

    it('logout with user A token does not revoke user B token', async () => {
      const { user: userA } = await createTestUser({ email: 'userA@test.com' });
      const { user: userB } = await createTestUser({ email: 'userB@test.com' });

      const sessionA = await createRefreshTokenSession({ user: userA });
      const sessionB = await createRefreshTokenSession({ user: userB });

      // Logout user A
      const res = await request(app)
        .post('/api/auth/logout')
        .send({ refreshToken: sessionA.refreshToken });

      expect(res.status).toBe(200);

      // User B session is unaffected and can rotate
      const rotationB = await rotateRefreshToken(sessionB.refreshToken);
      expect(rotationB.accessToken).toBeDefined();

      // User A session cannot be rotated
      await expect(rotateRefreshToken(sessionA.refreshToken)).rejects.toMatchObject({
        code: 'TOKEN_REVOKED',
      });
    });
  });

  describe('Database indexes and uniqueness verification', () => {
    it('confirms the unique email index is actually registered in MongoDB', async () => {
      const indexes = await User.collection.getIndexes();
      expect(indexes.email_1).toBeDefined();
      expect(indexes.email_1).toEqual([['email', 1]]);
    });

    it('concurrent duplicate user creation rejects second insert via DB unique index', async () => {
      const email = 'duplicate-race@example.com';
      const firmId = new mongoose.Types.ObjectId();

      const results = await Promise.allSettled([
        User.create({
          email,
          passwordHash: 'dummyHash',
          role: ROLES.FIRM_ADMIN,
          firmId,
        }),
        User.create({
          email,
          passwordHash: 'dummyHash',
          role: ROLES.FIRM_ADMIN,
          firmId,
        }),
      ]);

      const fulfilled = results.filter((r) => r.status === 'fulfilled');
      const rejected = results.filter((r) => r.status === 'rejected');

      expect(fulfilled.length).toBe(1);
      expect(rejected.length).toBe(1);
      expect(rejected[0].reason.code).toBe(11000); // MongoDB duplicate key
    });
  });

  describe('Secret leakage check', () => {
    it('verifies error handler never exposes MongoDB connection string or secrets', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'not-an-email',
          password: 'test',
        });

      const bodyStr = JSON.stringify(res.body);
      expect(bodyStr).not.toContain(config.JWT_ACCESS_SECRET);
      expect(bodyStr).not.toContain(config.JWT_REFRESH_SECRET);
      expect(bodyStr).not.toContain('mongodb');
    });
  });
});
