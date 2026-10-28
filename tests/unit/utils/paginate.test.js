/**
 * tests/unit/utils/paginate.test.js
 *
 * Tests for pagination parsing and metadata utilities.
 */

import { describe, it, expect } from 'vitest';
import { parsePagination, buildPaginationMeta } from '../../../src/utils/paginate.js';

describe('Pagination Utilities', () => {
  describe('parsePagination', () => {
    it('applies default pagination values when no query parameters are given', () => {
      const result = parsePagination({});

      expect(result).toEqual({
        page: 1,
        limit: 20,
        skip: 0,
        sortBy: 'createdAt',
        sortOrder: 'desc',
      });
    });

    it('caps limit at 100 when requested limit is larger (AC-9)', () => {
      const result = parsePagination({ limit: '500' });

      expect(result.limit).toBe(100);
      expect(result.page).toBe(1);
    });

    it('handles negative or invalid page and limit numbers gracefully', () => {
      const result = parsePagination({ page: '-5', limit: 'invalid' });

      expect(result.page).toBe(1);
      expect(result.limit).toBe(20);
      expect(result.skip).toBe(0);
    });

    it('calculates correct skip value for page 3 with limit 15', () => {
      const result = parsePagination({ page: '3', limit: '15' });

      expect(result.page).toBe(3);
      expect(result.limit).toBe(15);
      expect(result.skip).toBe(30);
    });

    it('whitelists allowed sort fields and falls back to default when invalid field requested', () => {
      const allowedFields = ['createdAt', 'rate', 'size'];

      const validSort = parsePagination({ sortBy: 'rate' }, allowedFields);
      expect(validSort.sortBy).toBe('rate');

      const invalidSort = parsePagination({ sortBy: 'password' }, allowedFields);
      expect(invalidSort.sortBy).toBe('createdAt');
    });

    it('accepts asc or desc sortOrder and normalizes case', () => {
      const asc = parsePagination({ sortOrder: 'ASC' });
      expect(asc.sortOrder).toBe('asc');

      const desc = parsePagination({ sortOrder: 'desc' });
      expect(desc.sortOrder).toBe('desc');

      const invalid = parsePagination({ sortOrder: 'sideways' });
      expect(invalid.sortOrder).toBe('desc');
    });
  });

  describe('buildPaginationMeta', () => {
    it('computes correct totalPages for exact division', () => {
      const meta = buildPaginationMeta(100, 2, 20);

      expect(meta).toEqual({
        page: 2,
        limit: 20,
        total: 100,
        totalPages: 5,
      });
    });

    it('computes correct totalPages for inexact division', () => {
      const meta = buildPaginationMeta(95, 1, 20);

      expect(meta.totalPages).toBe(5);
    });

    it('handles 0 total items gracefully', () => {
      const meta = buildPaginationMeta(0, 1, 20);

      expect(meta).toEqual({
        page: 1,
        limit: 20,
        total: 0,
        totalPages: 1,
      });
    });
  });
});
