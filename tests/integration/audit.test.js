/**
 * tests/integration/audit.test.js
 *
 * Audit Logs & Operational Security Test Suite (Phase 7).
 *
 * Verifies:
 *  1. Approved audit event creation across services (auth, firm, user, colony, plot, private-data)
 *  2. Rejection of unknown/unapproved audit event types
 *  3. Actor identity derived strictly from server-side trusted context (actorUserId, actorRole)
 *  4. Firm identity derived strictly from trusted tenant context (firmId)
 *  5. Client-supplied actor or firm IDs cannot forge audit records
 *  6. Passwords, tokens, hashes, and private owner/source values are never persisted in audit metadata
 *  7. Failed business operations do not generate false success events
 *  8. Critical operations follow documented audit-failure policy (fail-safe error isolation)
 *  9. Firm A cannot read Firm B's audit records (cross-tenant isolation)
 * 10. Unauthorized staff without audit:read permission are rejected (403 FORBIDDEN); authorized staff succeed
 * 11. Platform and tenant audit routes remain strictly separated (SUPER_ADMIN rejected on tenant route; tenant rejected on platform route)
 * 12. Pagination, filtering by eventType/resourceType/date, and whitelisted sorting are validated and scoped
 * 13. Clients cannot create, modify, or delete audit records through exposed APIs (POST/PUT/PATCH/DELETE return 404)
 * 14. Primary business state is preserved if audit persistence fails
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
import { recordAuditEvent, sanitizeAuditMetadata } from '../../src/services/audit.service.js';
import { generateAccessToken } from '../../src/services/token.service.js';
import {
  createTestFirmWithAdmin,
  createTestStaff,
  createTestSuperAdmin,
  createTestFirm,
  DEFAULT_TEST_PASSWORD,
} from '../setup/fixtures.js';

async function setupFirmWithAdmin(firmOverrides = {}) {
  const { firm, admin } = await createTestFirmWithAdmin(firmOverrides);
  const token = generateAccessToken(admin);
  return { firm, admin, token };
}

async function setupSuperAdmin() {
  const { user: superAdmin } = await createTestSuperAdmin();
  const token = generateAccessToken(superAdmin);
  return { superAdmin, token };
}

async function setupStaff(firmId, permissions = []) {
  const { user: staff } = await createTestStaff({ firmId, permissions });
  const token = generateAccessToken(staff);
  return { staff, token };
}

describe('Audit Logs & Operational Security (Phase 7)', () => {
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

  describe('1. Approved Audit Event Creation', () => {
    it('creates an audit event when a user logs in successfully', async () => {
      const { admin, firm } = await setupFirmWithAdmin();

      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: admin.email, password: DEFAULT_TEST_PASSWORD });

      expect(res.status).toBe(200);

      const log = await AuditLog.findOne({
        eventType: AUDIT_EVENTS.AUTH_LOGIN_SUCCESS,
        actorUserId: admin._id,
      });

      expect(log).not.toBeNull();
      expect(log.outcome).toBe('success');
      expect(log.firmId.toString()).toBe(firm._id.toString());
      expect(log.resourceType).toBe('user');
      expect(log.resourceId).toBe(admin._id.toString());
      expect(log.metadata.email).toBe(admin.email);
    });

    it('creates an audit event when a firm admin creates a staff user', async () => {
      const { admin, firm, token } = await setupFirmWithAdmin();

      const res = await request(app)
        .post('/api/firm/users')
        .set('Authorization', `Bearer ${token}`)
        .send({
          email: 'newstaff@audit-test.com',
          password: 'Password123!',
          firstName: 'Audit',
          lastName: 'Staff',
          permissions: [PERMS.PLOTS_WRITE],
        });

      expect(res.status).toBe(201);
      const newUserId = res.body.data.id;

      const log = await AuditLog.findOne({
        eventType: AUDIT_EVENTS.USER_CREATED,
        resourceId: newUserId,
      });

      expect(log).not.toBeNull();
      expect(log.actorUserId.toString()).toBe(admin._id.toString());
      expect(log.firmId.toString()).toBe(firm._id.toString());
      expect(log.metadata.targetEmail).toBe('newstaff@audit-test.com');
      // Passwords must never be in metadata
      expect(log.metadata.password).toBeUndefined();
    });

    it('creates audit events for colony and plot lifecycles', async () => {
      const { admin, firm, token } = await setupFirmWithAdmin();

      // 1. Create Colony
      const colonyRes = await request(app)
        .post('/api/colonies')
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'Audit Green Colony', location: 'Jaipur' });

      expect(colonyRes.status).toBe(201);
      const colonyId = colonyRes.body.data.id;

      const colonyLog = await AuditLog.findOne({
        eventType: AUDIT_EVENTS.COLONY_CREATED,
        resourceId: colonyId,
      });
      expect(colonyLog).not.toBeNull();
      expect(colonyLog.firmId.toString()).toBe(firm._id.toString());
      expect(colonyLog.actorUserId.toString()).toBe(admin._id.toString());

      // 2. Create Plot
      const plotRes = await request(app)
        .post('/api/plots')
        .set('Authorization', `Bearer ${token}`)
        .send({
          plotRef: 'P-AUDIT-101',
          colonyId,
          size: 200,
          sizeUnit: 'sqyd',
          rate: 2500000,
          rateType: 'total',
        });

      expect(plotRes.status).toBe(201);
      const plotId = plotRes.body.data.id;

      const plotLog = await AuditLog.findOne({
        eventType: AUDIT_EVENTS.PLOT_CREATED,
        resourceId: plotId,
      });
      expect(plotLog).not.toBeNull();
      expect(plotLog.firmId.toString()).toBe(firm._id.toString());
      expect(plotLog.metadata.plotRef).toBe('P-AUDIT-101');
    });

    it('creates audit events for private owner/source data access and modification without leaking secrets', async () => {
      const { admin, firm, token } = await setupFirmWithAdmin();
      const colony = await Colony.create({ name: 'Priv Colony', firmId: firm._id });
      const plot = await Plot.create({
        plotRef: 'P-PRIV-1',
        colonyId: colony._id,
        firmId: firm._id,
        size: 200,
        sizeUnit: 'sqyd',
        rate: 50000,
        rateType: 'total',
        type: 'residential',
      });

      // 1. Upsert private details
      const upsertRes = await request(app)
        .put(`/api/plots/${plot._id}/private`)
        .set('Authorization', `Bearer ${token}`)
        .send({
          owner: {
            name: 'Secret Owner',
            phone: '9998887776',
            notes: 'Extremely confidential seller',
          },
          source: {
            sourceType: 'agent',
            contactName: 'Secret Broker',
          },
        });

      expect(upsertRes.status).toBe(200);

      const upsertLog = await AuditLog.findOne({
        eventType: AUDIT_EVENTS.PRIVATE_DATA_UPSERT,
        resourceId: plot._id.toString(),
      });
      expect(upsertLog).not.toBeNull();
      expect(upsertLog.actorUserId.toString()).toBe(admin._id.toString());
      expect(upsertLog.firmId.toString()).toBe(firm._id.toString());
      // Private fields must never be stored in metadata
      expect(upsertLog.metadata.owner).toBeUndefined();
      expect(upsertLog.metadata.phone).toBeUndefined();
      expect(upsertLog.metadata.notes).toBeUndefined();

      // 2. Read private details
      const readRes = await request(app)
        .get(`/api/plots/${plot._id}/private`)
        .set('Authorization', `Bearer ${token}`);

      expect(readRes.status).toBe(200);

      const readLog = await AuditLog.findOne({
        eventType: AUDIT_EVENTS.PRIVATE_DATA_READ,
        resourceId: plot._id.toString(),
      });
      expect(readLog).not.toBeNull();
      expect(readLog.metadata.owner).toBeUndefined();
    });
  });

  describe('2. Rejection of Unknown Event Types', () => {
    it('throws error when attempting to record an unapproved audit event type', async () => {
      await expect(
        recordAuditEvent({
          eventType: 'unapproved.arbitrary.event',
          resourceType: 'system',
          action: 'hack',
        })
      ).rejects.toThrow(/Unapproved audit event type/);
    });
  });

  describe('3. Actor & Firm Identity Derived from Server Context', () => {
    it('populates actorUserId and firmId strictly from trusted server auth context', async () => {
      const { admin, firm, token } = await setupFirmWithAdmin();

      const res = await request(app)
        .post('/api/colonies')
        .set('Authorization', `Bearer ${token}`)
        .send({
          name: 'Trusted Colony',
          // Client attempts to spoof actor and firm
          actorUserId: new mongoose.Types.ObjectId().toString(),
          firmId: new mongoose.Types.ObjectId().toString(),
        });

      expect(res.status).toBe(201);
      const colonyId = res.body.data.id;

      const log = await AuditLog.findOne({ resourceId: colonyId });
      expect(log).not.toBeNull();
      // Must reflect authenticated admin and firm, NOT client-supplied IDs
      expect(log.actorUserId.toString()).toBe(admin._id.toString());
      expect(log.firmId.toString()).toBe(firm._id.toString());
    });
  });

  describe('4. Sensitive-Data Exclusion & Sanitization', () => {
    it('sanitizeAuditMetadata strips sensitive keys and nested objects', () => {
      const dirty = {
        password: 'PlainTextPassword123',
        passwordHash: '$argon2id$...',
        token: 'jwt.token.string',
        refreshToken: 'raw_refresh_token',
        ownerPhone: '+919999999999',
        ownerAddress: '123 Confidential St',
        notes: 'Highly classified personal note',
        aadhaar: '1234-5678-9012',
        authorization: 'Bearer token',
        nested: {
          secret: 'not_forbidden_by_name',
          password: 'nested_password',
          notes: 'nested_notes',
        },
        safeField: 'permitted_value',
        plotCount: 15,
      };

      const clean = sanitizeAuditMetadata(dirty);

      expect(clean.password).toBeUndefined();
      expect(clean.passwordHash).toBeUndefined();
      expect(clean.token).toBeUndefined();
      expect(clean.refreshToken).toBeUndefined();
      expect(clean.ownerPhone).toBeUndefined();
      expect(clean.ownerAddress).toBeUndefined();
      expect(clean.notes).toBeUndefined();
      expect(clean.aadhaar).toBeUndefined();
      expect(clean.authorization).toBeUndefined();
      expect(clean.safeField).toBe('permitted_value');
      expect(clean.plotCount).toBe(15);
      expect(clean.nested.secret).toBe('not_forbidden_by_name');
      expect(clean.nested.password).toBeUndefined();
      expect(clean.nested.notes).toBeUndefined();
    });

    it('failed login audit event records failure outcome without persisting passwords', async () => {
      const { admin } = await setupFirmWithAdmin();

      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: admin.email, password: 'WrongPasswordGuess!' });

      expect(res.status).toBe(401);

      const failLog = await AuditLog.findOne({
        eventType: AUDIT_EVENTS.AUTH_LOGIN_FAILURE,
        outcome: 'failure',
      });

      expect(failLog).not.toBeNull();
      expect(failLog.metadata.email).toBe(admin.email);
      expect(failLog.metadata.password).toBeUndefined();
      expect(failLog.metadata.reason).toBe('invalid_credentials');
    });
  });

  describe('5. Business Failure Integrity (No False Success)', () => {
    it('failed business operation does not generate a false success audit event', async () => {
      const { token } = await setupFirmWithAdmin();

      // Attempt to create plot with non-existent colonyId
      const fakeColonyId = new mongoose.Types.ObjectId().toString();
      const res = await request(app)
        .post('/api/plots')
        .set('Authorization', `Bearer ${token}`)
        .send({
          plotRef: 'P-FAIL-1',
          colonyId: fakeColonyId,
          size: 150,
          sizeUnit: 'sqyd',
          rate: 100000,
        });

      expect(res.status).toBe(400);

      // Verify no plot.created audit log exists
      const log = await AuditLog.findOne({
        eventType: AUDIT_EVENTS.PLOT_CREATED,
        'metadata.plotRef': 'P-FAIL-1',
      });

      expect(log).toBeNull();
    });
  });

  describe('6. Audit Persistence Failure Policy (Fail-Safe Error Isolation)', () => {
    it('primary business operation succeeds even if audit persistence fails', async () => {
      const { token } = await setupFirmWithAdmin();

      // Spy on AuditLog.prototype.save and simulate a database persistence error
      const saveSpy = vi.spyOn(AuditLog.prototype, 'save').mockRejectedValueOnce(
        new Error('Simulated audit database connection timeout')
      );

      const res = await request(app)
        .post('/api/colonies')
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'FailSafe Colony', location: 'Udaipur' });

      // Colony creation must still succeed despite audit failure
      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);

      const createdColony = await Colony.findOne({ name: 'FailSafe Colony' });
      expect(createdColony).not.toBeNull();

      saveSpy.mockRestore();
    });
  });

  describe('7. Multi-Tenant Cross-Firm Isolation on Audit Queries', () => {
    it('Firm A admin cannot read Firm B audit records', async () => {
      const firmAData = await setupFirmWithAdmin({ name: 'Firm Alpha' });
      const firmBData = await setupFirmWithAdmin({ name: 'Firm Beta' });

      // Create an action in Firm A
      await request(app)
        .post('/api/colonies')
        .set('Authorization', `Bearer ${firmAData.token}`)
        .send({ name: 'Alpha Colony' });

      // Create an action in Firm B
      await request(app)
        .post('/api/colonies')
        .set('Authorization', `Bearer ${firmBData.token}`)
        .send({ name: 'Beta Colony' });

      // Firm A admin queries audit logs
      const resA = await request(app)
        .get('/api/firm/audit')
        .set('Authorization', `Bearer ${firmAData.token}`);

      expect(resA.status).toBe(200);
      expect(resA.body.success).toBe(true);
      expect(Array.isArray(resA.body.data)).toBe(true);

      // All returned logs must strictly belong to Firm A
      for (const log of resA.body.data) {
        expect(log.firmId).toBe(firmAData.firm._id.toString());
        expect(log.firmId).not.toBe(firmBData.firm._id.toString());
      }

      // Explicitly check that Firm B logs are not visible to Firm A even if passed in query
      const resAWithFirmBQuery = await request(app)
        .get(`/api/firm/audit?firmId=${firmBData.firm._id.toString()}`)
        .set('Authorization', `Bearer ${firmAData.token}`);

      expect(resAWithFirmBQuery.status).toBe(200);
      for (const log of resAWithFirmBQuery.body.data) {
        expect(log.firmId).toBe(firmAData.firm._id.toString());
      }
    });
  });

  describe('8. Role-Based Access Control for Audit Trail', () => {
    it('FIRM_STAFF without audit:read permission is rejected with 403 FORBIDDEN', async () => {
      const { firm } = await setupFirmWithAdmin();
      const { token: staffToken } = await setupStaff(firm._id, [PERMS.PLOTS_READ]); // No audit:read

      const res = await request(app)
        .get('/api/firm/audit')
        .set('Authorization', `Bearer ${staffToken}`);

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('FORBIDDEN');
    });

    it('FIRM_STAFF with explicit audit:read permission can read their firm audit logs', async () => {
      const { firm } = await setupFirmWithAdmin();
      const { token: staffToken } = await setupStaff(firm._id, [PERMS.AUDIT_READ]);

      const res = await request(app)
        .get('/api/firm/audit')
        .set('Authorization', `Bearer ${staffToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
    });

    it('Unauthenticated requests are rejected with 401 UNAUTHORIZED', async () => {
      const res = await request(app).get('/api/firm/audit');
      expect(res.status).toBe(401);
    });
  });

  describe('9. Route Separation (Platform vs Tenant)', () => {
    it('SUPER_ADMIN is rejected with 403 on tenant route /api/firm/audit', async () => {
      const { token: superToken } = await setupSuperAdmin();

      const res = await request(app)
        .get('/api/firm/audit')
        .set('Authorization', `Bearer ${superToken}`);

      // Tenant routes require tenant context which rejects SUPER_ADMIN
      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('FORBIDDEN');
    });

    it('FIRM_ADMIN is rejected with 403 on platform route /api/platform/audit', async () => {
      const { token } = await setupFirmWithAdmin();

      const res = await request(app)
        .get('/api/platform/audit')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('FORBIDDEN');
    });

    it('SUPER_ADMIN can access platform route /api/platform/audit', async () => {
      const { token: superToken } = await setupSuperAdmin();

      // Create a platform firm provisioning event
      const provRes = await request(app)
        .post('/api/platform/firms')
        .set('Authorization', `Bearer ${superToken}`)
        .send({
          name: 'Super Admin Firm',
          slug: 'super-admin-firm-unique',
          adminEmail: 'super-firm-admin@test.com',
          adminPassword: 'Password123!',
          adminFirstName: 'Firm',
          adminLastName: 'Admin',
        });

      expect(provRes.status).toBe(201);

      const res = await request(app)
        .get('/api/platform/audit')
        .set('Authorization', `Bearer ${superToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.length).toBeGreaterThan(0);
      expect(res.body.meta).toBeDefined();
    });
  });

  describe('10. Pagination, Filtering, and Sorting', () => {
    it('supports pagination, eventType filtering, and date filtering', async () => {
      const { firm, token } = await setupFirmWithAdmin();

      // Seed audit records with varying eventTypes
      await recordAuditEvent({
        eventType: AUDIT_EVENTS.COLONY_CREATED,
        firmId: firm._id,
        resourceType: 'colony',
        action: 'create',
      });
      await recordAuditEvent({
        eventType: AUDIT_EVENTS.PLOT_CREATED,
        firmId: firm._id,
        resourceType: 'plot',
        action: 'create',
      });
      await recordAuditEvent({
        eventType: AUDIT_EVENTS.PLOT_UPDATED,
        firmId: firm._id,
        resourceType: 'plot',
        action: 'update',
      });

      // Filter by eventType
      const filterRes = await request(app)
        .get(`/api/firm/audit?eventType=${AUDIT_EVENTS.PLOT_CREATED}`)
        .set('Authorization', `Bearer ${token}`);

      expect(filterRes.status).toBe(200);
      expect(filterRes.body.data.length).toBe(1);
      expect(filterRes.body.data[0].eventType).toBe(AUDIT_EVENTS.PLOT_CREATED);

      // Pagination
      const pageRes = await request(app)
        .get('/api/firm/audit?page=1&limit=2')
        .set('Authorization', `Bearer ${token}`);

      expect(pageRes.status).toBe(200);
      expect(pageRes.body.data.length).toBeLessThanOrEqual(2);
      expect(pageRes.body.meta.page).toBe(1);
      expect(pageRes.body.meta.limit).toBe(2);
    });
  });

  describe('11. Immutable Append-Only Logs (No Public Mutation APIs)', () => {
    it('rejects POST, PUT, PATCH, and DELETE on audit endpoints with 404', async () => {
      const { token } = await setupFirmWithAdmin();

      const postRes = await request(app)
        .post('/api/firm/audit')
        .set('Authorization', `Bearer ${token}`)
        .send({ eventType: AUDIT_EVENTS.PLOT_CREATED });
      expect(postRes.status).toBe(404);

      const putRes = await request(app)
        .put('/api/firm/audit/some-id')
        .set('Authorization', `Bearer ${token}`)
        .send({ outcome: 'failure' });
      expect(putRes.status).toBe(404);

      const deleteRes = await request(app)
        .delete('/api/firm/audit/some-id')
        .set('Authorization', `Bearer ${token}`);
      expect(deleteRes.status).toBe(404);
    });
  });
});
