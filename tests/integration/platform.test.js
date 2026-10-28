/**
 * tests/integration/platform.test.js
 *
 * Integration tests for platform administration and firm provisioning.
 *
 * Verifies:
 *  - SUPER_ADMIN authorization on platform routes
 *  - Rejection of tenant roles (FIRM_ADMIN, FIRM_STAFF) and unauthenticated callers
 *  - Schema validation, slug uniqueness, and response shapes
 *  - Paginated listing of firms
 *  - Firm suspension and activation
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import mongoose from 'mongoose';
import { app } from '../../src/app.js';
import { connectDB, disconnectDB } from '../../src/config/db.js';
import { User } from '../../src/models/User.model.js';
import { Firm } from '../../src/models/Firm.model.js';
import { ROLES } from '../../src/constants/roles.js';
import {
  createTestSuperAdmin,
  createTestUser,
  createTestStaff,
  createTestFirm,
  DEFAULT_TEST_PASSWORD,
} from '../setup/fixtures.js';

describe('Platform Administration & Firm Provisioning (Phase 3)', () => {
  beforeAll(async () => {
    await connectDB();
  });

  afterAll(async () => {
    await disconnectDB();
  });

  beforeEach(async () => {
    await User.deleteMany({});
    await Firm.deleteMany({});
  });

  async function getAccessToken(user) {
    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({
        email: user.email,
        password: DEFAULT_TEST_PASSWORD,
      });
    return loginRes.body.data.accessToken;
  }

  describe('POST /api/platform/firms (Provisioning)', () => {
    it('1. SUPER_ADMIN can provision a new firm', async () => {
      const { user: superAdmin } = await createTestSuperAdmin();
      const token = await getAccessToken(superAdmin);

      const res = await request(app)
        .post('/api/platform/firms')
        .set('Authorization', `Bearer ${token}`)
        .send({
          name: 'Apex Realty Estates',
          slug: 'apex-realty-estates',
          contactEmail: 'contact@apexrealty.com',
          contactPhone: '+91 98765 11111',
          settings: {
            allowedVideoProviders: ['youtube'],
            defaultCurrency: 'INR',
          },
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);

      const { firm } = res.body.data;
      expect(firm.id).toBeDefined();
      expect(firm.name).toBe('Apex Realty Estates');
      expect(firm.slug).toBe('apex-realty-estates');
      expect(firm.isActive).toBe(true);
      expect(firm.createdBy).toBe(superAdmin._id.toString());

      // Verify firm is created in MongoDB
      const dbFirm = await Firm.findById(firm.id);
      expect(dbFirm).not.toBeNull();
      expect(dbFirm.slug).toBe('apex-realty-estates');
    });

    it('SUPER_ADMIN can provision a firm and its initial FIRM_ADMIN simultaneously', async () => {
      const { user: superAdmin } = await createTestSuperAdmin();
      const token = await getAccessToken(superAdmin);

      const res = await request(app)
        .post('/api/platform/firms')
        .set('Authorization', `Bearer ${token}`)
        .send({
          name: 'Metro Properties',
          slug: 'metro-properties',
          contactEmail: 'info@metroprops.com',
          adminEmail: 'first-admin@metroprops.com',
          adminPassword: 'SecureAdminPassword123!',
          adminFirstName: 'Rajesh',
          adminLastName: 'Kumar',
        });

      expect(res.status).toBe(201);
      const { firm, admin } = res.body.data;
      expect(firm).toBeDefined();
      expect(admin).toBeDefined();
      expect(admin.email).toBe('first-admin@metroprops.com');
      expect(admin.role).toBe(ROLES.FIRM_ADMIN);
      expect(admin.firmId).toBe(firm.id);
      expect(admin.passwordHash).toBeUndefined();

      // Verify admin can login immediately
      const loginRes = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'first-admin@metroprops.com',
          password: 'SecureAdminPassword123!',
        });
      expect(loginRes.status).toBe(200);
      expect(loginRes.body.data.user.role).toBe(ROLES.FIRM_ADMIN);
      expect(loginRes.body.data.user.firmId).toBe(firm.id);
    });

    it('2. Tenant users (FIRM_ADMIN, FIRM_STAFF) cannot provision firms (403 FORBIDDEN)', async () => {
      const firm = await createTestFirm();
      const { user: firmAdmin } = await createTestUser({ firmId: firm._id });
      const { user: firmStaff } = await createTestStaff({ firmId: firm._id });

      const adminToken = await getAccessToken(firmAdmin);
      const staffToken = await getAccessToken(firmStaff);

      // FIRM_ADMIN attempt
      const resAdmin = await request(app)
        .post('/api/platform/firms')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: 'Unauthorized Firm', slug: 'unauthorized-firm' });

      expect(resAdmin.status).toBe(403);
      expect(resAdmin.body.error.code).toBe('FORBIDDEN');

      // FIRM_STAFF attempt
      const resStaff = await request(app)
        .post('/api/platform/firms')
        .set('Authorization', `Bearer ${staffToken}`)
        .send({ name: 'Unauthorized Firm 2', slug: 'unauthorized-firm-2' });

      expect(resStaff.status).toBe(403);
      expect(resStaff.body.error.code).toBe('FORBIDDEN');
    });

    it('3. Unauthenticated users cannot provision firms (401 UNAUTHORIZED)', async () => {
      const res = await request(app)
        .post('/api/platform/firms')
        .send({ name: 'Unauth Firm', slug: 'unauth-firm' });

      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('UNAUTHORIZED');
    });

    it('4. Rejects duplicate firm slug with 409 CONFLICT', async () => {
      const { user: superAdmin } = await createTestSuperAdmin();
      const token = await getAccessToken(superAdmin);

      await createTestFirm({ slug: 'existing-firm' });

      const res = await request(app)
        .post('/api/platform/firms')
        .set('Authorization', `Bearer ${token}`)
        .send({
          name: 'Duplicate Firm',
          slug: 'existing-firm',
        });

      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('CONFLICT');
    });

    it('rejects invalid slug format with 400 VALIDATION_ERROR', async () => {
      const { user: superAdmin } = await createTestSuperAdmin();
      const token = await getAccessToken(superAdmin);

      const res = await request(app)
        .post('/api/platform/firms')
        .set('Authorization', `Bearer ${token}`)
        .send({
          name: 'Invalid Slug Firm',
          slug: 'Invalid Slug with Spaces!',
        });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('GET /api/platform/firms (Listing & Details)', () => {
    it('SUPER_ADMIN can list firms with pagination and filtering', async () => {
      const { user: superAdmin } = await createTestSuperAdmin();
      const token = await getAccessToken(superAdmin);

      await createTestFirm({ name: 'Alpha Estates', slug: 'alpha-estates' });
      await createTestFirm({ name: 'Beta Realty', slug: 'beta-realty' });
      await createTestFirm({ name: 'Gamma Lands', slug: 'gamma-lands' });

      const res = await request(app)
        .get('/api/platform/firms?page=1&limit=2')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveLength(2);
      expect(res.body.meta).toMatchObject({
        page: 1,
        limit: 2,
        total: 3,
        totalPages: 2,
      });
    });

    it('SUPER_ADMIN can view single firm details', async () => {
      const { user: superAdmin } = await createTestSuperAdmin();
      const token = await getAccessToken(superAdmin);

      const firm = await createTestFirm({ name: 'Detail Firm', slug: 'detail-firm' });

      const res = await request(app)
        .get(`/api/platform/firms/${firm._id}`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.data.id).toBe(firm._id.toString());
      expect(res.body.data.name).toBe('Detail Firm');
    });
  });

  describe('Firm Suspension & Activation', () => {
    it('SUPER_ADMIN can suspend and re-activate a firm', async () => {
      const { user: superAdmin } = await createTestSuperAdmin();
      const token = await getAccessToken(superAdmin);

      const firm = await createTestFirm({ name: 'Toggle Firm', slug: 'toggle-firm' });
      expect(firm.isActive).toBe(true);

      // Suspend
      const suspendRes = await request(app)
        .post(`/api/platform/firms/${firm._id}/suspend`)
        .set('Authorization', `Bearer ${token}`);

      expect(suspendRes.status).toBe(200);
      expect(suspendRes.body.data.isActive).toBe(false);

      const updatedDoc = await Firm.findById(firm._id);
      expect(updatedDoc.isActive).toBe(false);

      // Activate
      const activateRes = await request(app)
        .post(`/api/platform/firms/${firm._id}/activate`)
        .set('Authorization', `Bearer ${token}`);

      expect(activateRes.status).toBe(200);
      expect(activateRes.body.data.isActive).toBe(true);

      const activeDoc = await Firm.findById(firm._id);
      expect(activeDoc.isActive).toBe(true);
    });
  });
});
