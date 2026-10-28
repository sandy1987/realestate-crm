/**
 * tests/unit/models/user.test.js
 *
 * Unit tests for User model invariants, password hashing, email normalization,
 * role/firmId constraints, and safe serialization.
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import mongoose from 'mongoose';
import { User } from '../../../src/models/User.model.js';
import { ROLES } from '../../../src/constants/roles.js';
import { connectDB, disconnectDB } from '../../../src/config/db.js';
import { hashPassword } from '../../../src/utils/password.js';

describe('User Model Unit Tests', () => {
  beforeAll(async () => {
    await connectDB();
  });

  afterAll(async () => {
    await disconnectDB();
  });

  beforeEach(async () => {
    await User.deleteMany({});
  });

  it('1. creates a user and verifies password hashing (AC-1)', async () => {
    const rawPassword = 'SecureSecretPassword123!';
    const passwordHash = await hashPassword(rawPassword);

    const user = await User.create({
      email: 'test@firm.com',
      passwordHash,
      role: ROLES.FIRM_ADMIN,
      firmId: new mongoose.Types.ObjectId(),
    });

    expect(user._id).toBeDefined();
    expect(user.email).toBe('test@firm.com');
    expect(user.passwordHash).toBe(passwordHash);

    // Verify instance method verifyPassword
    const isMatch = await user.verifyPassword(rawPassword);
    expect(isMatch).toBe(true);

    const isWrongMatch = await user.verifyPassword('WrongPassword!');
    expect(isWrongMatch).toBe(false);
  });

  it('2. password hash never equals plaintext password (AC-2)', async () => {
    const rawPassword = 'PlaintextPassword99!';
    const hash = await hashPassword(rawPassword);

    expect(hash).not.toBe(rawPassword);
    expect(hash.startsWith('$argon2id$')).toBe(true);
  });

  it('3. normalizes email to lowercase and enforces global uniqueness (AC-3)', async () => {
    const passwordHash = await hashPassword('Password123!');
    const firmId1 = new mongoose.Types.ObjectId();
    const firmId2 = new mongoose.Types.ObjectId();

    // Create user with mixed case and whitespace
    await User.create({
      email: '  UniqueUser@Domain.COM  ',
      passwordHash,
      role: ROLES.FIRM_ADMIN,
      firmId: firmId1,
    });

    // Lookup with clean lowercase
    const found = await User.findOne({ email: 'uniqueuser@domain.com' });
    expect(found).not.toBeNull();
    expect(found.email).toBe('uniqueuser@domain.com');

    // Attempt to create duplicate email in another firm must fail
    await expect(
      User.create({
        email: 'uniqueuser@domain.com',
        passwordHash,
        role: ROLES.FIRM_STAFF,
        firmId: firmId2,
      })
    ).rejects.toThrow();
  });

  it('4. SUPER_ADMIN must have firmId: null (AC-4)', async () => {
    const passwordHash = await hashPassword('Password123!');

    // Allowed: SUPER_ADMIN with firmId null
    const superAdmin = await User.create({
      email: 'superadmin@platform.com',
      passwordHash,
      role: ROLES.SUPER_ADMIN,
      firmId: null,
    });
    expect(superAdmin.firmId).toBeNull();

    // Rejected: SUPER_ADMIN with a firmId assigned
    await expect(
      User.create({
        email: 'invalid-superadmin@platform.com',
        passwordHash,
        role: ROLES.SUPER_ADMIN,
        firmId: new mongoose.Types.ObjectId(),
      })
    ).rejects.toThrowError(/firmId must be null for SUPER_ADMIN/);
  });

  it('5. Tenant roles require a non-null firmId (AC-5)', async () => {
    const passwordHash = await hashPassword('Password123!');

    // Rejected: FIRM_ADMIN with firmId: null
    await expect(
      User.create({
        email: 'orphan-admin@firm.com',
        passwordHash,
        role: ROLES.FIRM_ADMIN,
        firmId: null,
      })
    ).rejects.toThrowError(/required for tenant roles/);

    // Rejected: FIRM_STAFF with firmId: null
    await expect(
      User.create({
        email: 'orphan-staff@firm.com',
        passwordHash,
        role: ROLES.FIRM_STAFF,
        firmId: null,
      })
    ).rejects.toThrowError(/required for tenant roles/);
  });

  it('6. Safe User serialization strips passwordHash and __v (AC-6)', async () => {
    const passwordHash = await hashPassword('Password123!');
    const firmId = new mongoose.Types.ObjectId();

    const user = await User.create({
      email: 'serialize@firm.com',
      passwordHash,
      role: ROLES.FIRM_ADMIN,
      firmId,
      firstName: 'Alice',
      lastName: 'Smith',
    });

    // Default query does not include passwordHash due to select: false
    const queried = await User.findById(user._id);
    expect(queried.passwordHash).toBeUndefined();

    // toSafeObject omits passwordHash
    const safeObj = queried.toSafeObject();
    expect(safeObj.passwordHash).toBeUndefined();
    expect(safeObj.email).toBe('serialize@firm.com');
    expect(safeObj.role).toBe(ROLES.FIRM_ADMIN);
    expect(safeObj.firmId).toBe(firmId.toString());

    // toJSON transform omits passwordHash and __v
    const json = JSON.parse(JSON.stringify(queried));
    expect(json.passwordHash).toBeUndefined();
    expect(json.__v).toBeUndefined();
    expect(json.id).toBe(user._id.toString());
  });
});
