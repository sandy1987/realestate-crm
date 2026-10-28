/**
 * tests/e2e/testServer.js
 *
 * Ephemeral In-Memory Backend Server for Browser E2E and Live Integration Journeys.
 *
 * Operates strictly with MongoMemoryServer. Never connects to production Atlas.
 * Seeds standard role fixtures:
 *  - SUPER_ADMIN: superadmin@platform.test / TestPassword123!
 *  - FIRM_ADMIN (Firm A): admin@alpha.test / TestPassword123!
 *  - FIRM_STAFF (Firm A): staff@alpha.test / TestPassword123!
 *  - FIRM_ADMIN (Firm B): admin@beta.test / TestPassword123!
 */

import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';
import { hashPassword } from '../../src/utils/password.js';
import { ROLES } from '../../src/constants/roles.js';
import { PERMS } from '../../src/constants/permissions.js';

let mongod;
let server;

async function run() {
  mongod = await MongoMemoryServer.create();
  const uri = mongod.getUri();

  process.env.MONGODB_URI = uri;
  process.env.PORT = '5000';
  process.env.NODE_ENV = 'test';
  process.env.JWT_ACCESS_SECRET = 'e2e-test-access-secret-minimum-32-chars-length!';
  process.env.JWT_REFRESH_SECRET = 'e2e-test-refresh-secret-minimum-32-chars-length!';
  process.env.CORS_ALLOWED_ORIGINS = 'http://localhost:3000,http://localhost:5000,http://localhost:5173';

  const { default: app } = await import('../../src/app.js');
  const { connectDB } = await import('../../src/config/db.js');
  const { User } = await import('../../src/models/User.model.js');
  const { Firm } = await import('../../src/models/Firm.model.js');
  const { Colony } = await import('../../src/models/Colony.model.js');
  const { Plot } = await import('../../src/models/Plot.model.js');
  const { PlotPrivate } = await import('../../src/models/PlotPrivate.model.js');

  await connectDB(uri);

  const passwordHash = await hashPassword('TestPassword123!');

  const firmA = await Firm.create({
    name: 'Alpha Realty',
    slug: 'alpha-realty',
    contactEmail: 'contact@alpha.test',
    contactPhone: '+91 98765 11111',
    isActive: true,
  });

  const firmB = await Firm.create({
    name: 'Beta Properties',
    slug: 'beta-properties',
    contactEmail: 'contact@beta.test',
    contactPhone: '+91 98765 22222',
    isActive: true,
  });

  await User.create({
    email: 'superadmin@platform.test',
    passwordHash,
    role: ROLES.SUPER_ADMIN,
    firmId: null,
    firstName: 'Platform',
    lastName: 'Admin',
    isActive: true,
  });

  await User.create({
    email: 'admin@alpha.test',
    passwordHash,
    role: ROLES.FIRM_ADMIN,
    firmId: firmA._id,
    firstName: 'Alpha',
    lastName: 'Admin',
    isActive: true,
  });

  await User.create({
    email: 'staff@alpha.test',
    passwordHash,
    role: ROLES.FIRM_STAFF,
    firmId: firmA._id,
    firstName: 'Alpha',
    lastName: 'Staff',
    permissions: [PERMS.PLOTS_READ, PERMS.COLONIES_READ],
    isActive: true,
  });

  await User.create({
    email: 'admin@beta.test',
    passwordHash,
    role: ROLES.FIRM_ADMIN,
    firmId: firmB._id,
    firstName: 'Beta',
    lastName: 'Admin',
    isActive: true,
  });

  const colonyA = await Colony.create({
    name: 'Greenfield Valley',
    firmId: firmA._id,
    city: 'Jaipur',
    state: 'Rajasthan',
    isActive: true,
  });

  const plotA = await Plot.create({
    plotRef: 'A-101',
    colonyId: colonyA._id,
    firmId: firmA._id,
    size: 1200,
    sizeUnit: 'sqft',
    rate: 3500,
    rateType: 'total',
    totalPrice: 4200000,
    status: 'available',
    isActive: true,
  });

  await PlotPrivate.create({
    plotId: plotA._id,
    firmId: firmA._id,
    owner: {
      name: 'Ramesh Gupta',
      phone: '+91 98765 43210',
      email: 'ramesh.gupta@example.test',
      address: 'Plot 4, Civil Lines',
    },
    source: {
      name: 'Direct Walk-in',
      type: 'direct',
    },
    notes: 'Confidential owner record for E2E testing',
  });

  server = app.listen(5000, () => {
    console.log('[E2E-TEST-SERVER-READY] listening on port 5000');
  });
}

run().catch((err) => {
  console.error('[E2E-TEST-SERVER-FATAL]', err);
  process.exit(1);
});
