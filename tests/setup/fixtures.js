/**
 * tests/setup/fixtures.js
 *
 * Test helper fixtures for creating controlled test users in the in-memory database.
 */

import mongoose from 'mongoose';
import { User } from '../../src/models/User.model.js';
import { Firm } from '../../src/models/Firm.model.js';
import { ROLES } from '../../src/constants/roles.js';
import { hashPassword } from '../../src/utils/password.js';

export const DEFAULT_TEST_PASSWORD = 'TestPassword123!';

/**
 * Creates a test Firm in MongoDB.
 *
 * @param {object} [overrides={}]
 * @returns {Promise<import('../../src/models/Firm.model.js').Firm>}
 */
export async function createTestFirm(overrides = {}) {
  const randomSuffix = Math.random().toString(36).substring(2, 8);
  const firmData = {
    name: `Test Firm ${randomSuffix}`,
    slug: `test-firm-${randomSuffix}`,
    contactEmail: `contact-${randomSuffix}@firm.com`,
    contactPhone: '+91 98765 43210',
    isActive: true,
    settings: {
      allowedVideoProviders: ['youtube', 'vimeo'],
      defaultCurrency: 'INR',
    },
    ...overrides,
  };

  return Firm.create(firmData);
}

/**
 * Creates a test Firm with an associated FIRM_ADMIN user.
 *
 * @param {object} [firmOverrides={}]
 * @param {object} [userOverrides={}]
 * @returns {Promise<{ firm: import('../../src/models/Firm.model.js').Firm, admin: import('../../src/models/User.model.js').User, rawPassword: string }>}
 */
export async function createTestFirmWithAdmin(firmOverrides = {}, userOverrides = {}) {
  const firm = await createTestFirm(firmOverrides);
  const { user: admin, rawPassword } = await createTestUser({
    role: ROLES.FIRM_ADMIN,
    firmId: firm._id,
    ...userOverrides,
  });
  return { firm, admin, rawPassword };
}

/**
 * Creates a test user in MongoDB.
 *
 * @param {object} [overrides={}]
 * @returns {Promise<{ user: import('../../src/models/User.model.js').User, rawPassword: string }>}
 */
export async function createTestUser(overrides = {}) {
  const randomSuffix = Math.random().toString(36).substring(2, 8);
  const password = overrides.password || DEFAULT_TEST_PASSWORD;
  const passwordHash = overrides.passwordHash || (await hashPassword(password));

  const role = overrides.role || ROLES.FIRM_ADMIN;
  let firmId = overrides.firmId;

  if (firmId === undefined) {
    firmId = role === ROLES.SUPER_ADMIN ? null : new mongoose.Types.ObjectId();
  }

  const userData = {
    email: `testuser-${randomSuffix}@example.com`,
    passwordHash,
    role,
    firmId,
    firstName: 'Test',
    lastName: 'User',
    isActive: true,
    isSuspended: false,
    permissions: [],
    ...overrides,
  };

  delete userData.password;

  const user = await User.create(userData);
  return { user, rawPassword: password };
}

/**
 * Creates a test SUPER_ADMIN user with firmId: null.
 */
export async function createTestSuperAdmin(overrides = {}) {
  return createTestUser({
    role: ROLES.SUPER_ADMIN,
    firmId: null,
    ...overrides,
  });
}

/**
 * Creates a test FIRM_STAFF user with a valid firmId.
 */
export async function createTestStaff(overrides = {}) {
  return createTestUser({
    role: ROLES.FIRM_STAFF,
    ...overrides,
  });
}
