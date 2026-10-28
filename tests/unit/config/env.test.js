/**
 * tests/unit/config/env.test.js
 *
 * Tests for environment variable parsing and validation using Zod schema.
 */

import { describe, it, expect } from 'vitest';
import { parseEnv } from '../../../src/config/env.js';

describe('Environment Config Validation (parseEnv)', () => {
  const validEnv = {
    NODE_ENV: 'test',
    PORT: '4000',
    MONGODB_URI: 'mongodb://localhost:27017/agent_broker_test',
    JWT_ACCESS_SECRET: 'a-very-long-and-secure-jwt-access-secret-32-chars',
    JWT_REFRESH_SECRET: 'a-very-long-and-secure-jwt-refresh-secret-32-chars',
    CORS_ALLOWED_ORIGINS: 'http://localhost:3000',
    LOG_LEVEL: 'silent',
  };

  it('successfully parses valid environment variables and applies defaults', () => {
    const parsed = parseEnv(validEnv);

    expect(parsed.NODE_ENV).toBe('test');
    expect(parsed.PORT).toBe(4000);
    expect(parsed.MONGODB_URI).toBe('mongodb://localhost:27017/agent_broker_test');
    expect(parsed.JWT_ACCESS_SECRET).toBe(validEnv.JWT_ACCESS_SECRET);
    expect(parsed.JWT_REFRESH_SECRET).toBe(validEnv.JWT_REFRESH_SECRET);
    expect(parsed.RATE_LIMIT_MAX).toBe(100);
    expect(parsed.AUTH_RATE_LIMIT_MAX).toBe(10);
  });

  it('fails with descriptive message when MONGODB_URI is missing (AC-6)', () => {
    const invalidEnv = { ...validEnv };
    delete invalidEnv.MONGODB_URI;

    expect(() => parseEnv(invalidEnv)).toThrowError(/MONGODB_URI/i);
  });

  it('fails with descriptive message when JWT_ACCESS_SECRET is missing (AC-7)', () => {
    const invalidEnv = { ...validEnv };
    delete invalidEnv.JWT_ACCESS_SECRET;

    expect(() => parseEnv(invalidEnv)).toThrowError(/JWT_ACCESS_SECRET/i);
  });

  it('fails when JWT_ACCESS_SECRET is shorter than 32 characters', () => {
    const invalidEnv = {
      ...validEnv,
      JWT_ACCESS_SECRET: 'too-short-secret',
    };

    expect(() => parseEnv(invalidEnv)).toThrowError(/at least 32 characters/i);
  });

  it('fails when JWT_REFRESH_SECRET is shorter than 32 characters', () => {
    const invalidEnv = {
      ...validEnv,
      JWT_REFRESH_SECRET: 'too-short-secret',
    };

    expect(() => parseEnv(invalidEnv)).toThrowError(/at least 32 characters/i);
  });

  it('fails when NODE_ENV is not one of development, production, test', () => {
    const invalidEnv = {
      ...validEnv,
      NODE_ENV: 'staging',
    };

    expect(() => parseEnv(invalidEnv)).toThrowError(/Invalid enum value/i);
  });
});
