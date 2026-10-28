/**
 * tests/integration/plotPrivate.test.js
 *
 * Private Owner/Source Data & Access Control Test Suite (Phase 5).
 *
 * Verifies:
 *  1. FIRM_ADMIN can read and write private details within their own firm
 *  2. FIRM_STAFF is denied by default (no explicit private permissions)
 *  3. FIRM_STAFF with private:read can read private details within firm
 *  4. FIRM_STAFF with private:write can write, but staff with only private:read cannot write
 *  5. SUPER_ADMIN cannot access private details through tenant routes (403 FORBIDDEN)
 *  6. Unauthenticated requests are rejected (401 UNAUTHORIZED)
 *  7. Cross-firm read, update, and delete attempts return 404 NOT_FOUND without disclosing private data
 *  8. Client-supplied firmId, createdBy, updatedBy cannot bypass authorization or tamper with audit fields
 *  9. PlotPrivate referencing a plot in another firm is rejected
 * 10. PlotPrivate firmId strictly matches the referenced plot's firmId
 * 11. Ordinary plot detail and list responses never contain private owner/source fields
 * 12. Search, filtering, and listing never leak private data
 * 13. Invalid private fields (unapproved fields like nationalId, invalid emails) are rejected by schema validation
 * 14. Existing Phase 1–4 regression and security tests continue to pass
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import mongoose from 'mongoose';
import { app } from '../../src/app.js';
import { connectDB, disconnectDB } from '../../src/config/db.js';
import { Plot } from '../../src/models/Plot.model.js';
import { PlotPrivate } from '../../src/models/PlotPrivate.model.js';
import { Firm } from '../../src/models/Firm.model.js';
import { User } from '../../src/models/User.model.js';
import { PERMS } from '../../src/constants/permissions.js';
import { generateAccessToken } from '../../src/services/token.service.js';
import {
  createTestFirmWithAdmin,
  createTestStaff,
  createTestSuperAdmin,
  createTestFirm,
} from '../setup/fixtures.js';

describe('Private Owner/Source Data & Access Control (Phase 5)', () => {
  beforeAll(async () => {
    await connectDB();
  });

  afterAll(async () => {
    await disconnectDB();
  });

  beforeEach(async () => {
    await PlotPrivate.deleteMany({});
    await Plot.deleteMany({});
    await Firm.deleteMany({});
    await User.deleteMany({});
  });

  describe('PUT /api/plots/:plotId/private (Create / Replace)', () => {
    it('1. FIRM_ADMIN can create and replace private details within their own firm', async () => {
      const { firm, admin } = await createTestFirmWithAdmin();
      const plot = await Plot.create({
        firmId: firm._id,
        plotRef: 'PLOT-PRIV-1',
        size: 150,
        sizeUnit: 'sqyd',
        rate: 2500000,
      });
      const token = generateAccessToken(admin);

      const payload = {
        owner: {
          name: 'Rajesh Sharma',
          phone: '+91 98765 11111',
          email: 'rajesh.sharma@example.com',
          address: '123 Heritage Lane, Civil Lines',
        },
        source: {
          name: 'Sunil Verma',
          phone: '+91 98765 22222',
          email: 'sunil.broker@example.com',
          type: 'broker',
        },
        notes: 'Seller willing to negotiate 5% on immediate closing',
      };

      const res = await request(app)
        .put(`/api/plots/${plot._id}/private`)
        .set('Authorization', `Bearer ${token}`)
        .send(payload);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toMatchObject({
        plotId: plot._id.toString(),
        firmId: firm._id.toString(),
        owner: {
          name: 'Rajesh Sharma',
          phone: '+91 98765 11111',
          email: 'rajesh.sharma@example.com',
          address: '123 Heritage Lane, Civil Lines',
        },
        source: {
          name: 'Sunil Verma',
          phone: '+91 98765 22222',
          email: 'sunil.broker@example.com',
          type: 'broker',
        },
        notes: 'Seller willing to negotiate 5% on immediate closing',
      });
      expect(res.body.data.id).toBeDefined();

      // Verify in PlotPrivate collection
      const dbRecord = await PlotPrivate.findById(res.body.data.id);
      expect(dbRecord).not.toBeNull();
      expect(dbRecord.plotId.toString()).toBe(plot._id.toString());
      expect(dbRecord.firmId.toString()).toBe(firm._id.toString());
      expect(dbRecord.createdBy.toString()).toBe(admin._id.toString());
    });

    it('2. Also accepts flat aliases (ownerName, ownerPhone, etc.)', async () => {
      const { firm, admin } = await createTestFirmWithAdmin();
      const plot = await Plot.create({
        firmId: firm._id,
        plotRef: 'PLOT-PRIV-FLAT',
        size: 100,
        sizeUnit: 'sqft',
        rate: 500000,
      });
      const token = generateAccessToken(admin);

      const res = await request(app)
        .put(`/api/plots/${plot._id}/private`)
        .set('Authorization', `Bearer ${token}`)
        .send({
          ownerName: 'Vikram Singh',
          ownerPhone: '+91 91234 56789',
          sourceName: 'Direct Referral',
          notes: 'Direct owner contact',
        });

      expect(res.status).toBe(200);
      expect(res.body.data.owner.name).toBe('Vikram Singh');
      expect(res.body.data.ownerName).toBe('Vikram Singh');
      expect(res.body.data.owner.phone).toBe('+91 91234 56789');
    });

    it('3. Rejects unapproved fields (e.g. nationalId, aadhaar, commission) via strict schema validation', async () => {
      const { firm, admin } = await createTestFirmWithAdmin();
      const plot = await Plot.create({
        firmId: firm._id,
        plotRef: 'PLOT-STRICT',
        size: 100,
        sizeUnit: 'sqft',
        rate: 500000,
      });
      const token = generateAccessToken(admin);

      const res = await request(app)
        .put(`/api/plots/${plot._id}/private`)
        .set('Authorization', `Bearer ${token}`)
        .send({
          ownerName: 'Vikram Singh',
          nationalId: '1234-5678-9012', // Unapproved sensitive field
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('4. Rejects invalid email format', async () => {
      const { firm, admin } = await createTestFirmWithAdmin();
      const plot = await Plot.create({
        firmId: firm._id,
        plotRef: 'PLOT-BAD-EMAIL',
        size: 100,
        sizeUnit: 'sqft',
        rate: 500000,
      });
      const token = generateAccessToken(admin);

      const res = await request(app)
        .put(`/api/plots/${plot._id}/private`)
        .set('Authorization', `Bearer ${token}`)
        .send({
          ownerEmail: 'not-an-email',
        });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('GET, PATCH, and DELETE /api/plots/:plotId/private', () => {
    it('5. Reads existing private details (GET)', async () => {
      const { firm, admin } = await createTestFirmWithAdmin();
      const plot = await Plot.create({
        firmId: firm._id,
        plotRef: 'PLOT-READ-1',
        size: 100,
        sizeUnit: 'sqft',
        rate: 500000,
      });
      await PlotPrivate.create({
        firmId: firm._id,
        plotId: plot._id,
        owner: { name: 'Owner One', phone: '1234567890' },
        notes: 'Secret note',
      });
      const token = generateAccessToken(admin);

      const res = await request(app)
        .get(`/api/plots/${plot._id}/private`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.data.owner.name).toBe('Owner One');
      expect(res.body.data.notes).toBe('Secret note');
    });

    it('6. Returns 404 when reading private details for a plot that has none', async () => {
      const { firm, admin } = await createTestFirmWithAdmin();
      const plot = await Plot.create({
        firmId: firm._id,
        plotRef: 'PLOT-NO-PRIV',
        size: 100,
        sizeUnit: 'sqft',
        rate: 500000,
      });
      const token = generateAccessToken(admin);

      const res = await request(app)
        .get(`/api/plots/${plot._id}/private`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe('PRIVATE_RECORD_NOT_FOUND');
    });

    it('7. Partially updates private details (PATCH)', async () => {
      const { firm, admin } = await createTestFirmWithAdmin();
      const plot = await Plot.create({
        firmId: firm._id,
        plotRef: 'PLOT-PATCH-1',
        size: 100,
        sizeUnit: 'sqft',
        rate: 500000,
      });
      await PlotPrivate.create({
        firmId: firm._id,
        plotId: plot._id,
        owner: { name: 'Initial Name', phone: '11111' },
        notes: 'Old note',
      });
      const token = generateAccessToken(admin);

      const res = await request(app)
        .patch(`/api/plots/${plot._id}/private`)
        .set('Authorization', `Bearer ${token}`)
        .send({
          notes: 'Updated note only',
        });

      expect(res.status).toBe(200);
      expect(res.body.data.notes).toBe('Updated note only');
      expect(res.body.data.owner.name).toBe('Initial Name'); // Preserved
    });

    it('8. Removes private details (DELETE)', async () => {
      const { firm, admin } = await createTestFirmWithAdmin();
      const plot = await Plot.create({
        firmId: firm._id,
        plotRef: 'PLOT-DEL-1',
        size: 100,
        sizeUnit: 'sqft',
        rate: 500000,
      });
      await PlotPrivate.create({
        firmId: firm._id,
        plotId: plot._id,
        owner: { name: 'To Delete' },
      });
      const token = generateAccessToken(admin);

      const delRes = await request(app)
        .delete(`/api/plots/${plot._id}/private`)
        .set('Authorization', `Bearer ${token}`);

      expect(delRes.status).toBe(200);

      const inDb = await PlotPrivate.findOne({ plotId: plot._id });
      expect(inDb).toBeNull();
    });
  });

  describe('Multi-Tenant Isolation & BOLA/IDOR Protection', () => {
    it('9. Denies cross-firm GET, PUT, PATCH, and DELETE with 404 NOT_FOUND without disclosing private data', async () => {
      const { admin: adminA } = await createTestFirmWithAdmin({ name: 'Firm A', slug: 'firm-a' });
      const { firm: firmB } = await createTestFirmWithAdmin({ name: 'Firm B', slug: 'firm-b' });

      const plotB = await Plot.create({
        firmId: firmB._id,
        plotRef: 'PLOT-B-SECRET',
        size: 200,
        sizeUnit: 'sqft',
        rate: 1000000,
      });

      await PlotPrivate.create({
        firmId: firmB._id,
        plotId: plotB._id,
        owner: { name: 'Firm B Secret Owner', phone: '+91 99999 88888' },
        notes: 'Top secret pricing bottom: 800000',
      });

      const tokenA = generateAccessToken(adminA);

      // GET attempt
      const getRes = await request(app)
        .get(`/api/plots/${plotB._id}/private`)
        .set('Authorization', `Bearer ${tokenA}`);
      expect(getRes.status).toBe(404);
      expect(getRes.body.error.code).toBe('PLOT_NOT_FOUND');
      expect(getRes.body.data).toBeUndefined();

      // PUT attempt
      const putRes = await request(app)
        .put(`/api/plots/${plotB._id}/private`)
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ ownerName: 'Hacker Overwrite' });
      expect(putRes.status).toBe(404);

      // PATCH attempt
      const patchRes = await request(app)
        .patch(`/api/plots/${plotB._id}/private`)
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ notes: 'Hacker note' });
      expect(patchRes.status).toBe(404);

      // DELETE attempt
      const delRes = await request(app)
        .delete(`/api/plots/${plotB._id}/private`)
        .set('Authorization', `Bearer ${tokenA}`);
      expect(delRes.status).toBe(404);

      // Confirm Firm B data remains intact
      const intact = await PlotPrivate.findOne({ plotId: plotB._id, firmId: firmB._id });
      expect(intact).not.toBeNull();
      expect(intact.owner.name).toBe('Firm B Secret Owner');
    });

    it('10. Client-supplied firmId, createdBy, and updatedBy are ignored and cannot tamper with tenant context', async () => {
      const { firm, admin } = await createTestFirmWithAdmin();
      const foreignFirm = await createTestFirm({ name: 'Other Firm', slug: 'other-firm' });
      const plot = await Plot.create({
        firmId: firm._id,
        plotRef: 'PLOT-TAMPER-PRIV',
        size: 100,
        sizeUnit: 'sqft',
        rate: 500000,
      });
      const token = generateAccessToken(admin);

      const res = await request(app)
        .put(`/api/plots/${plot._id}/private`)
        .set('Authorization', `Bearer ${token}`)
        .send({
          ownerName: 'Genuine Owner',
          firmId: foreignFirm._id.toString(), // Tamper attempt
          createdBy: new mongoose.Types.ObjectId().toString(),
          updatedBy: new mongoose.Types.ObjectId().toString(),
        });

      // Strict schema rejects unknown fields like firmId/createdBy
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('11. PlotPrivate firmId must strictly match the referenced plot firmId in the database', async () => {
      const { firm: firmA, admin: adminA } = await createTestFirmWithAdmin({ name: 'Firm A', slug: 'firm-a' });
      const { firm: firmB } = await createTestFirmWithAdmin({ name: 'Firm B', slug: 'firm-b' });

      // Plot belongs to Firm B
      const plotB = await Plot.create({
        firmId: firmB._id,
        plotRef: 'PLOT-B-REF',
        size: 100,
        sizeUnit: 'sqft',
        rate: 500000,
      });

      const tokenA = generateAccessToken(adminA);

      // Firm A tries to attach private details to Firm B's plot
      const res = await request(app)
        .put(`/api/plots/${plotB._id}/private`)
        .set('Authorization', `Bearer ${tokenA}`)
        .send({
          ownerName: 'Attempt to claim Firm B plot',
        });

      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe('PLOT_NOT_FOUND');

      const noRecord = await PlotPrivate.findOne({ plotId: plotB._id });
      expect(noRecord).toBeNull();
    });
  });

  describe('Strict Privacy & Leakage Prevention', () => {
    it('12. Ordinary plot detail (GET /api/plots/:id) and list (GET /api/plots) never leak private fields', async () => {
      const { firm, admin } = await createTestFirmWithAdmin();
      const plot = await Plot.create({
        firmId: firm._id,
        plotRef: 'PLOT-PUBLIC-VIEW',
        size: 100,
        sizeUnit: 'sqft',
        rate: 500000,
      });

      await PlotPrivate.create({
        firmId: firm._id,
        plotId: plot._id,
        owner: {
          name: 'Private Owner',
          phone: '+91 99999 00000',
          email: 'secret@owner.com',
          address: 'Secret Villa',
        },
        source: {
          name: 'Private Broker',
          phone: '+91 99999 11111',
          email: 'broker@private.com',
        },
        notes: 'Highly confidential seller motivation',
      });

      const token = generateAccessToken(admin);

      // Check plot detail
      const detailRes = await request(app)
        .get(`/api/plots/${plot._id}`)
        .set('Authorization', `Bearer ${token}`);

      expect(detailRes.status).toBe(200);
      const detailData = detailRes.body.data;
      expect(detailData.owner).toBeUndefined();
      expect(detailData.ownerName).toBeUndefined();
      expect(detailData.ownerPhone).toBeUndefined();
      expect(detailData.ownerEmail).toBeUndefined();
      expect(detailData.ownerAddress).toBeUndefined();
      expect(detailData.source).toBeUndefined();
      expect(detailData.sourceName).toBeUndefined();
      expect(detailData.sourcePhone).toBeUndefined();
      expect(detailData.sourceEmail).toBeUndefined();
      expect(detailData.notes).toBeUndefined();

      // Check plot list
      const listRes = await request(app)
        .get('/api/plots')
        .set('Authorization', `Bearer ${token}`);

      expect(listRes.status).toBe(200);
      const listPlot = listRes.body.data.find((p) => p.id === plot._id.toString());
      expect(listPlot).toBeDefined();
      expect(listPlot.owner).toBeUndefined();
      expect(listPlot.ownerName).toBeUndefined();
      expect(listPlot.notes).toBeUndefined();
    });

    it('13. Search and filtering do not leak private fields', async () => {
      const { firm, admin } = await createTestFirmWithAdmin();
      const plot = await Plot.create({
        firmId: firm._id,
        plotRef: 'PLOT-SEARCH-LEAK',
        size: 100,
        sizeUnit: 'sqft',
        rate: 500000,
      });
      await PlotPrivate.create({
        firmId: firm._id,
        plotId: plot._id,
        owner: { name: 'UniqueSecretOwnerName' },
        notes: 'Private note',
      });
      const token = generateAccessToken(admin);

      // Searching for private owner name in public plot search must return nothing
      const searchRes = await request(app)
        .get('/api/plots?search=UniqueSecretOwnerName')
        .set('Authorization', `Bearer ${token}`);

      expect(searchRes.status).toBe(200);
      expect(searchRes.body.data).toHaveLength(0);
    });
  });

  describe('Role & Permission Authorization Guards', () => {
    it('14. FIRM_STAFF is denied by default (no explicit private permissions -> 403 FORBIDDEN)', async () => {
      const { firm } = await createTestFirmWithAdmin();
      const plot = await Plot.create({
        firmId: firm._id,
        plotRef: 'PLOT-STAFF-DENY',
        size: 100,
        sizeUnit: 'sqft',
        rate: 500000,
      });

      // Staff with ordinary plot permissions only
      const { user: staff } = await createTestStaff({
        firmId: firm._id,
        permissions: [PERMS.PLOTS_READ, PERMS.PLOTS_WRITE],
      });
      const token = generateAccessToken(staff);

      // GET denied
      const getRes = await request(app)
        .get(`/api/plots/${plot._id}/private`)
        .set('Authorization', `Bearer ${token}`);
      expect(getRes.status).toBe(403);
      expect(getRes.body.error.code).toBe('FORBIDDEN');

      // PUT denied
      const putRes = await request(app)
        .put(`/api/plots/${plot._id}/private`)
        .set('Authorization', `Bearer ${token}`)
        .send({ ownerName: 'Unauthorized Staff' });
      expect(putRes.status).toBe(403);
      expect(putRes.body.error.code).toBe('FORBIDDEN');
    });

    it('15. FIRM_STAFF with explicitly granted private:read can read private details', async () => {
      const { firm } = await createTestFirmWithAdmin();
      const plot = await Plot.create({
        firmId: firm._id,
        plotRef: 'PLOT-STAFF-READ',
        size: 100,
        sizeUnit: 'sqft',
        rate: 500000,
      });
      await PlotPrivate.create({
        firmId: firm._id,
        plotId: plot._id,
        owner: { name: 'Owner Visible to Authorized Staff' },
      });

      const { user: staff } = await createTestStaff({
        firmId: firm._id,
        permissions: [PERMS.PLOTS_READ, PERMS.PRIVATE_READ],
      });
      const token = generateAccessToken(staff);

      const res = await request(app)
        .get(`/api/plots/${plot._id}/private`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.data.owner.name).toBe('Owner Visible to Authorized Staff');
    });

    it('16. FIRM_STAFF with only private:read cannot write (PUT/PATCH/DELETE -> 403 FORBIDDEN)', async () => {
      const { firm } = await createTestFirmWithAdmin();
      const plot = await Plot.create({
        firmId: firm._id,
        plotRef: 'PLOT-STAFF-RO',
        size: 100,
        sizeUnit: 'sqft',
        rate: 500000,
      });
      await PlotPrivate.create({
        firmId: firm._id,
        plotId: plot._id,
        owner: { name: 'Initial Owner' },
      });

      const { user: staff } = await createTestStaff({
        firmId: firm._id,
        permissions: [PERMS.PLOTS_READ, PERMS.PRIVATE_READ], // read only
      });
      const token = generateAccessToken(staff);

      // PUT denied
      const putRes = await request(app)
        .put(`/api/plots/${plot._id}/private`)
        .set('Authorization', `Bearer ${token}`)
        .send({ ownerName: 'Staff Attempting Write' });
      expect(putRes.status).toBe(403);

      // PATCH denied
      const patchRes = await request(app)
        .patch(`/api/plots/${plot._id}/private`)
        .set('Authorization', `Bearer ${token}`)
        .send({ notes: 'Staff Patch Attempt' });
      expect(patchRes.status).toBe(403);

      // DELETE denied
      const delRes = await request(app)
        .delete(`/api/plots/${plot._id}/private`)
        .set('Authorization', `Bearer ${token}`);
      expect(delRes.status).toBe(403);
    });

    it('17. FIRM_STAFF with private:write can perform write operations', async () => {
      const { firm } = await createTestFirmWithAdmin();
      const plot = await Plot.create({
        firmId: firm._id,
        plotRef: 'PLOT-STAFF-RW',
        size: 100,
        sizeUnit: 'sqft',
        rate: 500000,
      });

      const { user: staff } = await createTestStaff({
        firmId: firm._id,
        permissions: [PERMS.PLOTS_READ, PERMS.PRIVATE_READ, PERMS.PRIVATE_WRITE],
      });
      const token = generateAccessToken(staff);

      const putRes = await request(app)
        .put(`/api/plots/${plot._id}/private`)
        .set('Authorization', `Bearer ${token}`)
        .send({ ownerName: 'Authorized Staff Owner' });

      expect(putRes.status).toBe(200);
      expect(putRes.body.data.owner.name).toBe('Authorized Staff Owner');
    });

    it('18. SUPER_ADMIN is rejected from private endpoints through tenant routes (403 FORBIDDEN)', async () => {
      const { firm } = await createTestFirmWithAdmin();
      const plot = await Plot.create({
        firmId: firm._id,
        plotRef: 'PLOT-SUPER-DENY',
        size: 100,
        sizeUnit: 'sqft',
        rate: 500000,
      });

      const { user: superAdmin } = await createTestSuperAdmin();
      const token = generateAccessToken(superAdmin);

      const res = await request(app)
        .get(`/api/plots/${plot._id}/private`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('FORBIDDEN');
    });

    it('19. Unauthenticated requests are rejected with 401 UNAUTHORIZED', async () => {
      const fakeId = new mongoose.Types.ObjectId();
      const res = await request(app).get(`/api/plots/${fakeId}/private`);
      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('UNAUTHORIZED');
    });
  });
});
