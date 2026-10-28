/**
 * src/utils/password.js
 *
 * Password hashing and verification using Argon2id.
 * Includes a pre-computed dummy hash to prevent email enumeration timing attacks.
 */

import argon2 from 'argon2';

// Standard Argon2id configuration
const ARGON2_OPTIONS = {
  type: argon2.argon2id,
  memoryCost: 19456, // 19 MiB
  timeCost: 2,
  parallelism: 1,
};

// Constant dummy hash used for non-existent users during login to equalize timing
const DUMMY_HASH = '$argon2id$v=19$m=19456,t=2,p=1$7B5Wk7f+K5Q5u9D3Z+1q/A$9wK7Fz9T4xG5vU2J8m0L3nP6rS1tY4wQ7zX0cV2bN4M';

/**
 * Hashes a plaintext password using Argon2id.
 *
 * @param {string} password - Plaintext password
 * @returns {Promise<string>} Argon2id password hash
 */
export async function hashPassword(password) {
  if (typeof password !== 'string' || password.length === 0) {
    throw new TypeError('Password must be a non-empty string');
  }
  return argon2.hash(password, ARGON2_OPTIONS);
}

/**
 * Verifies a plaintext password against an Argon2id hash.
 *
 * @param {string} hash - Argon2id password hash
 * @param {string} password - Plaintext candidate password
 * @returns {Promise<boolean>} True if match, false otherwise
 */
export async function verifyPassword(hash, password) {
  if (!hash || typeof password !== 'string') {
    return false;
  }
  try {
    return await argon2.verify(hash, password);
  } catch {
    return false;
  }
}

/**
 * Executes a dummy verification to maintain constant-time behavior
 * when a requested user account does not exist.
 *
 * @param {string} password - Plaintext candidate password
 * @returns {Promise<boolean>} Always resolves to false
 */
export async function verifyDummyPassword(password) {
  await verifyPassword(DUMMY_HASH, typeof password === 'string' ? password : 'dummy');
  return false;
}
