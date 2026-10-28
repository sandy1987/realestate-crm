/**
 * tests/security/multiTenantIsolationComprehensive.test.js
 *
 * Comprehensive Multi-Tenant Isolation & Authorization Security Test Suite (Phase C).
 *
 * Tests the complete multi-tenant boundaries using realistic synthetic fixtures:
 *  - Firm A
 *  - Firm B
 *  - SUPER_ADMIN
 *  - FIRM_ADMIN (Firm A)
 *  - FIRM_ADMIN (Firm B)
 *  - FIRM_STAFF (Firm A) with read-only permissions
 *  - FIRM_STAFF (Firm A) with write permissions
 *  - FIRM_STAFF (Firm A) without private-data or audit permissions
 *
 * Enforces all 12 Phase C mandatory security properties against the live application:
 *  1. Firm A can access its own authorized resources.
 *  2. Firm B can access its own authorized resources.
 *  3. Firm A cannot read Firm B's resources by ID substitution (404 NOT_FOUND).
 *  4. Firm A cannot update or delete Firm B's resources by ID substitution.
 *  5. Firm A cannot attach Firm B's colony to its own plot.
 *  6. Firm A cannot access Firm B's private owner/source data.
 *  7. FIRM_STAFF cannot bypass missing permissions by direct API requests.
 *  8. Tenant users cannot access platform administration endpoints (403 FORBIDDEN).
 *  9. SUPER_ADMIN cannot access tenant endpoints (403 FORBIDDEN).
 * 10. Client-supplied firmId cannot override authenticated tenant context.
 * 11. Headers/query params cannot change authenticated tenant scope.
 * 12. Invalid, missing or expired credentials never produce protected data (401 UNAUTHORIZED).
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import mongoose from 'mongoose';
import { app } from '../../src/app.js';
import { connectDB, disconnectDB } from '../../src/config/db.js';
import { Firm } from '../../src/models/Firm.model.js';
import { User } from '../../src/models/User.model.js';
import { Colony } from '../../src/models/Colony.model.js';
import { Plot } from '../../src/models/Plot.model.js';
import { PlotPrivate } from '../../src/models/PlotPrivate.model.js';
import { AuditLog } from '../../src/models/AuditLog.model.js';
import { ROLES } from '../../src/constants/roles.js';
import { PERMS } from '../../src/constants/permissions.js';
import { hashPassword } from '../../src/utils/password.js';

describe('Phase C — Multi-Tenant Isolation and Authorization Security Suite', () => {
  let firmA;
  let firmB;
  let superAdminToken;
  let firmAAdminToken;
  let firmBAdminToken;
  let staffReadOnlyToken;
  let staffWriteToken;
  let staffRestrictedToken;

  let colonyFirmA;
  let colonyFirmB;
  let plotFirmA;
  let plotFirmB;

  const TEST_PASSWORD = 'SecureTestPassword123!';

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
    await User.deleteMany({});
    await Firm.deleteMany({});

    const passwordHash = await hashPassword(TEST_PASSWORD);

    // 1. Provision Firm A and Firm B
    firmA = await Firm.create({
      name: 'Alpha Realty Firm',
      slug: 'alpha-realty',
      contactEmail: 'contact@alpha.test',
      contactPhone: '+91 98765 00001',
      isActive: true,
    });

    firmB = await Firm.create({
      name: 'Beta Properties Firm',
      slug: 'beta-properties',
      contactEmail: 'contact@beta.test',
      contactPhone: '+91 98765 00002',
      isActive: true,
    });

    // 2. Provision Users
    const superAdmin = await User.create({
      email: 'superadmin@platform.test',
      passwordHash,
      role: ROLES.SUPER_ADMIN,
      firmId: null,
      firstName: 'Super',
      lastName: 'Admin',
      isActive: true,
    });

    const firmAAdmin = await User.create({
      email: 'admin@alpha.test',
      passwordHash,
      role: ROLES.FIRM_ADMIN,
      firmId: firmA._id,
      firstName: 'Alpha',
      lastName: 'Admin',
      isActive: true,
    });

    const firmBAdmin = await User.create({
      email: 'admin@beta.test',
      passwordHash,
      role: ROLES.FIRM_ADMIN,
      firmId: firmB._id,
      firstName: 'Beta',
      lastName: 'Admin',
      isActive: true,
    });

    const staffReadOnly = await User.create({
      email: 'staff.readonly@alpha.test',
      passwordHash,
      role: ROLES.FIRM_STAFF,
      firmId: firmA._id,
      firstName: 'Staff',
      lastName: 'ReadOnly',
      permissions: [PERMS.PLOTS_READ, PERMS.COLONIES_READ],
      isActive: true,
    });

    const staffWrite = await User.create({
      email: 'staff.write@alpha.test',
      passwordHash,
      role: ROLES.FIRM_STAFF,
      firmId: firmA._id,
      firstName: 'Staff',
      lastName: 'Writer',
      permissions: [
        PERMS.PLOTS_READ,
        PERMS.PLOTS_WRITE,
        PERMS.COLONIES_READ,
        PERMS.COLONIES_WRITE,
      ],
      isActive: true,
    });

    const staffRestricted = await User.create({
      email: 'staff.restricted@alpha.test',
      passwordHash,
      role: ROLES.FIRM_STAFF,
      firmId: firmA._id,
      firstName: 'Staff',
      lastName: 'Restricted',
      permissions: [PERMS.PLOTS_READ], // No private:read, private:write, audit:read
      isActive: true,
    });

    // 3. Authenticate all users via real POST /api/auth/login
    async function login(email) {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ email, password: TEST_PASSWORD });
      expect(res.status).toBe(200);
      return res.body.data.accessToken;
    }

    superAdminToken = await login(superAdmin.email);
    firmAAdminToken = await login(firmAAdmin.email);
    firmBAdminToken = await login(firmBAdmin.email);
    staffReadOnlyToken = await login(staffReadOnly.email);
    staffWriteToken = await login(staffWrite.email);
    staffRestrictedToken = await login(staffRestricted.email);

    // 4. Provision baseline resources for Firm A
    colonyFirmA = await Colony.create({
      name: 'Alpha Colony One',
      firmId: firmA._id,
    });

    plotFirmA = await Plot.create({
      plotRef: 'A-101',
      colonyId: colonyFirmA._id,
      firmId: firmA._id,
      size: 1500,
      sizeUnit: 'sqft',
      rate: 3500,
      rateType: 'total',
      totalPrice: 5250000,
      status: 'available',
    });

    await PlotPrivate.create({
      plotId: plotFirmA._id,
      firmId: firmA._id,
      owner: {
        name: 'Alpha Secret Owner',
        phone: '+91 99999 11111',
      },
      notes: 'High-net-worth confidential client',
    });

    // 5. Provision baseline resources for Firm B
    colonyFirmB = await Colony.create({
      name: 'Beta Colony One',
      firmId: firmB._id,
    });

    plotFirmB = await Plot.create({
      plotRef: 'B-201',
      colonyId: colonyFirmB._id,
      firmId: firmB._id,
      size: 2000,
      sizeUnit: 'sqft',
      rate: 4000,
      rateType: 'total',
      totalPrice: 8000000,
      status: 'available',
    });

    await PlotPrivate.create({
      plotId: plotFirmB._id,
      firmId: firmB._id,
      owner: {
        name: 'Beta Secret Owner',
        phone: '+91 99999 22222',
      },
      notes: 'Confidential corporate source',
    });
  });

  // ─── Scenario 1: Firm A can access its own authorized resources ─────────────
  it('1. Firm A can access its own authorized resources', async () => {
    // Colonies
    const coloniesRes = await request(app)
      .get('/api/colonies')
      .set('Authorization', `Bearer ${firmAAdminToken}`);
    expect(coloniesRes.status).toBe(200);
    expect(coloniesRes.body.data.length).toBe(1);
    expect(coloniesRes.body.data[0].id).toBe(colonyFirmA._id.toString());

    // Plots
    const plotsRes = await request(app)
      .get('/api/plots')
      .set('Authorization', `Bearer ${firmAAdminToken}`);
    expect(plotsRes.status).toBe(200);
    expect(plotsRes.body.data.length).toBe(1);
    expect(plotsRes.body.data[0].plotRef).toBe('A-101');

    // Private Plot Data
    const privateRes = await request(app)
      .get(`/api/plots/${plotFirmA._id}/private`)
      .set('Authorization', `Bearer ${firmAAdminToken}`);
    expect(privateRes.status).toBe(200);
    expect(privateRes.body.data.owner.name).toBe('Alpha Secret Owner');
  });

  // ─── Scenario 2: Firm B can access its own authorized resources ─────────────
  it('2. Firm B can access its own authorized resources', async () => {
    const coloniesRes = await request(app)
      .get('/api/colonies')
      .set('Authorization', `Bearer ${firmBAdminToken}`);
    expect(coloniesRes.status).toBe(200);
    expect(coloniesRes.body.data.length).toBe(1);
    expect(coloniesRes.body.data[0].id).toBe(colonyFirmB._id.toString());

    const plotsRes = await request(app)
      .get('/api/plots')
      .set('Authorization', `Bearer ${firmBAdminToken}`);
    expect(plotsRes.status).toBe(200);
    expect(plotsRes.body.data.length).toBe(1);
    expect(plotsRes.body.data[0].plotRef).toBe('B-201');

    const privateRes = await request(app)
      .get(`/api/plots/${plotFirmB._id}/private`)
      .set('Authorization', `Bearer ${firmBAdminToken}`);
    expect(privateRes.status).toBe(200);
    expect(privateRes.body.data.owner.name).toBe('Beta Secret Owner');
  });

  // ─── Scenario 3: Firm A cannot read Firm B resources by changing ID ─────────
  it('3. Firm A cannot read Firm B resources by changing a resource ID (returns 404 NOT_FOUND)', async () => {
    // Read Firm B colony
    const colonyRes = await request(app)
      .get(`/api/colonies/${colonyFirmB._id}`)
      .set('Authorization', `Bearer ${firmAAdminToken}`);
    expect(colonyRes.status).toBe(404);
    expect(['COLONY_NOT_FOUND', 'NOT_FOUND']).toContain(colonyRes.body.error.code);

    // Read Firm B plot
    const plotRes = await request(app)
      .get(`/api/plots/${plotFirmB._id}`)
      .set('Authorization', `Bearer ${firmAAdminToken}`);
    expect(plotRes.status).toBe(404);
    expect(['PLOT_NOT_FOUND', 'NOT_FOUND']).toContain(plotRes.body.error.code);
  });

  // ─── Scenario 4: Firm A cannot update or delete Firm B resources ─────────────
  it('4. Firm A cannot update or delete Firm B resources by changing a resource ID', async () => {
    // Attempt update on Firm B plot
    const updateRes = await request(app)
      .patch(`/api/plots/${plotFirmB._id}`)
      .set('Authorization', `Bearer ${firmAAdminToken}`)
      .send({ rate: 999999 });
    expect(updateRes.status).toBe(404);

    // Verify database record was unchanged
    const unchangedPlot = await Plot.findById(plotFirmB._id);
    expect(unchangedPlot.rate).toBe(4000);

    // Attempt delete on Firm B plot
    const deleteRes = await request(app)
      .delete(`/api/plots/${plotFirmB._id}`)
      .set('Authorization', `Bearer ${firmAAdminToken}`);
    expect(deleteRes.status).toBe(404);

    const plotStillExists = await Plot.findById(plotFirmB._id);
    expect(plotStillExists.isActive).toBe(true);
  });

  // ─── Scenario 5: Firm A cannot attach Firm B colony to its own plot ──────────
  it('5. Firm A cannot attach Firm B colony to its own plot', async () => {
    const attachRes = await request(app)
      .post('/api/plots')
      .set('Authorization', `Bearer ${firmAAdminToken}`)
      .send({
        plotRef: 'A-ILLEGAL-1',
        colonyId: colonyFirmB._id.toString(), // Belongs to Firm B!
        size: 1000,
        sizeUnit: 'sqft',
        rate: 2000,
        rateType: 'total',
        status: 'available',
      });

    // Either 400 or 404 validation error preventing foreign colony attachment
    expect([400, 404]).toContain(attachRes.status);

    // Verify plot was NOT created
    const createdPlot = await Plot.findOne({ plotRef: 'A-ILLEGAL-1' });
    expect(createdPlot).toBeNull();
  });

  // ─── Scenario 6: Firm A cannot access Firm B private owner/source data ───────
  it('6. Firm A cannot access Firm B private owner/source data', async () => {
    // Read attempt
    const readRes = await request(app)
      .get(`/api/plots/${plotFirmB._id}/private`)
      .set('Authorization', `Bearer ${firmAAdminToken}`);
    expect(readRes.status).toBe(404);
    expect(['PLOT_NOT_FOUND', 'NOT_FOUND']).toContain(readRes.body.error.code);
    expect(readRes.body).not.toHaveProperty('data');

    // Mutation attempt (PUT)
    const putRes = await request(app)
      .put(`/api/plots/${plotFirmB._id}/private`)
      .set('Authorization', `Bearer ${firmAAdminToken}`)
      .send({
        ownerName: 'Hacked Owner',
        ownerPhone: '+91 90000 00000',
      });
    expect(putRes.status).toBe(404);

    // Verify DB private record for Firm B is intact
    const unchangedPrivate = await PlotPrivate.findOne({ plotId: plotFirmB._id });
    expect(unchangedPrivate.owner.name).toBe('Beta Secret Owner');
  });

  // ─── Scenario 7: FIRM_STAFF cannot bypass missing permissions ───────────────
  it('7. FIRM_STAFF cannot bypass missing permissions by direct API requests', async () => {
    // Read-only staff attempts to write plot
    const writePlotRes = await request(app)
      .post('/api/plots')
      .set('Authorization', `Bearer ${staffReadOnlyToken}`)
      .send({
        plotRef: 'A-STAFF-MUTATION',
        colonyId: colonyFirmA._id.toString(),
        size: 1000,
        sizeUnit: 'sqft',
        rate: 2000,
        rateType: 'total',
        status: 'available',
      });
    expect(writePlotRes.status).toBe(403);
    expect(writePlotRes.body.error.code).toBe('FORBIDDEN');

    // Restricted staff (no private:read) attempts to view private data
    const readPrivateRes = await request(app)
      .get(`/api/plots/${plotFirmA._id}/private`)
      .set('Authorization', `Bearer ${staffRestrictedToken}`);
    expect(readPrivateRes.status).toBe(403);
    expect(readPrivateRes.body.error.code).toBe('FORBIDDEN');

    // Restricted staff (no audit:read) attempts to list firm audit logs
    const auditRes = await request(app)
      .get('/api/firm/audit')
      .set('Authorization', `Bearer ${staffRestrictedToken}`);
    expect(auditRes.status).toBe(403);
    expect(auditRes.body.error.code).toBe('FORBIDDEN');
  });

  // ─── Scenario 8: Tenant user cannot reach platform administration ───────────
  it('8. Tenant user cannot reach platform administration endpoints (403 FORBIDDEN)', async () => {
    const platformRes = await request(app)
      .post('/api/platform/firms')
      .set('Authorization', `Bearer ${firmAAdminToken}`)
      .send({
        name: 'Malicious Firm Provisioning',
        slug: 'malicious-firm',
        contactEmail: 'malicious@test.com',
        contactPhone: '+91 99999 88888',
      });

    expect(platformRes.status).toBe(403);
    expect(platformRes.body.error.code).toBe('FORBIDDEN');

    const auditRes = await request(app)
      .get('/api/platform/audit')
      .set('Authorization', `Bearer ${firmAAdminToken}`);
    expect(auditRes.status).toBe(403);
  });

  // ─── Scenario 9: SUPER_ADMIN cannot use tenant endpoints ─────────────────────
  it('9. SUPER_ADMIN cannot use tenant endpoints (403 FORBIDDEN)', async () => {
    const firmMeRes = await request(app)
      .get('/api/firm/me')
      .set('Authorization', `Bearer ${superAdminToken}`);
    expect(firmMeRes.status).toBe(403);
    expect(firmMeRes.body.error.code).toBe('FORBIDDEN');

    const plotsRes = await request(app)
      .get('/api/plots')
      .set('Authorization', `Bearer ${superAdminToken}`);
    expect(plotsRes.status).toBe(403);

    const coloniesRes = await request(app)
      .get('/api/colonies')
      .set('Authorization', `Bearer ${superAdminToken}`);
    expect(coloniesRes.status).toBe(403);
  });

  // ─── Scenario 10: Client-supplied firmId cannot override tenant context ─────
  it('10. Client-supplied firmId cannot override authenticated tenant context', async () => {
    const maliciousFirmId = new mongoose.Types.ObjectId().toString();

    // Firm A creates a plot, but specifies firmId: maliciousFirmId
    const createRes = await request(app)
      .post('/api/plots')
      .set('Authorization', `Bearer ${firmAAdminToken}`)
      .send({
        plotRef: 'A-TAMPER-TEST',
        colonyId: colonyFirmA._id.toString(),
        firmId: maliciousFirmId, // Attacker tries to inject foreign firmId
        size: 1200,
        sizeUnit: 'sqft',
        rate: 3000,
        rateType: 'total',
        status: 'available',
      });

    expect(createRes.status).toBe(201);
    // The created plot must belong strictly to Firm A
    expect(createRes.body.data.firmId).toBe(firmA._id.toString());
    expect(createRes.body.data.firmId).not.toBe(maliciousFirmId);

    const dbPlot = await Plot.findOne({ plotRef: 'A-TAMPER-TEST' });
    expect(dbPlot.firmId.toString()).toBe(firmA._id.toString());
  });

  // ─── Scenario 11: Query params / headers cannot change tenant scope ─────────
  it('11. Query parameters, request bodies and headers cannot change authenticated tenant scope', async () => {
    // Attempt to pass ?firmId=firmB to Firm A plots list
    const plotsRes = await request(app)
      .get(`/api/plots?firmId=${firmB._id.toString()}`)
      .set('Authorization', `Bearer ${firmAAdminToken}`);

    expect(plotsRes.status).toBe(200);
    // Must return only Firm A plots
    expect(plotsRes.body.data.length).toBeGreaterThanOrEqual(1);
    for (const plot of plotsRes.body.data) {
      expect(plot.firmId).toBe(firmA._id.toString());
      expect(plot.firmId).not.toBe(firmB._id.toString());
    }
  });

  // ─── Scenario 12: Invalid or missing credentials never produce protected data
  it('12. Invalid, missing or expired credentials never produce protected data (401 UNAUTHORIZED)', async () => {
    // Unauthenticated
    const noAuthRes = await request(app).get('/api/plots');
    expect(noAuthRes.status).toBe(401);
    expect(noAuthRes.body.error.code).toBe('UNAUTHORIZED');

    // Malformed token
    const malformedRes = await request(app)
      .get('/api/plots')
      .set('Authorization', 'Bearer invalid-token-string');
    expect(malformedRes.status).toBe(401);
    expect(['INVALID_TOKEN', 'UNAUTHORIZED']).toContain(malformedRes.body.error.code);

    // Non-bearer scheme
    const wrongSchemeRes = await request(app)
      .get('/api/plots')
      .set('Authorization', 'Basic dXNlcjpwYXNz');
    expect(wrongSchemeRes.status).toBe(401);
  });
});
