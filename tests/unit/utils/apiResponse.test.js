/**
 * tests/unit/utils/apiResponse.test.js
 *
 * Tests for API response helper utilities.
 */

import { describe, it, expect, vi } from 'vitest';
import { sendSuccess, sendError, success, error } from '../../../src/utils/apiResponse.js';

describe('API Response Helpers', () => {
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

  describe('sendSuccess', () => {
    it('sends default 200 success response without meta', () => {
      const res = createMockResponse();
      sendSuccess(res, { foo: 'bar' });

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.body).toEqual({
        success: true,
        data: { foo: 'bar' },
      });
    });

    it('includes meta when provided', () => {
      const res = createMockResponse();
      const meta = { page: 1, limit: 20, total: 100, totalPages: 5 };
      sendSuccess(res, [{ id: 1 }], 200, meta);

      expect(res.body).toEqual({
        success: true,
        data: [{ id: 1 }],
        meta,
      });
    });

    it('supports custom status code like 201', () => {
      const res = createMockResponse();
      sendSuccess(res, { created: true }, 201);

      expect(res.status).toHaveBeenCalledWith(201);
    });
  });

  describe('sendError', () => {
    it('sends default 500 INTERNAL_ERROR response', () => {
      const res = createMockResponse();
      sendError(res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.body).toEqual({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Internal server error',
        },
      });
    });

    it('sends custom error code, status, message, and details', () => {
      const res = createMockResponse();
      sendError(res, {
        statusCode: 403,
        code: 'FORBIDDEN',
        message: 'Permission denied',
        details: [{ reason: 'Missing plots:write' }],
      });

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.body).toEqual({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: 'Permission denied',
          details: [{ reason: 'Missing plots:write' }],
        },
      });
    });
  });

  describe('aliases (success and error)', () => {
    it('success alias works identically to sendSuccess', () => {
      const res = createMockResponse();
      success(res, { ok: true });

      expect(res.body.success).toBe(true);
      expect(res.body.data.ok).toBe(true);
    });

    it('error alias works with object or positional arguments', () => {
      const res1 = createMockResponse();
      error(res1, { statusCode: 400, code: 'BAD_REQUEST', message: 'Invalid' });
      expect(res1.status).toHaveBeenCalledWith(400);

      const res2 = createMockResponse();
      error(res2, 'NOT_FOUND', 'Plot not found', 404);
      expect(res2.status).toHaveBeenCalledWith(404);
      expect(res2.body.error.code).toBe('NOT_FOUND');
      expect(res2.body.error.message).toBe('Plot not found');
    });
  });
});
