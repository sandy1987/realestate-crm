/**
 * tests/security/tenantIsolation.test.js
 *
 * Mandatory Tenant Isolation Security Test Suite (Phase 3).
 *
 * Verifies:
 *  - Tenant identity derives firmId strictly from trusted database state
 *  - Firm A admin receives Firm A data; Firm B admin receives Firm B data
 *  - Injection of foreign firmId in body/query is completely ignored
 *  - Cross-tenant read, update, and delete attempts fail with 404 NOT_FOUND
 *  - Create operations derive firmId from trusted tenant context
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import express, { Router } from 'express';
import mongoose from 'mongoose';
import { app } from '../../src/app.js';
import { connectDB, disconnectDB } from '../../src/config/db.js';
import { User } from '../../src/models/User.model.js';
import { Firm } from '../../src/models/Firm.model.js';
import { requireAuth } from '../../src/middleware/auth.middleware.js';
import { requireTenantContext } from '../../src/middleware/tenant.middleware.js';
import { sendSuccess, sendError } from '../../src/utils/apiResponse.js';
import {
  createTestFirmWithAdmin,
  DEFAULT_TEST_PASSWORD,
} from '../setup/fixtures.js';

// Test-only tenant-owned Mongoose model for cross-tenant isolation testing
const testResourceSchema = new mongoose.Schema({
  title: { type: String, required: true },
  firmId: { type: mongoose.Schema.Types.ObjectId, ref: 'Firm', required: true, index: true },
});
const TestResource = mongoose.models.TestResource || mongoose.model('TestResource', testResourceSchema);

describe('Tenant Isolation Security Suite (Phase 3)', () => {
  let isolationApp;

  beforeAll(async () => {
    await connectDB();

    // Construct an isolated test app mounting the tenant test router
    isolationApp = express();
    isolationApp.use(express.json());

    const tenantTestRouter = Router();
    tenantTestRouter.use(requireAuth);
    tenantTestRouter.use(requireTenantContext);

    // Create: derives firmId strictly from req.tenant.firmId
    tenantTestRouter.post('/resources', async (req, res) => {
      const resource = await TestResource.create({
        title: req.body.title,
        firmId: req.tenant.firmId, // Enforce trusted tenant context only
      });
      return sendSuccess(res, resource, 201);
    });

    // Read: double-fenced query by _id AND req.tenant.firmId
    tenantTestRouter.get('/resources/:id', async (req, res) => {
      const resource = await TestResource.findOne({
        _id: req.params.id,
        firmId: req.tenant.firmId,
      });
      if (!resource) {
        return sendError(res, { statusCode: 404, code: 'NOT_FOUND', message: 'Resource not found' });
      }
      return sendSuccess(res, resource, 200);
    });

    // Update: double-fenced update
    tenantTestRouter.patch('/resources/:id', async (req, res) => {
      const resource = await TestResource.findOneAndUpdate(
        { _id: req.params.id, firmId: req.tenant.firmId },
        { $set: { title: req.body.title } },
        { new: true }
      );
      if (!resource) {
        return sendError(res, { statusCode: 404, code: 'NOT_FOUND', message: 'Resource not found' });
      }
      return sendSuccess(res, resource, 200);
    });

    // Delete: double-fenced delete
    tenantTestRouter.delete('/resources/:id', async (req, res) => {
      const resource = await TestResource.findOneAndDelete({
        _id: req.params.id,
        firmId: req.tenant.firmId,
      });
      if (!resource) {
        return sendError(res, { statusCode: 404, code: 'NOT_FOUND', message: 'Resource not found' });
      }
      return sendSuccess(res, { deleted: true }, 200);
    });

    isolationApp.use('/api/tenant-test', tenantTestRouter);
  });

  afterAll(async () => {
    await disconnectDB();
  });

  beforeEach(async () => {
    await User.deleteMany({});
    await Firm.deleteMany({});
    await TestResource.deleteMany({});
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

  describe('Firm Identity Scoping (GET /api/firm/me)', () => {
    it('Firm A admin logs in and receives Firm A data', async () => {
      const { firm: firmA, admin: adminA } = await createTestFirmWithAdmin({ name: 'Firm Alpha', slug: 'firm-alpha' });
      const tokenA = await getAccessToken(adminA);

      const res = await request(app)
        .get('/api/firm/me')
        .set('Authorization', `Bearer ${tokenA}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.id).toBe(firmA._id.toString());
      expect(res.body.data.name).toBe('Firm Alpha');
    });

    it('Firm B admin logs in and receives distinct Firm B data', async () => {
      const { firm: firmA, admin: adminA } = await createTestFirmWithAdmin({ name: 'Firm Alpha', slug: 'firm-alpha' });
      const { firm: firmB, admin: adminB } = await createTestFirmWithAdmin({ name: 'Firm Beta', slug: 'firm-beta' });

      const tokenA = await getAccessToken(adminA);
      const tokenB = await getAccessToken(adminB);

      const resA = await request(app).get('/api/firm/me').set('Authorization', `Bearer ${tokenA}`);
      const resB = await request(app).get('/api/firm/me').set('Authorization', `Bearer ${tokenB}`);

      expect(resA.body.data.id).toBe(firmA._id.toString());
      expect(resB.body.data.id).toBe(firmB._id.toString());
      expect(resA.body.data.id).not.toBe(resB.body.data.id);
    });

    it('firmId passed in body or query string cannot override authenticated tenant context', async () => {
      const { firm: firmA, admin: adminA } = await createTestFirmWithAdmin({ name: 'Firm Alpha', slug: 'firm-alpha' });
      const { firm: firmB } = await createTestFirmWithAdmin({ name: 'Firm Beta', slug: 'firm-beta' });
      const tokenA = await getAccessToken(adminA);

      // Attacker sends Firm B's firmId in query and body
      const res = await request(app)
        .get(`/api/firm/me?firmId=${firmB._id}`)
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ firmId: firmB._id.toString() });

      expect(res.status).toBe(200);
      // Context strictly reflects Firm A, not Firm B
      expect(res.body.data.id).toBe(firmA._id.toString());
      expect(res.body.data.name).toBe('Firm Alpha');
    });
  });

  describe('Cross-Tenant Data Isolation (CRUD Protection)', () => {
    it('create operation derives firmId strictly from authenticated tenant context', async () => {
      const { firm: firmA, admin: adminA } = await createTestFirmWithAdmin({ slug: 'firm-alpha' });
      const { firm: firmB } = await createTestFirmWithAdmin({ slug: 'firm-beta' });
      const tokenA = await getAccessToken(adminA);

      // Attacker from Firm A attempts to inject firmId of Firm B
      const res = await request(isolationApp)
        .post('/api/tenant-test/resources')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({
          title: 'Plot 101 Alpha',
          firmId: firmB._id.toString(), // Malicious body parameter
        });

      expect(res.status).toBe(201);
      const createdResource = res.body.data;

      // In database, firmId is Firm A, proving body firmId was ignored
      const inDb = await TestResource.findById(createdResource._id);
      expect(inDb.firmId.toString()).toBe(firmA._id.toString());
      expect(inDb.firmId.toString()).not.toBe(firmB._id.toString());
    });

    it('Firm A cannot read Firm B protected resource (returns 404 NOT_FOUND)', async () => {
      const { firm: firmA, admin: adminA } = await createTestFirmWithAdmin({ slug: 'firm-alpha' });
      const { firm: firmB } = await createTestFirmWithAdmin({ slug: 'firm-beta' });

      // Create resource owned by Firm B
      const resourceB = await TestResource.create({
        title: 'Confidential Listing Beta',
        firmId: firmB._id,
      });

      const tokenA = await getAccessToken(adminA);

      // Firm A attempts to read Firm B's resource by ID (IDOR attack)
      const res = await request(isolationApp)
        .get(`/api/tenant-test/resources/${resourceB._id}`)
        .set('Authorization', `Bearer ${tokenA}`);

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('NOT_FOUND');
    });

    it('Firm A cannot update Firm B protected resource (returns 404 NOT_FOUND)', async () => {
      const { firm: firmA, admin: adminA } = await createTestFirmWithAdmin({ slug: 'firm-alpha' });
      const { firm: firmB } = await createTestFirmWithAdmin({ slug: 'firm-beta' });

      const resourceB = await TestResource.create({
        title: 'Original Title Beta',
        firmId: firmB._id,
      });

      const tokenA = await getAccessToken(adminA);

      // Firm A attempts to modify Firm B's resource
      const res = await request(isolationApp)
        .patch(`/api/tenant-test/resources/${resourceB._id}`)
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ title: 'Tampered Title by Firm A' });

      expect(res.status).toBe(404);

      // Verify title remained unchanged in DB
      const untouched = await TestResource.findById(resourceB._id);
      expect(untouched.title).toBe('Original Title Beta');
    });

    it('Firm A cannot delete Firm B protected resource (returns 404 NOT_FOUND)', async () => {
      const { firm: firmA, admin: adminA } = await createTestFirmWithAdmin({ slug: 'firm-alpha' });
      const { firm: firmB } = await createTestFirmWithAdmin({ slug: 'firm-beta' });

      const resourceB = await TestResource.create({
        title: 'Indestructible Beta Resource',
        firmId: firmB._id,
      });

      const tokenA = await getAccessToken(adminA);

      // Firm A attempts to delete Firm B's resource
      const res = await request(isolationApp)
        .delete(`/api/tenant-test/resources/${resourceB._id}`)
        .set('Authorization', `Bearer ${tokenA}`);

      expect(res.status).toBe(404);

      // Verify document still exists in DB
      const existing = await TestResource.findById(resourceB._id);
      expect(existing).not.toBeNull();
    });
  });
});
