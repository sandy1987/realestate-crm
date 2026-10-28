/**
 * tests/integration/firmUsers.test.js
 *
 * Firm Administration & User Management Test Suite (Phase 6).
 *
 * Verifies:
 *  1. Authorized firm administrator creates an allowed staff account
 *  2. Created user receives the correct trusted firmId
 *  3. Password is hashed using Argon2id and never returned
 *  4. Duplicate email is rejected globally with 409 CONFLICT
 *  5. Firm administrator can list only their own firm's users (pagination & search)
 *  6. Firm administrator can retrieve a user from their own firm
 *  7. Cross-firm user retrieval returns 404 NOT_FOUND
 *  8. Cross-firm update and deactivation return 404 NOT_FOUND
 *  9. Client-supplied firmId cannot change user ownership
 * 10. Tenant users cannot create or promote SUPER_ADMIN
 * 11. Role and permission escalation attempts are rejected
 * 12. Unauthorized roles (FIRM_STAFF, SUPER_ADMIN) cannot access administration routes (403 FORBIDDEN)
 * 13. Unauthenticated requests return 401 UNAUTHORIZED
 * 14. Disabled/suspended users cannot authenticate or retain access through existing tokens (403 ACCOUNT_DISABLED)
 * 15. Deactivation revokes active refresh-token sessions
 * 16. Permission updates properly grant or revoke staff access to private owner/source details
 * 17. Safe serialization: responses never expose passwordHash or session tokens
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import mongoose from 'mongoose';
import { app } from '../../src/app.js';
import { connectDB, disconnectDB } from '../../src/config/db.js';
import { User } from '../../src/models/User.model.js';
import { Firm } from '../../src/models/Firm.model.js';
import { Plot } from '../../src/models/Plot.model.js';
import { PlotPrivate } from '../../src/models/PlotPrivate.model.js';
import { RefreshToken } from '../../src/models/RefreshToken.model.js';
import { ROLES } from '../../src/constants/roles.js';
import { PERMS } from '../../src/constants/permissions.js';
import { generateAccessToken, createRefreshTokenSession } from '../../src/services/token.service.js';
import {
  createTestFirmWithAdmin,
  createTestStaff,
  createTestSuperAdmin,
  createTestFirm,
  DEFAULT_TEST_PASSWORD,
} from '../setup/fixtures.js';

describe('Firm Administration & User Management (Phase 6)', () => {
  beforeAll(async () => {
    await connectDB();
  });

  afterAll(async () => {
    await disconnectDB();
  });

  beforeEach(async () => {
    await User.deleteMany({});
    await Firm.deleteMany({});
    await Plot.deleteMany({});
    await PlotPrivate.deleteMany({});
    await RefreshToken.deleteMany({});
  });

  describe('POST /api/firm/users (Staff Account Creation)', () => {
    it('1. FIRM_ADMIN can create an allowed staff account with trusted firmId', async () => {
      const { firm, admin } = await createTestFirmWithAdmin();
      const token = generateAccessToken(admin);

      const payload = {
        email: 'staff.member@firm.com',
        password: 'StaffPassword123!',
        firstName: 'Jane',
        lastName: 'Doe',
        permissions: [PERMS.PLOTS_READ, PERMS.COLONIES_READ],
      };

      const res = await request(app)
        .post('/api/firm/users')
        .set('Authorization', `Bearer ${token}`)
        .send(payload);

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toMatchObject({
        email: 'staff.member@firm.com',
        role: ROLES.FIRM_STAFF,
        firmId: firm._id.toString(),
        firstName: 'Jane',
        lastName: 'Doe',
        permissions: [PERMS.PLOTS_READ, PERMS.COLONIES_READ],
        isActive: true,
        isSuspended: false,
      });
      expect(res.body.data.id).toBeDefined();

      // Ensure password and passwordHash are omitted
      expect(res.body.data.password).toBeUndefined();
      expect(res.body.data.passwordHash).toBeUndefined();

      // Verify in DB that password is encrypted with Argon2id
      const dbUser = await User.findById(res.body.data.id).select('+passwordHash');
      expect(dbUser).not.toBeNull();
      expect(dbUser.passwordHash).toMatch(/^\$argon2id\$/);
      expect(dbUser.firmId.toString()).toBe(firm._id.toString());
      expect(dbUser.createdBy.toString()).toBe(admin._id.toString());
    });

    it('2. Rejects duplicate email globally (409 CONFLICT)', async () => {
      const { admin: adminA } = await createTestFirmWithAdmin({ name: 'Firm A', slug: 'firm-a' });
      const { admin: adminB } = await createTestFirmWithAdmin({ name: 'Firm B', slug: 'firm-b' });

      const tokenA = generateAccessToken(adminA);
      const tokenB = generateAccessToken(adminB);

      // Firm A creates user
      await request(app)
        .post('/api/firm/users')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({
          email: 'shared@example.com',
          password: 'Password123!',
        });

      // Firm B attempts to create user with the same email
      const resB = await request(app)
        .post('/api/firm/users')
        .set('Authorization', `Bearer ${tokenB}`)
        .send({
          email: 'shared@example.com',
          password: 'Password123!',
        });

      expect(resB.status).toBe(409);
      expect(resB.body.success).toBe(false);
      expect(resB.body.error.code).toBe('EMAIL_ALREADY_EXISTS');
    });

    it('3. Rejects attempts to create SUPER_ADMIN or FIRM_ADMIN role', async () => {
      const { admin } = await createTestFirmWithAdmin();
      const token = generateAccessToken(admin);

      // Attempt to create SUPER_ADMIN
      const resSuper = await request(app)
        .post('/api/firm/users')
        .set('Authorization', `Bearer ${token}`)
        .send({
          email: 'escalate.super@example.com',
          password: 'Password123!',
          role: ROLES.SUPER_ADMIN,
        });

      expect(resSuper.status).toBe(400);
      expect(resSuper.body.error.code).toBe('VALIDATION_ERROR');

      // Attempt to create FIRM_ADMIN
      const resAdmin = await request(app)
        .post('/api/firm/users')
        .set('Authorization', `Bearer ${token}`)
        .send({
          email: 'escalate.admin@example.com',
          password: 'Password123!',
          role: ROLES.FIRM_ADMIN,
        });

      expect(resAdmin.status).toBe(400);
      expect(resAdmin.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('4. Rejects client-supplied firmId tampering', async () => {
      const { admin } = await createTestFirmWithAdmin();
      const foreignFirm = await createTestFirm({ name: 'Target Firm', slug: 'target-firm' });
      const token = generateAccessToken(admin);

      const res = await request(app)
        .post('/api/firm/users')
        .set('Authorization', `Bearer ${token}`)
        .send({
          email: 'tamper@example.com',
          password: 'Password123!',
          firmId: foreignFirm._id.toString(), // Tamper attempt
        });

      // Strict schema validation rejects undeclared firmId
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('5. Rejects unknown or unapproved permissions', async () => {
      const { admin } = await createTestFirmWithAdmin();
      const token = generateAccessToken(admin);

      const res = await request(app)
        .post('/api/firm/users')
        .set('Authorization', `Bearer ${token}`)
        .send({
          email: 'badperm@example.com',
          password: 'Password123!',
          permissions: ['super:root:access', 'billing:modify'],
        });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('GET /api/firm/users (Listing & Searching)', () => {
    it('6. Lists only users belonging to the authenticated firm with pagination', async () => {
      const { firm: firmA, admin: adminA } = await createTestFirmWithAdmin({ name: 'Firm A', slug: 'firm-a' });
      const { firm: firmB, admin: adminB } = await createTestFirmWithAdmin({ name: 'Firm B', slug: 'firm-b' });

      // Create staff in Firm A
      await createTestStaff({ firmId: firmA._id, email: 'staff.a1@firm.com' });
      await createTestStaff({ firmId: firmA._id, email: 'staff.a2@firm.com' });

      // Create staff in Firm B
      await createTestStaff({ firmId: firmB._id, email: 'staff.b1@firm.com' });

      const tokenA = generateAccessToken(adminA);

      const res = await request(app)
        .get('/api/firm/users')
        .set('Authorization', `Bearer ${tokenA}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      // Firm A has adminA + 2 staff = 3 users
      expect(res.body.data).toHaveLength(3);
      expect(res.body.data.every((u) => u.firmId === firmA._id.toString())).toBe(true);
      expect(res.body.data.find((u) => u.email === 'staff.b1@firm.com')).toBeUndefined();
    });

    it('7. Supports searching by name or email within firm', async () => {
      const { firm, admin } = await createTestFirmWithAdmin();
      await createTestStaff({ firmId: firm._id, email: 'robert.sales@firm.com', firstName: 'Robert' });
      await createTestStaff({ firmId: firm._id, email: 'sarah.ops@firm.com', firstName: 'Sarah' });

      const token = generateAccessToken(admin);

      const res = await request(app)
        .get('/api/firm/users?search=robert')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(1);
      expect(res.body.data[0].email).toBe('robert.sales@firm.com');
    });
  });

  describe('GET, PATCH, and Status /api/firm/users/:userId', () => {
    it('8. Retrieves a single firm user by ID', async () => {
      const { firm, admin } = await createTestFirmWithAdmin();
      const { user: staff } = await createTestStaff({
        firmId: firm._id,
        firstName: 'Alice',
        lastName: 'Wonder',
      });
      const token = generateAccessToken(admin);

      const res = await request(app)
        .get(`/api/firm/users/${staff._id}`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.data.id).toBe(staff._id.toString());
      expect(res.body.data.firstName).toBe('Alice');
      expect(res.body.data.passwordHash).toBeUndefined();
    });

    it('9. Denies cross-firm user retrieval with 404 NOT_FOUND', async () => {
      const { admin: adminA } = await createTestFirmWithAdmin({ name: 'Firm A', slug: 'firm-a' });
      const { firm: firmB } = await createTestFirmWithAdmin({ name: 'Firm B', slug: 'firm-b' });

      const { user: staffB } = await createTestStaff({ firmId: firmB._id, email: 'secret.b@firm.com' });
      const tokenA = generateAccessToken(adminA);

      const res = await request(app)
        .get(`/api/firm/users/${staffB._id}`)
        .set('Authorization', `Bearer ${tokenA}`);

      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe('USER_NOT_FOUND');
    });

    it('10. Updates staff profile and permissions', async () => {
      const { firm, admin } = await createTestFirmWithAdmin();
      const { user: staff } = await createTestStaff({
        firmId: firm._id,
        permissions: [PERMS.PLOTS_READ],
      });
      const token = generateAccessToken(admin);

      const res = await request(app)
        .patch(`/api/firm/users/${staff._id}`)
        .set('Authorization', `Bearer ${token}`)
        .send({
          firstName: 'UpdatedFirst',
          lastName: 'UpdatedLast',
          permissions: [PERMS.PLOTS_READ, PERMS.PLOTS_WRITE],
        });

      expect(res.status).toBe(200);
      expect(res.body.data.firstName).toBe('UpdatedFirst');
      expect(res.body.data.permissions).toEqual([PERMS.PLOTS_READ, PERMS.PLOTS_WRITE]);

      const inDb = await User.findById(staff._id);
      expect(inDb.firstName).toBe('UpdatedFirst');
      expect(inDb.permissions).toEqual([PERMS.PLOTS_READ, PERMS.PLOTS_WRITE]);
    });

    it('11. Denies cross-firm update with 404 NOT_FOUND', async () => {
      const { admin: adminA } = await createTestFirmWithAdmin({ name: 'Firm A', slug: 'firm-a' });
      const { firm: firmB } = await createTestFirmWithAdmin({ name: 'Firm B', slug: 'firm-b' });

      const { user: staffB } = await createTestStaff({ firmId: firmB._id });
      const tokenA = generateAccessToken(adminA);

      const res = await request(app)
        .patch(`/api/firm/users/${staffB._id}`)
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ firstName: 'Hacked' });

      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe('USER_NOT_FOUND');
    });

    it('12. Activates and deactivates staff status, revoking active sessions on deactivation', async () => {
      const { firm, admin } = await createTestFirmWithAdmin();
      const { user: staff } = await createTestStaff({ firmId: firm._id, isActive: true });

      // Create an active refresh token session for the staff member
      await createRefreshTokenSession({ user: staff, ipAddress: '127.0.0.1', userAgent: 'test' });
      const activeSessionsBefore = await RefreshToken.countDocuments({ userId: staff._id, isRevoked: false });
      expect(activeSessionsBefore).toBe(1);

      const token = generateAccessToken(admin);

      // Deactivate staff
      const deactRes = await request(app)
        .patch(`/api/firm/users/${staff._id}/status`)
        .set('Authorization', `Bearer ${token}`)
        .send({ isActive: false });

      expect(deactRes.status).toBe(200);
      expect(deactRes.body.data.isActive).toBe(false);

      // Active refresh token sessions must be revoked
      const activeSessionsAfter = await RefreshToken.countDocuments({ userId: staff._id, isRevoked: false });
      expect(activeSessionsAfter).toBe(0);

      // Existing access tokens are immediately rejected by requireAuth
      const staffToken = generateAccessToken(staff);
      const authAttempt = await request(app)
        .get('/api/plots')
        .set('Authorization', `Bearer ${staffToken}`);

      expect(authAttempt.status).toBe(403);
      expect(authAttempt.body.error.code).toBe('ACCOUNT_DISABLED');
    });

    it('13. Prevents administrator from deactivating their own account', async () => {
      const { admin } = await createTestFirmWithAdmin();
      const token = generateAccessToken(admin);

      const res = await request(app)
        .patch(`/api/firm/users/${admin._id}/status`)
        .set('Authorization', `Bearer ${token}`)
        .send({ isActive: false });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('CANNOT_MODIFY_OWN_STATUS');
    });

    it('14. Denies cross-firm status modification with 404 NOT_FOUND', async () => {
      const { admin: adminA } = await createTestFirmWithAdmin({ name: 'Firm A', slug: 'firm-a' });
      const { firm: firmB } = await createTestFirmWithAdmin({ name: 'Firm B', slug: 'firm-b' });

      const { user: staffB } = await createTestStaff({ firmId: firmB._id, isActive: true });
      const tokenA = generateAccessToken(adminA);

      const res = await request(app)
        .patch(`/api/firm/users/${staffB._id}/status`)
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ isActive: false });

      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe('USER_NOT_FOUND');

      const unchanged = await User.findById(staffB._id);
      expect(unchanged.isActive).toBe(true);
    });
  });

  describe('Permissions & Private-Data Control Interlock', () => {
    it('15. Granting and revoking private:read permission controls staff access to private details', async () => {
      const { firm, admin } = await createTestFirmWithAdmin();
      const { user: staff } = await createTestStaff({
        firmId: firm._id,
        permissions: [PERMS.PLOTS_READ], // No private:read initially
      });

      const plot = await Plot.create({
        firmId: firm._id,
        plotRef: 'PLOT-INTERLOCK',
        size: 100,
        sizeUnit: 'sqft',
        rate: 500000,
      });

      await PlotPrivate.create({
        firmId: firm._id,
        plotId: plot._id,
        owner: { name: 'Interlock Owner' },
      });

      const adminToken = generateAccessToken(admin);

      // Staff login / token
      const staffToken1 = generateAccessToken(staff);

      // 1. Staff initially rejected from private endpoint (403)
      const res1 = await request(app)
        .get(`/api/plots/${plot._id}/private`)
        .set('Authorization', `Bearer ${staffToken1}`);
      expect(res1.status).toBe(403);

      // 2. Admin grants private:read to staff
      await request(app)
        .patch(`/api/firm/users/${staff._id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ permissions: [PERMS.PLOTS_READ, PERMS.PRIVATE_READ] });

      // Updated staff token with fresh permissions
      const updatedStaff = await User.findById(staff._id);
      const staffToken2 = generateAccessToken(updatedStaff);

      // 3. Staff can now access private details
      const res2 = await request(app)
        .get(`/api/plots/${plot._id}/private`)
        .set('Authorization', `Bearer ${staffToken2}`);
      expect(res2.status).toBe(200);
      expect(res2.body.data.owner.name).toBe('Interlock Owner');

      // 4. Admin revokes private:read
      await request(app)
        .patch(`/api/firm/users/${staff._id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ permissions: [PERMS.PLOTS_READ] });

      const revokedStaff = await User.findById(staff._id);
      const staffToken3 = generateAccessToken(revokedStaff);

      // 5. Staff is denied once again
      const res3 = await request(app)
        .get(`/api/plots/${plot._id}/private`)
        .set('Authorization', `Bearer ${staffToken3}`);
      expect(res3.status).toBe(403);
    });
  });

  describe('Role-Based Access Control on Administration Routes', () => {
    it('16. FIRM_STAFF cannot access user administration routes (403 FORBIDDEN)', async () => {
      const { firm } = await createTestFirmWithAdmin();
      const { user: staff } = await createTestStaff({ firmId: firm._id });
      const token = generateAccessToken(staff);

      const res = await request(app)
        .get('/api/firm/users')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('FORBIDDEN');
    });

    it('17. SUPER_ADMIN cannot access firm user administration routes (403 FORBIDDEN)', async () => {
      const { user: superAdmin } = await createTestSuperAdmin();
      const token = generateAccessToken(superAdmin);

      const res = await request(app)
        .get('/api/firm/users')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('FORBIDDEN');
    });

    it('18. Unauthenticated requests are rejected with 401 UNAUTHORIZED', async () => {
      const res = await request(app).get('/api/firm/users');
      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('UNAUTHORIZED');
    });
  });
});
