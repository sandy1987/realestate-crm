/**
 * tests/integration/plots.test.js
 *
 * Plot Management Integration Test Suite (Phase 4).
 *
 * Verifies:
 *  1. Valid plot creation with required business fields
 *  2. Invalid size, rate, unit, rate type, and date validation errors
 *  3. Duplicate plot identifier within firm rejected (409)
 *  4. Same plot identifier permitted across different firms
 *  5. Rejection of colony belonging to another firm or non-existent colony
 *  6. Firm-scoped plot listing, search, and multi-parameter filtering
 *  7. Pagination cap at 100 and sort-field whitelist
 *  8. Update and deactivation (soft delete)
 *  9. Cross-firm detail, update, and delete attempts (404 NOT_FOUND)
 * 10. Tampering protection: client-supplied firmId, createdBy, updatedBy ignored
 * 11. Syntactic video URL validation (YouTube & Vimeo, domain checks, no SSRF)
 * 12. Privacy check: zero owner/source details in plot responses
 * 13. Role & permission guards (FIRM_ADMIN vs FIRM_STAFF permissions, SUPER_ADMIN 403, suspended firm 403)
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import mongoose from 'mongoose';
import { app } from '../../src/app.js';
import { connectDB, disconnectDB } from '../../src/config/db.js';
import { Plot } from '../../src/models/Plot.model.js';
import { Colony } from '../../src/models/Colony.model.js';
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

describe('Plot Management API (Phase 4)', () => {
  beforeAll(async () => {
    await connectDB();
  });

  afterAll(async () => {
    await disconnectDB();
  });

  beforeEach(async () => {
    await Plot.deleteMany({});
    await Colony.deleteMany({});
    await Firm.deleteMany({});
    await User.deleteMany({});
  });

  describe('POST /api/plots (Creation)', () => {
    it('1. Successfully creates a valid plot with required business fields', async () => {
      const { firm, admin } = await createTestFirmWithAdmin();
      const colony = await Colony.create({ name: 'Green Valley', firmId: firm._id });
      const token = generateAccessToken(admin);

      const payload = {
        plotRef: 'PLOT-A-101',
        colonyId: colony._id.toString(),
        plotDate: '2026-05-15',
        size: 250,
        sizeUnit: 'sqyd',
        rate: 4500000,
        rateType: 'total',
        currency: 'INR',
        description: 'Corner plot facing north park',
        status: 'available',
        videoUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
      };

      const res = await request(app)
        .post('/api/plots')
        .set('Authorization', `Bearer ${token}`)
        .send(payload);

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toMatchObject({
        plotRef: 'PLOT-A-101',
        plotId: 'PLOT-A-101',
        firmId: firm._id.toString(),
        colonyId: colony._id.toString(),
        size: 250,
        sizeUnit: 'sqyd',
        rate: 4500000,
        rateType: 'total',
        currency: 'INR',
        status: 'available',
        videoUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
        videoProvider: 'youtube',
        isActive: true,
      });
      expect(res.body.data.id).toBeDefined();

      // Verify in DB
      const dbPlot = await Plot.findById(res.body.data.id);
      expect(dbPlot).not.toBeNull();
      expect(dbPlot.firmId.toString()).toBe(firm._id.toString());
      expect(dbPlot.createdBy.toString()).toBe(admin._id.toString());
    });

    it('2. Accepts plotId as an alias for plotRef during creation', async () => {
      const { firm, admin } = await createTestFirmWithAdmin();
      const token = generateAccessToken(admin);

      const res = await request(app)
        .post('/api/plots')
        .set('Authorization', `Bearer ${token}`)
        .send({
          plotId: 'PLOT-ALIAS-01',
          size: 100,
          sizeUnit: 'sqft',
          rate: 500000,
        });

      expect(res.status).toBe(201);
      expect(res.body.data.plotRef).toBe('PLOT-ALIAS-01');
      expect(res.body.data.plotId).toBe('PLOT-ALIAS-01');
    });

    it('3. Fails when required fields (plotRef, size, sizeUnit, rate) are invalid', async () => {
      const { admin } = await createTestFirmWithAdmin();
      const token = generateAccessToken(admin);

      // Missing size and rate
      const res1 = await request(app)
        .post('/api/plots')
        .set('Authorization', `Bearer ${token}`)
        .send({
          plotRef: 'PLOT-ERR-1',
          sizeUnit: 'sqft',
        });
      expect(res1.status).toBe(400);

      // Negative size
      const res2 = await request(app)
        .post('/api/plots')
        .set('Authorization', `Bearer ${token}`)
        .send({
          plotRef: 'PLOT-ERR-2',
          size: -50,
          sizeUnit: 'sqft',
          rate: 100000,
        });
      expect(res2.status).toBe(400);

      // Negative rate
      const res3 = await request(app)
        .post('/api/plots')
        .set('Authorization', `Bearer ${token}`)
        .send({
          plotRef: 'PLOT-ERR-3',
          size: 150,
          sizeUnit: 'sqft',
          rate: -2000,
        });
      expect(res3.status).toBe(400);

      // Invalid size unit
      const res4 = await request(app)
        .post('/api/plots')
        .set('Authorization', `Bearer ${token}`)
        .send({
          plotRef: 'PLOT-ERR-4',
          size: 150,
          sizeUnit: 'lightyears',
          rate: 100000,
        });
      expect(res4.status).toBe(400);

      // Invalid date format
      const res5 = await request(app)
        .post('/api/plots')
        .set('Authorization', `Bearer ${token}`)
        .send({
          plotRef: 'PLOT-ERR-5',
          size: 150,
          sizeUnit: 'sqft',
          rate: 100000,
          plotDate: 'not-a-valid-date',
        });
      expect(res5.status).toBe(400);
    });

    it('4. Rejects duplicate plotRef within the same firm (409 CONFLICT)', async () => {
      const { admin } = await createTestFirmWithAdmin();
      const token = generateAccessToken(admin);

      await request(app)
        .post('/api/plots')
        .set('Authorization', `Bearer ${token}`)
        .send({
          plotRef: 'PLOT-DUP-1',
          size: 100,
          sizeUnit: 'sqft',
          rate: 500000,
        });

      // Second plot with same reference
      const res = await request(app)
        .post('/api/plots')
        .set('Authorization', `Bearer ${token}`)
        .send({
          plotRef: 'PLOT-DUP-1',
          size: 200,
          sizeUnit: 'sqft',
          rate: 700000,
        });

      expect(res.status).toBe(409);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('PLOT_REF_CONFLICT');
    });

    it('5. Allows same plotRef across different firms', async () => {
      const { admin: adminA } = await createTestFirmWithAdmin({ name: 'Firm A', slug: 'firm-a' });
      const { admin: adminB } = await createTestFirmWithAdmin({ name: 'Firm B', slug: 'firm-b' });

      const tokenA = generateAccessToken(adminA);
      const tokenB = generateAccessToken(adminB);

      const resA = await request(app)
        .post('/api/plots')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({
          plotRef: 'PLOT-COMMON-01',
          size: 100,
          sizeUnit: 'sqft',
          rate: 500000,
        });
      expect(resA.status).toBe(201);

      const resB = await request(app)
        .post('/api/plots')
        .set('Authorization', `Bearer ${tokenB}`)
        .send({
          plotRef: 'PLOT-COMMON-01',
          size: 200,
          sizeUnit: 'sqft',
          rate: 600000,
        });
      expect(resB.status).toBe(201);
    });

    it('6. Rejects plot referencing a colony belonging to another firm (400 INVALID_COLONY)', async () => {
      const { admin: adminA } = await createTestFirmWithAdmin({ name: 'Firm A', slug: 'firm-a' });
      const { firm: firmB } = await createTestFirmWithAdmin({ name: 'Firm B', slug: 'firm-b' });

      const colonyB = await Colony.create({ name: 'Firm B Colony', firmId: firmB._id });
      const tokenA = generateAccessToken(adminA);

      const res = await request(app)
        .post('/api/plots')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({
          plotRef: 'PLOT-FOREIGN-COL',
          colonyId: colonyB._id.toString(),
          size: 100,
          sizeUnit: 'sqft',
          rate: 500000,
        });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('INVALID_COLONY');
    });

    it('7. Rejects plot referencing a non-existent colonyId (400 INVALID_COLONY)', async () => {
      const { admin } = await createTestFirmWithAdmin();
      const fakeColonyId = new mongoose.Types.ObjectId().toString();
      const token = generateAccessToken(admin);

      const res = await request(app)
        .post('/api/plots')
        .set('Authorization', `Bearer ${token}`)
        .send({
          plotRef: 'PLOT-FAKE-COL',
          colonyId: fakeColonyId,
          size: 100,
          sizeUnit: 'sqft',
          rate: 500000,
        });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('INVALID_COLONY');
    });

    it('8. Ignores client-supplied firmId, createdBy, and updatedBy', async () => {
      const { firm, admin } = await createTestFirmWithAdmin();
      const foreignFirm = await createTestFirm({ name: 'Hacker Firm', slug: 'hacker-firm' });
      const token = generateAccessToken(admin);

      const res = await request(app)
        .post('/api/plots')
        .set('Authorization', `Bearer ${token}`)
        .send({
          plotRef: 'PLOT-TAMPER',
          size: 100,
          sizeUnit: 'sqft',
          rate: 500000,
          firmId: foreignFirm._id.toString(), // Attacker tries to inject firmId
          createdBy: new mongoose.Types.ObjectId().toString(),
          updatedBy: new mongoose.Types.ObjectId().toString(),
        });

      expect(res.status).toBe(201);
      expect(res.body.data.firmId).toBe(firm._id.toString());
      expect(res.body.data.firmId).not.toBe(foreignFirm._id.toString());
      expect(res.body.data.createdBy).toBe(admin._id.toString());
    });
  });

  describe('Video URL and Provider Validation', () => {
    it('9. Accepts valid YouTube and Vimeo URLs', async () => {
      const { admin } = await createTestFirmWithAdmin();
      const token = generateAccessToken(admin);

      // YouTube short link
      const res1 = await request(app)
        .post('/api/plots')
        .set('Authorization', `Bearer ${token}`)
        .send({
          plotRef: 'PLOT-YT-1',
          size: 100,
          sizeUnit: 'sqft',
          rate: 500000,
          videoUrl: 'https://youtu.be/dQw4w9WgXcQ',
        });
      expect(res1.status).toBe(201);
      expect(res1.body.data.videoProvider).toBe('youtube');

      // Vimeo link
      const res2 = await request(app)
        .post('/api/plots')
        .set('Authorization', `Bearer ${token}`)
        .send({
          plotRef: 'PLOT-VIMEO-1',
          size: 100,
          sizeUnit: 'sqft',
          rate: 500000,
          videoUrl: 'https://vimeo.com/76979871',
          videoProvider: 'vimeo',
        });
      expect(res2.status).toBe(201);
      expect(res2.body.data.videoProvider).toBe('vimeo');
    });

    it('10. Rejects URL with mismatched provider or untrusted domain', async () => {
      const { admin } = await createTestFirmWithAdmin();
      const token = generateAccessToken(admin);

      // Provider mismatch (YouTube URL with vimeo provider)
      const res1 = await request(app)
        .post('/api/plots')
        .set('Authorization', `Bearer ${token}`)
        .send({
          plotRef: 'PLOT-MISMATCH',
          size: 100,
          sizeUnit: 'sqft',
          rate: 500000,
          videoUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
          videoProvider: 'vimeo',
        });
      expect(res1.status).toBe(400);
      expect(res1.body.error.code).toBe('INVALID_VIDEO_URL');

      // Untrusted domain (SSRF attempt)
      const res2 = await request(app)
        .post('/api/plots')
        .set('Authorization', `Bearer ${token}`)
        .send({
          plotRef: 'PLOT-UNTRUSTED',
          size: 100,
          sizeUnit: 'sqft',
          rate: 500000,
          videoUrl: 'https://attacker.com/malicious-video.mp4',
        });
      expect(res2.status).toBe(400);
      expect(res2.body.error.code).toBe('INVALID_VIDEO_URL');

      // Non-HTTP/HTTPS protocol
      const res3 = await request(app)
        .post('/api/plots')
        .set('Authorization', `Bearer ${token}`)
        .send({
          plotRef: 'PLOT-FILE-PROTO',
          size: 100,
          sizeUnit: 'sqft',
          rate: 500000,
          videoUrl: 'file:///etc/passwd',
        });
      expect(res3.status).toBe(400);
    });

    it('11. Rejects video provider if not allowed in firm settings', async () => {
      // Create firm that only allows Vimeo
      const { admin } = await createTestFirmWithAdmin({
        settings: { allowedVideoProviders: ['vimeo'], defaultCurrency: 'INR' },
      });
      const token = generateAccessToken(admin);

      const res = await request(app)
        .post('/api/plots')
        .set('Authorization', `Bearer ${token}`)
        .send({
          plotRef: 'PLOT-DISALLOWED-PROVIDER',
          size: 100,
          sizeUnit: 'sqft',
          rate: 500000,
          videoUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
        });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('INVALID_VIDEO_URL');
      expect(res.body.error.message).toContain('not permitted by your firm settings');
    });
  });

  describe('GET /api/plots (Listing, Searching, Filtering, Sorting, and Pagination)', () => {
    it('12. Lists plots strictly scoped to the authenticated firm', async () => {
      const { firm: firmA, admin: adminA } = await createTestFirmWithAdmin({ name: 'Firm A', slug: 'firm-a' });
      const { firm: firmB, admin: adminB } = await createTestFirmWithAdmin({ name: 'Firm B', slug: 'firm-b' });

      await Plot.create({ firmId: firmA._id, plotRef: 'A-PLOT-1', size: 100, sizeUnit: 'sqft', rate: 1000 });
      await Plot.create({ firmId: firmA._id, plotRef: 'A-PLOT-2', size: 200, sizeUnit: 'sqft', rate: 2000 });
      await Plot.create({ firmId: firmB._id, plotRef: 'B-PLOT-1', size: 300, sizeUnit: 'sqft', rate: 3000 });

      const tokenA = generateAccessToken(adminA);
      const resA = await request(app)
        .get('/api/plots')
        .set('Authorization', `Bearer ${tokenA}`);

      expect(resA.status).toBe(200);
      expect(resA.body.data).toHaveLength(2);
      expect(resA.body.data.map((p) => p.plotRef)).toEqual(expect.arrayContaining(['A-PLOT-1', 'A-PLOT-2']));
      expect(resA.body.data.find((p) => p.plotRef === 'B-PLOT-1')).toBeUndefined();
    });

    it('13. Supports filtering by colony, status, size range, rate range, and date range', async () => {
      const { firm, admin } = await createTestFirmWithAdmin();
      const col1 = await Colony.create({ name: 'Colony 1', firmId: firm._id });
      const col2 = await Colony.create({ name: 'Colony 2', firmId: firm._id });

      await Plot.create({
        firmId: firm._id,
        plotRef: 'P-FILTER-1',
        colonyId: col1._id,
        size: 150,
        sizeUnit: 'sqft',
        rate: 1000000,
        status: 'available',
        plotDate: new Date('2026-01-10'),
      });

      await Plot.create({
        firmId: firm._id,
        plotRef: 'P-FILTER-2',
        colonyId: col2._id,
        size: 300,
        sizeUnit: 'sqft',
        rate: 3000000,
        status: 'sold',
        plotDate: new Date('2026-03-20'),
      });

      const token = generateAccessToken(admin);

      // Filter by colonyId
      const resCol = await request(app)
        .get(`/api/plots?colonyId=${col1._id}`)
        .set('Authorization', `Bearer ${token}`);
      expect(resCol.body.data).toHaveLength(1);
      expect(resCol.body.data[0].plotRef).toBe('P-FILTER-1');

      // Filter by status
      const resStatus = await request(app)
        .get('/api/plots?status=sold')
        .set('Authorization', `Bearer ${token}`);
      expect(resStatus.body.data).toHaveLength(1);
      expect(resStatus.body.data[0].plotRef).toBe('P-FILTER-2');

      // Filter by size range (200 - 400)
      const resSize = await request(app)
        .get('/api/plots?sizeMin=200&sizeMax=400')
        .set('Authorization', `Bearer ${token}`);
      expect(resSize.body.data).toHaveLength(1);
      expect(resSize.body.data[0].plotRef).toBe('P-FILTER-2');

      // Filter by rate range (500000 - 2000000)
      const resRate = await request(app)
        .get('/api/plots?rateMin=500000&rateMax=2000000')
        .set('Authorization', `Bearer ${token}`);
      expect(resRate.body.data).toHaveLength(1);
      expect(resRate.body.data[0].plotRef).toBe('P-FILTER-1');

      // Filter by date range (2026-03-01 to 2026-04-01)
      const resDate = await request(app)
        .get('/api/plots?plotDateFrom=2026-03-01&plotDateTo=2026-04-01')
        .set('Authorization', `Bearer ${token}`);
      expect(resDate.body.data).toHaveLength(1);
      expect(resDate.body.data[0].plotRef).toBe('P-FILTER-2');
    });

    it('14. Caps requested limit at 100 and applies sort whitelist', async () => {
      const { firm, admin } = await createTestFirmWithAdmin();
      const token = generateAccessToken(admin);

      // Request limit=250 -> capped at 100
      const resLimit = await request(app)
        .get('/api/plots?limit=250')
        .set('Authorization', `Bearer ${token}`);
      expect(resLimit.status).toBe(200);
      expect(resLimit.body.meta.limit).toBe(100);

      // Sort whitelist
      await Plot.create({ firmId: firm._id, plotRef: 'P-A', size: 100, sizeUnit: 'sqft', rate: 100 });
      await Plot.create({ firmId: firm._id, plotRef: 'P-B', size: 200, sizeUnit: 'sqft', rate: 50 });

      const resSort = await request(app)
        .get('/api/plots?sortBy=rate&sortOrder=asc')
        .set('Authorization', `Bearer ${token}`);
      expect(resSort.body.data[0].plotRef).toBe('P-B');
      expect(resSort.body.data[1].plotRef).toBe('P-A');
    });
  });

  describe('GET, PATCH, and DELETE /api/plots/:plotId', () => {
    it('15. Retrieves plot details by ID', async () => {
      const { firm, admin } = await createTestFirmWithAdmin();
      const plot = await Plot.create({
        firmId: firm._id,
        plotRef: 'PLOT-DETAIL-1',
        size: 150,
        sizeUnit: 'sqft',
        rate: 500000,
      });
      const token = generateAccessToken(admin);

      const res = await request(app)
        .get(`/api/plots/${plot._id}`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.data.id).toBe(plot._id.toString());
      expect(res.body.data.plotRef).toBe('PLOT-DETAIL-1');
    });

    it('16. Updates plot details and deactivates plot (soft delete)', async () => {
      const { firm, admin } = await createTestFirmWithAdmin();
      const plot = await Plot.create({
        firmId: firm._id,
        plotRef: 'PLOT-UPD-1',
        size: 150,
        sizeUnit: 'sqft',
        rate: 500000,
        status: 'available',
      });
      const token = generateAccessToken(admin);

      // PATCH update
      const patchRes = await request(app)
        .patch(`/api/plots/${plot._id}`)
        .set('Authorization', `Bearer ${token}`)
        .send({
          rate: 550000,
          status: 'reserved',
        });

      expect(patchRes.status).toBe(200);
      expect(patchRes.body.data.rate).toBe(550000);
      expect(patchRes.body.data.status).toBe('reserved');
      expect(patchRes.body.data.updatedBy).toBe(admin._id.toString());

      // DELETE deactivation
      const delRes = await request(app)
        .delete(`/api/plots/${plot._id}`)
        .set('Authorization', `Bearer ${token}`);

      expect(delRes.status).toBe(200);
      expect(delRes.body.data.isActive).toBe(false);

      const inDb = await Plot.findById(plot._id);
      expect(inDb.isActive).toBe(false);
    });

    it('17. Denies cross-firm GET, PATCH, and DELETE with 404 NOT_FOUND', async () => {
      const { admin: adminA } = await createTestFirmWithAdmin({ name: 'Firm A', slug: 'firm-a' });
      const { firm: firmB } = await createTestFirmWithAdmin({ name: 'Firm B', slug: 'firm-b' });

      const plotB = await Plot.create({
        firmId: firmB._id,
        plotRef: 'FIRM-B-PLOT',
        size: 200,
        sizeUnit: 'sqft',
        rate: 800000,
      });

      const tokenA = generateAccessToken(adminA);

      // GET attempt
      const getRes = await request(app)
        .get(`/api/plots/${plotB._id}`)
        .set('Authorization', `Bearer ${tokenA}`);
      expect(getRes.status).toBe(404);
      expect(getRes.body.error.code).toBe('PLOT_NOT_FOUND');

      // PATCH attempt
      const patchRes = await request(app)
        .patch(`/api/plots/${plotB._id}`)
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ rate: 100 });
      expect(patchRes.status).toBe(404);

      // DELETE attempt
      const delRes = await request(app)
        .delete(`/api/plots/${plotB._id}`)
        .set('Authorization', `Bearer ${tokenA}`);
      expect(delRes.status).toBe(404);

      // Verify untouched
      const dbPlot = await Plot.findById(plotB._id);
      expect(dbPlot.rate).toBe(800000);
      expect(dbPlot.isActive).toBe(true);
    });
  });

  describe('Privacy & Role Enforcement', () => {
    it('18. Strict privacy: no private owner or source contact info in any response', async () => {
      const { firm, admin } = await createTestFirmWithAdmin();
      const plot = await Plot.create({
        firmId: firm._id,
        plotRef: 'PRIVACY-TEST',
        size: 150,
        sizeUnit: 'sqft',
        rate: 500000,
      });
      const token = generateAccessToken(admin);

      const res = await request(app)
        .get(`/api/plots/${plot._id}`)
        .set('Authorization', `Bearer ${token}`);

      const data = res.body.data;
      expect(data.ownerName).toBeUndefined();
      expect(data.ownerPhone).toBeUndefined();
      expect(data.ownerEmail).toBeUndefined();
      expect(data.source).toBeUndefined();
      expect(data.commission).toBeUndefined();
      expect(data.privateNotes).toBeUndefined();
    });

    it('19. SUPER_ADMIN is rejected from tenant plot endpoints (403 FORBIDDEN)', async () => {
      const { user: superAdmin } = await createTestSuperAdmin();
      const token = generateAccessToken(superAdmin);

      const res = await request(app)
        .get('/api/plots')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('FORBIDDEN');
    });

    it('20. Suspended firm members cannot access plot endpoints (403 FIRM_SUSPENDED)', async () => {
      const { firm, admin } = await createTestFirmWithAdmin({ isActive: false });
      const token = generateAccessToken(admin);

      const res = await request(app)
        .get('/api/plots')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('FIRM_SUSPENDED');
    });

    it('21. FIRM_STAFF permissions guard: plots:read, plots:write, plots:delete', async () => {
      const { firm } = await createTestFirmWithAdmin();

      // Staff with read-only
      const { user: staffRead } = await createTestStaff({
        firmId: firm._id,
        permissions: [PERMS.PLOTS_READ],
      });
      const tokenRead = generateAccessToken(staffRead);

      // Staff can list
      const listRes = await request(app)
        .get('/api/plots')
        .set('Authorization', `Bearer ${tokenRead}`);
      expect(listRes.status).toBe(200);

      // Staff cannot write without plots:write
      const writeRes = await request(app)
        .post('/api/plots')
        .set('Authorization', `Bearer ${tokenRead}`)
        .send({
          plotRef: 'UNAUTH-STAFF-PLOT',
          size: 100,
          sizeUnit: 'sqft',
          rate: 100000,
        });
      expect(writeRes.status).toBe(403);

      // Staff with write but without delete
      const { user: staffWrite } = await createTestStaff({
        firmId: firm._id,
        permissions: [PERMS.PLOTS_READ, PERMS.PLOTS_WRITE],
      });
      const tokenWrite = generateAccessToken(staffWrite);

      const createRes = await request(app)
        .post('/api/plots')
        .set('Authorization', `Bearer ${tokenWrite}`)
        .send({
          plotRef: 'STAFF-CREATED-PLOT',
          size: 100,
          sizeUnit: 'sqft',
          rate: 100000,
        });
      expect(createRes.status).toBe(201);

      // Staff cannot delete without plots:delete
      const delRes = await request(app)
        .delete(`/api/plots/${createRes.body.data.id}`)
        .set('Authorization', `Bearer ${tokenWrite}`);
      expect(delRes.status).toBe(403);
    });

    it('21. Generates formatted WhatsApp share details and preserves tenant isolation', async () => {
      const { firm: firmA, admin: adminA } = await createTestFirmWithAdmin({
        name: 'Prime Realty Firm',
        slug: 'prime-realty',
      });
      const { firm: firmB, admin: adminB } = await createTestFirmWithAdmin({
        name: 'Rival Firm',
        slug: 'rival-firm',
      });

      const colony = await Colony.create({
        firmId: firmA._id,
        name: 'Silicon Valley Greens',
        location: 'Bypass Road',
        city: 'Indore',
      });

      const plotA = await Plot.create({
        firmId: firmA._id,
        plotRef: 'PV-101',
        colonyId: colony._id,
        size: 1500,
        sizeUnit: 'sqft',
        rate: 3500,
        rateType: 'per_unit',
        currency: 'INR',
        status: 'available',
        description: 'East facing prime corner plot',
        video: { url: 'https://youtube.com/watch?v=sample123', provider: 'youtube' },
      });

      const tokenA = generateAccessToken(adminA);
      const tokenB = generateAccessToken(adminB);

      // Successfully get WhatsApp share info for own plot
      const res = await request(app)
        .get(`/api/plots/${plotA._id}/share-whatsapp`)
        .set('Authorization', `Bearer ${tokenA}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.plotId).toBe(plotA._id.toString());
      expect(res.body.data.plotRef).toBe('PV-101');
      expect(res.body.data.messageText).toContain('PV-101');
      expect(res.body.data.messageText).toContain('Silicon Valley Greens');
      expect(res.body.data.messageText).toContain('1500 SQFT');
      expect(res.body.data.messageText).toContain('Prime Realty Firm');
      expect(res.body.data.whatsappWebUrl).toContain('web.whatsapp.com/send?text=');
      expect(res.body.data.whatsappApiUrl).toContain('api.whatsapp.com/send?text=');

      // Cross-firm access rejected with 404
      const crossRes = await request(app)
        .get(`/api/plots/${plotA._id}/share-whatsapp`)
        .set('Authorization', `Bearer ${tokenB}`);
      expect(crossRes.status).toBe(404);

      // Unauthenticated request rejected with 401
      const unauthRes = await request(app)
        .get(`/api/plots/${plotA._id}/share-whatsapp`);
      expect(unauthRes.status).toBe(401);
    });
  });
});
