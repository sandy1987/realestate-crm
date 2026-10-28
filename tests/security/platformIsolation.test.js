/**
 * tests/security/platformIsolation.test.js
 *
 * Security tests verifying strict separation between Platform Administration
 * and Tenant routes.
 *
 * Crucial Invariant:
 *  - SUPER_ADMIN cannot access tenant routes through any implicit bypass.
 *  - Tenant users cannot reach platform administration routes.
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import mongoose from 'mongoose';
import { app } from '../../src/app.js';
import { connectDB, disconnectDB } from '../../src/config/db.js';
import { User } from '../../src/models/User.model.js';
import { Firm } from '../../src/models/Firm.model.js';
import {
  createTestSuperAdmin,
  createTestUser,
  createTestStaff,
  createTestFirm,
  createTestFirmWithAdmin,
  DEFAULT_TEST_PASSWORD,
} from '../setup/fixtures.js';

describe('Platform Isolation Security Suite (Phase 3)', () => {
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

  it('1. SUPER_ADMIN JWT is rejected with 403 on tenant routes (GET /api/firm/me)', async () => {
    const { user: superAdmin } = await createTestSuperAdmin();
    const token = await getAccessToken(superAdmin);

    const res = await request(app)
      .get('/api/firm/me')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('FORBIDDEN');
    expect(res.body.error.message).toContain('Platform administrators cannot access tenant routes');
  });

  it('SUPER_ADMIN JWT is also rejected with 403 on /api/v1/firm/me', async () => {
    const { user: superAdmin } = await createTestSuperAdmin();
    const token = await getAccessToken(superAdmin);

    const res = await request(app)
      .get('/api/v1/firm/me')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
  });

  it('2. FIRM_ADMIN JWT is rejected with 403 on platform routes (POST /api/platform/firms)', async () => {
    const { firm, admin } = await createTestFirmWithAdmin();
    const token = await getAccessToken(admin);

    const res = await request(app)
      .post('/api/platform/firms')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Hacked Firm', slug: 'hacked-firm' });

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
    expect(res.body.error.message).toContain('Platform administrator access required');
  });

  it('3. FIRM_STAFF JWT is rejected with 403 on platform routes', async () => {
    const firm = await createTestFirm();
    const { user: staff } = await createTestStaff({ firmId: firm._id });
    const token = await getAccessToken(staff);

    const res = await request(app)
      .post('/api/platform/firms')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Staff Firm', slug: 'staff-firm' });

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
  });

  it('4. Missing or invalid tenant identity is rejected', async () => {
    // User with null firmId but non-superadmin role (corrupted or orphan)
    const { user: brokenUser } = await createTestUser({
      role: 'FIRM_ADMIN',
      firmId: new mongoose.Types.ObjectId(), // Pointing to non-existent firm
    });
    const token = await getAccessToken(brokenUser);

    const res = await request(app)
      .get('/api/firm/me')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FIRM_NOT_FOUND');
  });

  it('5. Suspended firm members are rejected from accessing tenant routes (403 FIRM_SUSPENDED)', async () => {
    const { firm, admin } = await createTestFirmWithAdmin({ isActive: false }); // Inactive firm
    const token = await getAccessToken(admin);

    const res = await request(app)
      .get('/api/firm/me')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FIRM_SUSPENDED');
    expect(res.body.error.message).toContain('Firm account is suspended or disabled');
  });

  it('6. Unauthenticated requests are rejected on both platform and tenant routes', async () => {
    const resPlatform = await request(app).get('/api/platform/firms');
    expect(resPlatform.status).toBe(401);

    const resTenant = await request(app).get('/api/firm/me');
    expect(resTenant.status).toBe(401);
  });
});
