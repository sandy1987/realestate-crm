/**
 * tests/unit/middleware/errorHandler.test.js
 *
 * Tests for centralized errorHandler middleware.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { errorHandler } from '../../../src/middleware/errorHandler.middleware.js';

describe('Error Handler Middleware (AC-5)', () => {
  const originalEnv = process.env.NODE_ENV;

  beforeEach(() => {
    process.env.NODE_ENV = 'production';
  });

  afterEach(() => {
    process.env.NODE_ENV = originalEnv;
  });

  const createMockResponse = () => {
    const res = {};
    res.statusCode = 200;
    res.status = vi.fn().mockImplementation((code) => {
      res.statusCode = code;
      return res;
    });
    res.json = vi.fn().mockImplementation((body) => {
      res.body = body;
      return res;
    });
    return res;
  };

  const req = {
    method: 'GET',
    originalUrl: '/test',
    ip: '127.0.0.1',
  };

  it('hides stack traces and returns generic message for 500 errors in production (AC-5)', () => {
    process.env.NODE_ENV = 'production';
    const error = new Error('Secret database connection password leaked');
    const res = createMockResponse();

    errorHandler(error, req, res, () => {});

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.body).toEqual({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Internal server error',
      },
    });
    expect(res.body.error.details).toBeUndefined();
  });

  it('handles 413 payload too large errors', () => {
    const error = new Error('request entity too large');
    error.type = 'entity.too.large';
    error.status = 413;
    const res = createMockResponse();

    errorHandler(error, req, res, () => {});

    expect(res.status).toHaveBeenCalledWith(413);
    expect(res.body.error.code).toBe('PAYLOAD_TOO_LARGE');
  });

  it('handles syntax errors from malformed JSON', () => {
    const error = new SyntaxError('Unexpected token in JSON');
    error.status = 400;
    error.body = '{ malformed json';
    const res = createMockResponse();

    errorHandler(error, req, res, () => {});

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.body.error.code).toBe('INVALID_JSON');
  });

  it('handles Mongo 11000 duplicate key error and maps to 409 CONFLICT', () => {
    const error = new Error('E11000 duplicate key error');
    error.code = 11000;
    error.keyPattern = { email: 1 };
    const res = createMockResponse();

    errorHandler(error, req, res, () => {});

    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.body.error.code).toBe('CONFLICT');
  });

  it('handles JWT token expiration and maps to 401 UNAUTHORIZED', () => {
    const error = new Error('jwt expired');
    error.name = 'TokenExpiredError';
    const res = createMockResponse();

    errorHandler(error, req, res, () => {});

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
  });
});
