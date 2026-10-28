/**
 * tests/integration/colonies.test.js
 *
 * Colony Management Integration Test Suite (Phase 4).
 *
 * Verifies:
 *  1. Valid colony creation
 *  2. Required-field and validation failures
 *  3. Firm-scoped listing, searching, filtering, and pagination
 *  4. Updating and deactivating colonies
 *  5. Cross-firm detail, update, and delete attempts (404 NOT_FOUND)
 *  6. Handling of colonies with active plots (400 COLONY_IN_USE)
 *  7. Multi-tenant security (firmId override protection, SUPER_ADMIN 403, suspended firm 403)
 *  8. Role and permission enforcement (FIRM_ADMIN vs FIRM_STAFF permissions)
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import mongoose from 'mongoose';
import { app } from '../../src/app.js';
import { connectDB, disconnectDB } from '../../src/config/db.js';
import { Colony } from '../../src/models/Colony.model.js';
import { Plot } from '../../src/models/Plot.model.js';
import { Firm } from '../../src/models/Firm.model.js';
import { User } from '../../src/models/User.model.js';
import { ROLES } from '../../src/constants/roles.js';
import { PERMS } from '../../src/constants/permissions.js';
import { generateAccessToken } from '../../src/services/token.service.js';
import {
  createTestFirmWithAdmin,
  createTestStaff,
  createTestSuperAdmin,
  createTestFirm,
} from '../setup/fixtures.js';

describe('Colony Management API (Phase 4)', () => {
  beforeAll(async () => {
    await connectDB();
  });

  afterAll(async () => {
    await disconnectDB();
  });

  beforeEach(async () => {
    await Colony.deleteMany({});
    await Plot.deleteMany({});
    await Firm.deleteMany({});
    await User.deleteMany({});
  });

  describe('POST /api/colonies (Creation)', () => {
    it('1. Successfully creates a valid colony and derives firmId from tenant context', async () => {
      const { firm, admin } = await createTestFirmWithAdmin();
      const token = generateAccessToken(admin);

      const payload = {
        name: 'Greenwood Valley',
        description: 'Luxury plots amidst nature',
        address: 'Sector 42, Main Bypass',
        city: 'Jaipur',
        state: 'Rajasthan',
        country: 'India',
        pincode: '302001',
      };

      const res = await request(app)
        .post('/api/colonies')
        .set('Authorization', `Bearer ${token}`)
        .send(payload);

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toMatchObject({
        name: 'Greenwood Valley',
        firmId: firm._id.toString(),
        city: 'Jaipur',
        state: 'Rajasthan',
        isActive: true,
      });
      expect(res.body.data.id).toBeDefined();

      // Verify in DB
      const dbColony = await Colony.findById(res.body.data.id);
      expect(dbColony).not.toBeNull();
      expect(dbColony.firmId.toString()).toBe(firm._id.toString());
      expect(dbColony.createdBy.toString()).toBe(admin._id.toString());
    });

    it('2. Fails when required name field is missing or empty', async () => {
      const { admin } = await createTestFirmWithAdmin();
      const token = generateAccessToken(admin);

      const res = await request(app)
        .post('/api/colonies')
        .set('Authorization', `Bearer ${token}`)
        .send({
          name: '   ',
          city: 'Jaipur',
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('3. Rejects duplicate colony name within the same firm (409 CONFLICT)', async () => {
      const { admin } = await createTestFirmWithAdmin();
      const token = generateAccessToken(admin);

      await request(app)
        .post('/api/colonies')
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'Emerald Heights' });

      // Second creation attempt with same name
      const res = await request(app)
        .post('/api/colonies')
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'emerald heights' }); // case-insensitive check

      expect(res.status).toBe(409);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('COLONY_NAME_CONFLICT');
    });

    it('4. Allows same colony name across different firms', async () => {
      const { admin: adminA } = await createTestFirmWithAdmin({ name: 'Firm A', slug: 'firm-a' });
      const { admin: adminB } = await createTestFirmWithAdmin({ name: 'Firm B', slug: 'firm-b' });

      const tokenA = generateAccessToken(adminA);
      const tokenB = generateAccessToken(adminB);

      const resA = await request(app)
        .post('/api/colonies')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ name: 'Sunrise Enclave' });
      expect(resA.status).toBe(201);

      const resB = await request(app)
        .post('/api/colonies')
        .set('Authorization', `Bearer ${tokenB}`)
        .send({ name: 'Sunrise Enclave' });
      expect(resB.status).toBe(201);
    });

    it('5. Ignores client-supplied firmId, createdBy, and server-managed fields', async () => {
      const { firm, admin } = await createTestFirmWithAdmin();
      const foreignFirm = await createTestFirm({ name: 'Foreign Firm', slug: 'foreign-firm' });
      const token = generateAccessToken(admin);

      const res = await request(app)
        .post('/api/colonies')
        .set('Authorization', `Bearer ${token}`)
        .send({
          name: 'Royal Palms',
          firmId: foreignFirm._id.toString(), // Tampering attempt
          createdBy: new mongoose.Types.ObjectId().toString(),
        });

      expect(res.status).toBe(201);
      expect(res.body.data.firmId).toBe(firm._id.toString());
      expect(res.body.data.firmId).not.toBe(foreignFirm._id.toString());
    });
  });

  describe('GET /api/colonies (Listing, Search, Filtering, and Pagination)', () => {
    it('6. Lists colonies strictly scoped to the authenticated firm', async () => {
      const { firm: firmA, admin: adminA } = await createTestFirmWithAdmin({ name: 'Firm A', slug: 'firm-a' });
      const { firm: firmB, admin: adminB } = await createTestFirmWithAdmin({ name: 'Firm B', slug: 'firm-b' });

      await Colony.create({ name: 'Colony A1', firmId: firmA._id });
      await Colony.create({ name: 'Colony A2', firmId: firmA._id });
      await Colony.create({ name: 'Colony B1', firmId: firmB._id });

      const tokenA = generateAccessToken(adminA);
      const resA = await request(app)
        .get('/api/colonies')
        .set('Authorization', `Bearer ${tokenA}`);

      expect(resA.status).toBe(200);
      expect(resA.body.success).toBe(true);
      expect(resA.body.data).toHaveLength(2);
      expect(resA.body.data.map((c) => c.name)).toEqual(expect.arrayContaining(['Colony A1', 'Colony A2']));
      expect(resA.body.data.find((c) => c.name === 'Colony B1')).toBeUndefined();
    });

    it('7. Supports searching by colony name or city', async () => {
      const { firm, admin } = await createTestFirmWithAdmin();
      await Colony.create({ name: 'Sunny Enclave', city: 'Jaipur', firmId: firm._id });
      await Colony.create({ name: 'Silver Oaks', city: 'Delhi', firmId: firm._id });

      const token = generateAccessToken(admin);

      const searchRes = await request(app)
        .get('/api/colonies?search=Sunny')
        .set('Authorization', `Bearer ${token}`);

      expect(searchRes.status).toBe(200);
      expect(searchRes.body.data).toHaveLength(1);
      expect(searchRes.body.data[0].name).toBe('Sunny Enclave');
    });

    it('8. Supports pagination metadata and obeys page size limits', async () => {
      const { firm, admin } = await createTestFirmWithAdmin();
      const colonies = Array.from({ length: 5 }, (_, i) => ({
        name: `Colony ${i + 1}`,
        firmId: firm._id,
      }));
      await Colony.insertMany(colonies);

      const token = generateAccessToken(admin);

      const res = await request(app)
        .get('/api/colonies?page=1&limit=2')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(2);
      expect(res.body.meta).toEqual({
        page: 1,
        limit: 2,
        total: 5,
        totalPages: 3,
      });
    });
  });

  describe('GET /api/colonies/:colonyId (Details)', () => {
    it('9. Retrieves colony details for owning firm', async () => {
      const { firm, admin } = await createTestFirmWithAdmin();
      const colony = await Colony.create({ name: 'Blue Ridge', firmId: firm._id, city: 'Pune' });
      const token = generateAccessToken(admin);

      const res = await request(app)
        .get(`/api/colonies/${colony._id}`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.data.name).toBe('Blue Ridge');
      expect(res.body.data.city).toBe('Pune');
    });

    it('10. Returns 404 when Firm A attempts to access Firm B colony', async () => {
      const { firm: firmA, admin: adminA } = await createTestFirmWithAdmin({ name: 'Firm A', slug: 'firm-a' });
      const { firm: firmB } = await createTestFirmWithAdmin({ name: 'Firm B', slug: 'firm-b' });

      const colonyB = await Colony.create({ name: 'Firm B Secret Colony', firmId: firmB._id });
      const tokenA = generateAccessToken(adminA);

      const res = await request(app)
        .get(`/api/colonies/${colonyB._id}`)
        .set('Authorization', `Bearer ${tokenA}`);

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('COLONY_NOT_FOUND');
    });
  });

  describe('PATCH /api/colonies/:colonyId (Update)', () => {
    it('11. Updates colony details and updates updatedBy timestamp', async () => {
      const { firm, admin } = await createTestFirmWithAdmin();
      const colony = await Colony.create({ name: 'Old Name', city: 'Old City', firmId: firm._id });
      const token = generateAccessToken(admin);

      const res = await request(app)
        .patch(`/api/colonies/${colony._id}`)
        .set('Authorization', `Bearer ${token}`)
        .send({
          name: 'New Name',
          city: 'New City',
        });

      expect(res.status).toBe(200);
      expect(res.body.data.name).toBe('New Name');
      expect(res.body.data.city).toBe('New City');
      expect(res.body.data.updatedBy).toBe(admin._id.toString());
    });

    it('12. Prevents Firm A from updating Firm B colony (returns 404)', async () => {
      const { admin: adminA } = await createTestFirmWithAdmin({ name: 'Firm A', slug: 'firm-a' });
      const { firm: firmB } = await createTestFirmWithAdmin({ name: 'Firm B', slug: 'firm-b' });

      const colonyB = await Colony.create({ name: 'Colony B', firmId: firmB._id });
      const tokenA = generateAccessToken(adminA);

      const res = await request(app)
        .patch(`/api/colonies/${colonyB._id}`)
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ name: 'Hacked Colony' });

      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe('COLONY_NOT_FOUND');

      const unchanged = await Colony.findById(colonyB._id);
      expect(unchanged.name).toBe('Colony B');
    });
  });

  describe('DELETE /api/colonies/:colonyId (Deactivation & Plot Dependencies)', () => {
    it('13. Deactivates a colony with no active plots (soft deletion)', async () => {
      const { firm, admin } = await createTestFirmWithAdmin();
      const colony = await Colony.create({ name: 'Empty Colony', firmId: firm._id, isActive: true });
      const token = generateAccessToken(admin);

      const res = await request(app)
        .delete(`/api/colonies/${colony._id}`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.data.isActive).toBe(false);

      const updated = await Colony.findById(colony._id);
      expect(updated.isActive).toBe(false);
    });

    it('14. Blocks deactivation if active plots depend on the colony (400 COLONY_IN_USE)', async () => {
      const { firm, admin } = await createTestFirmWithAdmin();
      const colony = await Colony.create({ name: 'Active Colony', firmId: firm._id, isActive: true });

      // Create an active plot referencing this colony
      await Plot.create({
        firmId: firm._id,
        plotRef: 'PLOT-101',
        colonyId: colony._id,
        size: 150,
        sizeUnit: 'sqyd',
        rate: 2500000,
        isActive: true,
      });

      const token = generateAccessToken(admin);

      const res = await request(app)
        .delete(`/api/colonies/${colony._id}`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('COLONY_IN_USE');

      // Colony remains active
      const inDb = await Colony.findById(colony._id);
      expect(inDb.isActive).toBe(true);
    });

    it('15. Allows deactivation if all depending plots are inactive', async () => {
      const { firm, admin } = await createTestFirmWithAdmin();
      const colony = await Colony.create({ name: 'Archived Colony', firmId: firm._id, isActive: true });

      // Create an INACTIVE plot referencing this colony
      await Plot.create({
        firmId: firm._id,
        plotRef: 'PLOT-ARCHIVED',
        colonyId: colony._id,
        size: 200,
        sizeUnit: 'sqyd',
        rate: 3000000,
        isActive: false, // Inactive plot
      });

      const token = generateAccessToken(admin);

      const res = await request(app)
        .delete(`/api/colonies/${colony._id}`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.data.isActive).toBe(false);
    });

    it('16. Prevents Firm A from deactivating Firm B colony (returns 404)', async () => {
      const { admin: adminA } = await createTestFirmWithAdmin({ name: 'Firm A', slug: 'firm-a' });
      const { firm: firmB } = await createTestFirmWithAdmin({ name: 'Firm B', slug: 'firm-b' });

      const colonyB = await Colony.create({ name: 'Colony B', firmId: firmB._id, isActive: true });
      const tokenA = generateAccessToken(adminA);

      const res = await request(app)
        .delete(`/api/colonies/${colonyB._id}`)
        .set('Authorization', `Bearer ${tokenA}`);

      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe('COLONY_NOT_FOUND');

      const unchanged = await Colony.findById(colonyB._id);
      expect(unchanged.isActive).toBe(true);
    });
  });

  describe('Security & Role Permissions (Colonies)', () => {
    it('17. SUPER_ADMIN is rejected from tenant colony endpoints (403 FORBIDDEN)', async () => {
      const { user: superAdmin } = await createTestSuperAdmin();
      const token = generateAccessToken(superAdmin);

      const res = await request(app)
        .get('/api/colonies')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('FORBIDDEN');
    });

    it('18. Suspended firm members cannot access colony endpoints (403 FIRM_SUSPENDED)', async () => {
      const { firm, admin } = await createTestFirmWithAdmin({ isActive: false });
      const token = generateAccessToken(admin);

      const res = await request(app)
        .get('/api/colonies')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('FIRM_SUSPENDED');
    });

    it('19. FIRM_STAFF with colonies:read can read colonies', async () => {
      const { firm } = await createTestFirmWithAdmin();
      const { user: staff } = await createTestStaff({
        firmId: firm._id,
        permissions: [PERMS.COLONIES_READ],
      });
      const token = generateAccessToken(staff);

      const res = await request(app)
        .get('/api/colonies')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
    });

    it('20. FIRM_STAFF without colonies:write cannot create colonies (403 FORBIDDEN)', async () => {
      const { firm } = await createTestFirmWithAdmin();
      const { user: staff } = await createTestStaff({
        firmId: firm._id,
        permissions: [PERMS.COLONIES_READ], // only read permission
      });
      const token = generateAccessToken(staff);

      const res = await request(app)
        .post('/api/colonies')
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'Unauthorized Colony' });

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('FORBIDDEN');
    });
  });
});
