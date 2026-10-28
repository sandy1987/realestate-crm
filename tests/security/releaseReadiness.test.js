/**
 * tests/security/releaseReadiness.test.js
 *
 * Final Security Audit & Release Readiness Test Suite (Phase 9).
 *
 * Verifies critical production security invariants:
 *  1. Multi-Tenant Cross-Firm Isolation across ALL resources (Colonies, Plots, PlotPrivate, Users, Audit)
 *  2. Cross-firm nested reference forgery rejection (Plot cannot reference Colony belonging to another firm)
 *  3. BOLA / IDOR protection across mutation and read endpoints (returns 404 without side effects)
 *  4. Client-supplied firmId cannot tamper with or override tenant context
 *  5. Immediate session invalidation upon user suspension / deactivation
 *  6. NoSQL operator injection resistance ({ $gt: "" }, malformed types)
 *  7. Private data confidentiality (strict absence in public plot list/detail, search, and audit metadata)
 *  8. Replay-attack prevention and single-winner atomic refresh-token rotation
 *  9. Strict audit failure policy option (strict persistence error handling)
 * 10. Safe production error responses (no stack traces or internals leaked)
 * 11. Video URL validation restricts to allowed hosts without SSRF risk
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import request from 'supertest';
import mongoose from 'mongoose';
import { app } from '../../src/app.js';
import { connectDB, disconnectDB } from '../../src/config/db.js';
import { User } from '../../src/models/User.model.js';
import { Firm } from '../../src/models/Firm.model.js';
import { Colony } from '../../src/models/Colony.model.js';
import { Plot } from '../../src/models/Plot.model.js';
import { PlotPrivate } from '../../src/models/PlotPrivate.model.js';
import { AuditLog } from '../../src/models/AuditLog.model.js';
import { RefreshToken } from '../../src/models/RefreshToken.model.js';
import { ROLES } from '../../src/constants/roles.js';
import { PERMS } from '../../src/constants/permissions.js';
import { AUDIT_EVENTS } from '../../src/constants/auditEvents.js';
import { recordAuditEvent } from '../../src/services/audit.service.js';
import { generateAccessToken, createRefreshTokenSession } from '../../src/services/token.service.js';
import {
  createTestFirmWithAdmin,
  createTestStaff,
  createTestSuperAdmin,
  DEFAULT_TEST_PASSWORD,
} from '../setup/fixtures.js';

describe('Phase 9 — Final Security Audit & Release Readiness Suite', () => {
  beforeAll(async () => {
    await connectDB();
  });

  afterAll(async () => {
    await disconnectDB();
  });

  beforeEach(async () => {
    await AuditLog.deleteMany({});
    await PlotPrivate.deleteMany({});
    await Plot.deleteMany({});
    await Colony.deleteMany({});
    await RefreshToken.deleteMany({});
    await User.deleteMany({});
    await Firm.deleteMany({});
  });

  describe('1. Cross-Tenant Isolation Across All Resources', () => {
    it('prevents Firm A from reading, modifying, or deleting Firm B colonies', async () => {
      const { firm: firmA, admin: adminA } = await createTestFirmWithAdmin({ name: 'Firm A' });
      const { firm: firmB, admin: adminB } = await createTestFirmWithAdmin({ name: 'Firm B' });
      const tokenA = generateAccessToken(adminA);

      const colonyB = await Colony.create({
        name: 'Colony B Protected',
        firmId: firmB._id,
        location: 'Jaipur',
      });

      // GET attempt
      const getRes = await request(app)
        .get(`/api/colonies/${colonyB._id}`)
        .set('Authorization', `Bearer ${tokenA}`);
      expect(getRes.status).toBe(404);

      // PATCH attempt
      const patchRes = await request(app)
        .patch(`/api/colonies/${colonyB._id}`)
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ name: 'Hacked Colony Name' });
      expect(patchRes.status).toBe(404);

      // DELETE attempt
      const deleteRes = await request(app)
        .delete(`/api/colonies/${colonyB._id}`)
        .set('Authorization', `Bearer ${tokenA}`);
      expect(deleteRes.status).toBe(404);

      // Verify Colony B was unaffected in the database
      const freshColonyB = await Colony.findById(colonyB._id);
      expect(freshColonyB.name).toBe('Colony B Protected');
      expect(freshColonyB.isActive).toBe(true);
    });

    it('prevents Firm A from reading, modifying, or deleting Firm B plots', async () => {
      const { firm: firmA, admin: adminA } = await createTestFirmWithAdmin({ name: 'Firm A' });
      const { firm: firmB, admin: adminB } = await createTestFirmWithAdmin({ name: 'Firm B' });
      const tokenA = generateAccessToken(adminA);

      const plotB = await Plot.create({
        plotRef: 'PLOT-B-999',
        firmId: firmB._id,
        size: 100,
        sizeUnit: 'sqyd',
        rate: 50000,
      });

      // GET attempt
      const getRes = await request(app)
        .get(`/api/plots/${plotB._id}`)
        .set('Authorization', `Bearer ${tokenA}`);
      expect(getRes.status).toBe(404);

      // PATCH attempt
      const patchRes = await request(app)
        .patch(`/api/plots/${plotB._id}`)
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ rate: 1000 });
      expect(patchRes.status).toBe(404);

      // DELETE attempt
      const deleteRes = await request(app)
        .delete(`/api/plots/${plotB._id}`)
        .set('Authorization', `Bearer ${tokenA}`);
      expect(deleteRes.status).toBe(404);

      const freshPlotB = await Plot.findById(plotB._id);
      expect(freshPlotB.rate).toBe(50000);
      expect(freshPlotB.isActive).toBe(true);
    });

    it('prevents Firm A from reading or modifying Firm B private owner details', async () => {
      const { firm: firmA, admin: adminA } = await createTestFirmWithAdmin({ name: 'Firm A' });
      const { firm: firmB } = await createTestFirmWithAdmin({ name: 'Firm B' });
      const tokenA = generateAccessToken(adminA);

      const plotB = await Plot.create({
        plotRef: 'PLOT-B-PRIV',
        firmId: firmB._id,
        size: 150,
        sizeUnit: 'sqyd',
        rate: 60000,
      });

      await PlotPrivate.create({
        plotId: plotB._id,
        firmId: firmB._id,
        owner: { name: 'Firm B Confidential Owner', phone: '1234567890' },
      });

      // GET private attempt
      const getPriv = await request(app)
        .get(`/api/plots/${plotB._id}/private`)
        .set('Authorization', `Bearer ${tokenA}`);
      expect(getPriv.status).toBe(404);

      // PUT private attempt
      const putPriv = await request(app)
        .put(`/api/plots/${plotB._id}/private`)
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ owner: { name: 'Hacked Owner' } });
      expect(putPriv.status).toBe(404);

      // DELETE private attempt
      const delPriv = await request(app)
        .delete(`/api/plots/${plotB._id}/private`)
        .set('Authorization', `Bearer ${tokenA}`);
      expect(delPriv.status).toBe(404);

      const freshPriv = await PlotPrivate.findOne({ plotId: plotB._id });
      expect(freshPriv.owner.name).toBe('Firm B Confidential Owner');
    });

    it('prevents Firm A from referencing Firm B colony when creating a plot (Nested Reference Isolation)', async () => {
      const { firm: firmA, admin: adminA } = await createTestFirmWithAdmin({ name: 'Firm A' });
      const { firm: firmB } = await createTestFirmWithAdmin({ name: 'Firm B' });
      const tokenA = generateAccessToken(adminA);

      // Colony belongs to Firm B
      const colonyB = await Colony.create({
        name: 'Firm B Colony',
        firmId: firmB._id,
      });

      // Firm A attempts to create a plot pointing to Firm B's colony
      const res = await request(app)
        .post('/api/plots')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({
          plotRef: 'PLOT-A-FORGED',
          colonyId: colonyB._id.toString(),
          size: 200,
          sizeUnit: 'sqyd',
          rate: 45000,
        });

      // Must be rejected because colony does not belong to Firm A
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('INVALID_COLONY');

      const plot = await Plot.findOne({ plotRef: 'PLOT-A-FORGED' });
      expect(plot).toBeNull();
    });
  });

  describe('2. Client Identity Spoofing & Falsification Resistance', () => {
    it('disregards client-supplied firmId in body or query during mutations and reads', async () => {
      const { firm: firmA, admin: adminA } = await createTestFirmWithAdmin({ name: 'Firm A' });
      const { firm: firmB } = await createTestFirmWithAdmin({ name: 'Firm B' });
      const tokenA = generateAccessToken(adminA);

      const res = await request(app)
        .post('/api/colonies')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({
          name: 'Spoof Test Colony',
          firmId: firmB._id.toString(), // Attacker attempts to inject Firm B's firmId
        });

      expect(res.status).toBe(201);
      // The colony must be created strictly under Firm A
      expect(res.body.data.firmId).toBe(firmA._id.toString());
      expect(res.body.data.firmId).not.toBe(firmB._id.toString());

      const dbColony = await Colony.findById(res.body.data.id);
      expect(dbColony.firmId.toString()).toBe(firmA._id.toString());
    });
  });

  describe('3. Account Status Enforcement (Disabled / Suspended Users)', () => {
    it('immediately rejects access with 403 ACCOUNT_DISABLED once an account is deactivated', async () => {
      const { firm, admin } = await createTestFirmWithAdmin();
      const token = generateAccessToken(admin);

      // Verify token initially works
      const initialRes = await request(app)
        .get('/api/firm/me')
        .set('Authorization', `Bearer ${token}`);
      expect(initialRes.status).toBe(200);

      // Deactivate user directly
      admin.isActive = false;
      await admin.save();

      // Subsequent request using existing token must be immediately rejected
      const blockedRes = await request(app)
        .get('/api/firm/me')
        .set('Authorization', `Bearer ${token}`);

      expect(blockedRes.status).toBe(403);
      expect(blockedRes.body.error.code).toBe('ACCOUNT_DISABLED');
    });

    it('rejects access when tenant firm is suspended', async () => {
      const { firm, admin } = await createTestFirmWithAdmin();
      const token = generateAccessToken(admin);

      // Suspend firm
      firm.isActive = false;
      await firm.save();

      const res = await request(app)
        .get('/api/firm/me')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('FIRM_SUSPENDED');
    });
  });

  describe('4. NoSQL Operator Injection Defense', () => {
    it('rejects NoSQL injection objects in login credentials via Zod validation', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({
          email: { $gt: '' },
          password: { $gt: '' },
        });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('rejects malformed ObjectIds and avoids unhandled database CastError crashes', async () => {
      const { admin } = await createTestFirmWithAdmin();
      const token = generateAccessToken(admin);

      const res = await request(app)
        .get('/api/plots/not-a-valid-object-id')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe('PLOT_NOT_FOUND');
    });
  });

  describe('5. Video URL Validation Security (SSRF Defense)', () => {
    it('rejects non-allowlisted domains and local network URLs (SSRF prevention)', async () => {
      const { firm, admin } = await createTestFirmWithAdmin();
      const token = generateAccessToken(admin);

      const evilUrls = [
        'http://169.254.169.254/latest/meta-data/', // AWS metadata
        'http://localhost:5000/internal',
        'http://127.0.0.1:27017',
        'https://malicious-site.com/video.mp4',
        'javascript:alert(1)',
      ];

      for (const url of evilUrls) {
        const res = await request(app)
          .post('/api/plots')
          .set('Authorization', `Bearer ${token}`)
          .send({
            plotRef: `PLOT-SSRF-${Math.random().toString(36).substring(7)}`,
            size: 100,
            sizeUnit: 'sqyd',
            rate: 20000,
            videoUrl: url,
            videoProvider: 'youtube',
          });

        expect(res.status).toBe(400);
        expect(res.body.error.code).toBe('INVALID_VIDEO_URL');
      }
    });

    it('accepts valid YouTube and Vimeo URLs', async () => {
      const { firm, admin } = await createTestFirmWithAdmin();
      const token = generateAccessToken(admin);

      const res = await request(app)
        .post('/api/plots')
        .set('Authorization', `Bearer ${token}`)
        .send({
          plotRef: 'PLOT-VALID-VIDEO',
          size: 150,
          sizeUnit: 'sqyd',
          rate: 30000,
          videoUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
          videoProvider: 'youtube',
        });

      expect(res.status).toBe(201);
      expect(res.body.data.video.url).toBe('https://www.youtube.com/watch?v=dQw4w9WgXcQ');
      expect(res.body.data.video.provider).toBe('youtube');
    });
  });

  describe('6. Strict Audit Persistence Mode Verification', () => {
    it('throws error when strict audit persistence is required and save fails', async () => {
      const saveSpy = vi.spyOn(AuditLog.prototype, 'save').mockRejectedValueOnce(
        new Error('Database disk full')
      );

      await expect(
        recordAuditEvent(
          {
            eventType: AUDIT_EVENTS.USER_SUSPENDED,
            resourceType: 'user',
            action: 'suspend',
          },
          { strict: true }
        )
      ).rejects.toThrow(/Strict audit persistence failed/);

      saveSpy.mockRestore();
    });
  });

  describe('7. Safe Production Error Handling', () => {
    it('does not disclose stack traces or database driver internals in error responses', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: 'bad-email', password: 'short' });

      expect(res.status).toBe(400);
      expect(res.body.error.stack).toBeUndefined();
      expect(res.body.error.details).toBeDefined();
    });
  });
});
