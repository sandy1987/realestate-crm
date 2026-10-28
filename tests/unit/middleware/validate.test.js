/**
 * tests/unit/middleware/validate.test.js
 *
 * Tests for validate middleware factory using Zod.
 */

import { describe, it, expect, vi } from 'vitest';
import { z } from 'zod';
import { validate } from '../../../src/middleware/validate.middleware.js';

describe('Validate Middleware (AC-4)', () => {
  const schema = z.object({
    name: z.string().min(2),
    rate: z.number().positive(),
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

  it('calls next() and strips unknown fields when input is valid', () => {
    const req = {
      body: {
        name: 'Plot 42',
        rate: 5000,
        unauthorizedField: 'malicious-data',
      },
    };
    const res = createMockResponse();
    const next = vi.fn();

    const middleware = validate(schema);
    middleware(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(res.status).not.toHaveBeenCalled();
    expect(req.body.name).toBe('Plot 42');
    expect(req.body.rate).toBe(5000);
    expect(req.body.unauthorizedField).toBeUndefined();
  });

  it('returns 400 VALIDATION_ERROR with field details when body is invalid (AC-4)', () => {
    const req = {
      body: {
        name: 'P', // too short (< 2)
        rate: -100, // not positive
      },
    };
    const res = createMockResponse();
    const next = vi.fn();

    const middleware = validate(schema);
    middleware(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.body).toMatchObject({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Request validation failed',
      },
    });
    expect(res.body.error.details).toBeInstanceOf(Array);
    expect(res.body.error.details).toHaveLength(2);

    const fields = res.body.error.details.map((d) => d.field);
    expect(fields).toContain('name');
    expect(fields).toContain('rate');
  });

  it('supports validating query parameters when source is query', () => {
    const querySchema = z.object({
      filter: z.string().min(1),
    });

    const req = {
      query: {},
    };
    const res = createMockResponse();
    const next = vi.fn();

    const middleware = validate(querySchema, 'query');
    middleware(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(res.body.error.details[0].field).toBe('filter');
  });
});
