/**
 * tests/integration/auth.test.js
 *
 * Integration tests for authentication API endpoints:
 *  - POST /api/auth/login and POST /api/v1/auth/login
 *  - GET  /api/auth/me and GET /api/v1/auth/me
 *  - POST /api/auth/refresh
 *  - POST /api/auth/logout
 *  - POST /api/auth/change-password
 *
 * Verifies identity establishment, credential validation, token lifecycles,
 * rate limiting, account status guards, and payload tampering rejection.
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
import { createTestUser, DEFAULT_TEST_PASSWORD } from '../setup/fixtures.js';

describe('Authentication & Identity Integration Tests (Phase 2)', () => {
  beforeAll(async () => {
    await connectDB();
  });

  afterAll(async () => {
    await disconnectDB();
  });

  beforeEach(async () => {
    await User.deleteMany({});
    await RefreshToken.deleteMany({});
  });

  describe('POST /api/auth/login (AC-7, AC-8, AC-9, AC-13)', () => {
    it('7. logs in successfully with valid credentials and returns safe fields', async () => {
      const { user } = await createTestUser({
        email: 'admin@firm.com',
        firstName: 'John',
        lastName: 'Doe',
      });

      const res = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'admin@firm.com',
          password: DEFAULT_TEST_PASSWORD,
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      const { data } = res.body;
      expect(data.accessToken).toBeDefined();
      expect(data.refreshToken).toBeDefined();

      // Safe user fields only
      expect(data.user).toBeDefined();
      expect(data.user.id).toBe(user._id.toString());
      expect(data.user.email).toBe('admin@firm.com');
      expect(data.user.role).toBe(ROLES.FIRM_ADMIN);
      expect(data.user.firmId).toBe(user.firmId.toString());

      // Secrets must never be exposed
      expect(data.user.passwordHash).toBeUndefined();
      expect(data.tokenHash).toBeUndefined();

      // Verify access token claims
      const decoded = jwt.verify(data.accessToken, config.JWT_ACCESS_SECRET);
      expect(decoded.sub).toBe(user._id.toString());
      expect(decoded.role).toBe(ROLES.FIRM_ADMIN);
      expect(decoded.firmId).toBe(user.firmId.toString());
    });

    it('works identically via /api/v1/auth/login', async () => {
      await createTestUser({ email: 'v1@firm.com' });

      const res = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: 'v1@firm.com',
          password: DEFAULT_TEST_PASSWORD,
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.accessToken).toBeDefined();
    });

    it('8. rejects incorrect password with generic timing-safe error (AC-8)', async () => {
      await createTestUser({ email: 'target@firm.com' });

      const res = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'target@firm.com',
          password: 'WrongPassword999!',
        });

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toEqual({
        code: 'INVALID_CREDENTIALS',
        message: 'Invalid email or password',
      });
    });

    it('8. rejects non-existent email with the exact same error envelope (timing-safe)', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'does-not-exist@example.com',
          password: 'AnyPassword!',
        });

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toEqual({
        code: 'INVALID_CREDENTIALS',
        message: 'Invalid email or password',
      });
    });

    it('9. rejects disabled or suspended account login (AC-9)', async () => {
      // Inactive user
      await createTestUser({
        email: 'inactive@firm.com',
        isActive: false,
      });

      const res1 = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'inactive@firm.com',
          password: DEFAULT_TEST_PASSWORD,
        });

      expect(res1.status).toBe(403);
      expect(res1.body.error.code).toBe('ACCOUNT_DISABLED');

      // Suspended user
      await createTestUser({
        email: 'suspended@firm.com',
        isActive: true,
        isSuspended: true,
      });

      const res2 = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'suspended@firm.com',
          password: DEFAULT_TEST_PASSWORD,
        });

      expect(res2.status).toBe(403);
      expect(res2.body.error.code).toBe('ACCOUNT_DISABLED');
    });

    it('13. prevents role or firmId escalation through request payload tampering (AC-13)', async () => {
      const originalFirmId = new mongoose.Types.ObjectId();
      const fakeAttackerFirmId = new mongoose.Types.ObjectId();

      await createTestUser({
        email: 'staff@firm.com',
        role: ROLES.FIRM_STAFF,
        firmId: originalFirmId,
      });

      // Attacker attempts to send modified role and firmId in login body
      const res = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'staff@firm.com',
          password: DEFAULT_TEST_PASSWORD,
          role: ROLES.SUPER_ADMIN,
          firmId: fakeAttackerFirmId.toString(),
        });

      expect(res.status).toBe(200);
      const { user, accessToken } = res.body.data;

      // Identity reflects database truth, not client payload
      expect(user.role).toBe(ROLES.FIRM_STAFF);
      expect(user.firmId).toBe(originalFirmId.toString());

      const decoded = jwt.verify(accessToken, config.JWT_ACCESS_SECRET);
      expect(decoded.role).toBe(ROLES.FIRM_STAFF);
      expect(decoded.firmId).toBe(originalFirmId.toString());
    });
  });

  describe('GET /api/auth/me (AC-10, AC-11, AC-12)', () => {
    it('11. returns authenticated user profile identity from database', async () => {
      const { user } = await createTestUser({ email: 'me-user@firm.com' });

      const loginRes = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'me-user@firm.com',
          password: DEFAULT_TEST_PASSWORD,
        });

      const token = loginRes.body.data.accessToken;

      const res = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.id).toBe(user._id.toString());
      expect(res.body.data.email).toBe('me-user@firm.com');
      expect(res.body.data.role).toBe(ROLES.FIRM_ADMIN);
      expect(res.body.data.passwordHash).toBeUndefined();
    });

    it('10. rejects missing, malformed, expired, and invalidly signed tokens (AC-10)', async () => {
      // Missing token
      const resMissing = await request(app).get('/api/auth/me');
      expect(resMissing.status).toBe(401);
      expect(resMissing.body.error.code).toBe('UNAUTHORIZED');

      // Malformed header
      const resMalformed = await request(app)
        .get('/api/auth/me')
        .set('Authorization', 'InvalidBearerTokenFormat');
      expect(resMalformed.status).toBe(401);
      expect(resMalformed.body.error.code).toBe('UNAUTHORIZED');

      // Invalid signature
      const fakeToken = jwt.sign(
        { sub: new mongoose.Types.ObjectId().toString(), role: ROLES.SUPER_ADMIN },
        'wrong-secret-key-that-does-not-match-configured-secret-key!'
      );
      const resBadSign = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${fakeToken}`);
      expect(resBadSign.status).toBe(401);
      expect(resBadSign.body.error.code).toBe('INVALID_TOKEN');

      // Expired token
      const expiredToken = jwt.sign(
        { sub: new mongoose.Types.ObjectId().toString(), role: ROLES.FIRM_ADMIN },
        config.JWT_ACCESS_SECRET,
        { expiresIn: '-1s' }
      );
      const resExpired = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${expiredToken}`);
      expect(resExpired.status).toBe(401);
      expect(resExpired.body.error.code).toBe('TOKEN_EXPIRED');
    });

    it('12. rejects deleted or deactivated users even with valid JWT (AC-12)', async () => {
      const { user } = await createTestUser({ email: 'ephemeral@firm.com' });

      const loginRes = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'ephemeral@firm.com',
          password: DEFAULT_TEST_PASSWORD,
        });

      const token = loginRes.body.data.accessToken;

      // Delete the user from database
      await User.findByIdAndDelete(user._id);

      const res = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('UNAUTHORIZED');
    });
  });

  describe('POST /api/auth/refresh and POST /api/auth/logout (AC-14, AC-15)', () => {
    it('14. rotates refresh token successfully via HTTP API', async () => {
      await createTestUser({ email: 'refresh-api@firm.com' });

      const loginRes = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'refresh-api@firm.com',
          password: DEFAULT_TEST_PASSWORD,
        });

      const oldRefreshToken = loginRes.body.data.refreshToken;

      const refreshRes = await request(app)
        .post('/api/auth/refresh')
        .send({ refreshToken: oldRefreshToken });

      expect(refreshRes.status).toBe(200);
      expect(refreshRes.body.success).toBe(true);

      const { accessToken, refreshToken } = refreshRes.body.data;
      expect(accessToken).toBeDefined();
      expect(refreshToken).toBeDefined();
      expect(refreshToken).not.toBe(oldRefreshToken);

      // Reusing the old refresh token must be rejected (replay attack prevention)
      const reuseRes = await request(app)
        .post('/api/auth/refresh')
        .send({ refreshToken: oldRefreshToken });

      expect(reuseRes.status).toBe(401);
      expect(reuseRes.body.error.code).toBe('TOKEN_REVOKED');
    });

    it('15. logs out successfully and revokes refresh token session (AC-15)', async () => {
      await createTestUser({ email: 'logout-api@firm.com' });

      const loginRes = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'logout-api@firm.com',
          password: DEFAULT_TEST_PASSWORD,
        });

      const { refreshToken } = loginRes.body.data;

      const logoutRes = await request(app)
        .post('/api/auth/logout')
        .send({ refreshToken });

      expect(logoutRes.status).toBe(200);
      expect(logoutRes.body.data.message).toBe('Logged out successfully');

      // Subsequent attempt to use revoked token must fail
      const refreshRes = await request(app)
        .post('/api/auth/refresh')
        .send({ refreshToken });

      expect(refreshRes.status).toBe(401);
    });
  });

  describe('POST /api/auth/change-password', () => {
    it('changes password with valid current password and revokes previous sessions', async () => {
      const { user } = await createTestUser({ email: 'change-pw@firm.com' });

      const loginRes = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'change-pw@firm.com',
          password: DEFAULT_TEST_PASSWORD,
        });

      const { accessToken, refreshToken } = loginRes.body.data;

      const changeRes = await request(app)
        .post('/api/auth/change-password')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          currentPassword: DEFAULT_TEST_PASSWORD,
          newPassword: 'BrandNewSecurePassword456!',
        });

      expect(changeRes.status).toBe(200);

      // Old refresh token was revoked
      const refreshRes = await request(app)
        .post('/api/auth/refresh')
        .send({ refreshToken });
      expect(refreshRes.status).toBe(401);

      // Can login with new password
      const newLoginRes = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'change-pw@firm.com',
          password: 'BrandNewSecurePassword456!',
        });
      expect(newLoginRes.status).toBe(200);
    });
  });

  describe('16. Rate Limiting on Authentication Endpoints (AC-16)', () => {
    it('returns 429 RATE_LIMITED when auth rate limit threshold is exceeded', async () => {
      await createTestUser({ email: 'ratelimit@firm.com' });

      // Send 10 failed login requests with x-test-rate-limit header to activate limiter
      for (let i = 0; i < 10; i++) {
        await request(app)
          .post('/api/auth/login')
          .set('x-test-rate-limit', 'true')
          .send({
            email: 'ratelimit@firm.com',
            password: 'BadPassword!',
          });
      }

      // The 11th request must be rejected with 429 RATE_LIMITED
      const throttledRes = await request(app)
        .post('/api/auth/login')
        .set('x-test-rate-limit', 'true')
        .send({
          email: 'ratelimit@firm.com',
          password: DEFAULT_TEST_PASSWORD,
        });

      expect(throttledRes.status).toBe(429);
      expect(throttledRes.body.success).toBe(false);
      expect(throttledRes.body.error.code).toBe('RATE_LIMITED');
    });
  });

  describe('17. Error Envelopes and Absence of Secrets (AC-17)', () => {
    it('conforms to standard error envelope and never exposes internal secrets', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'invalid-email-format',
          password: '',
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toBeDefined();
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
      expect(res.body.error.message).toBe('Request validation failed');
      expect(res.body.error.details).toBeInstanceOf(Array);

      // Response body string search ensures no secret keywords or leakages
      const rawText = JSON.stringify(res.body);
      expect(rawText).not.toContain('secret');
      expect(rawText).not.toContain('argon2');
      expect(rawText).not.toContain('passwordHash');
    });
  });
});
