/**
 * tests/unit/utils/objectId.test.js
 *
 * Tests for ObjectId validation and conversion utilities.
 */

import { describe, it, expect } from 'vitest';
import mongoose from 'mongoose';
import { isValidObjectId, toObjectId } from '../../../src/utils/objectId.js';

describe('ObjectId Utilities (AC-10)', () => {
  const validHexId = '507f1f77bcf86cd799439011';
  const instanceId = new mongoose.Types.ObjectId();

  describe('isValidObjectId', () => {
    it('returns true for a valid 24-char hex string (AC-10)', () => {
      expect(isValidObjectId(validHexId)).toBe(true);
    });

    it('returns true for a mongoose.Types.ObjectId instance', () => {
      expect(isValidObjectId(instanceId)).toBe(true);
    });

    it('returns false for invalid string values (AC-10)', () => {
      expect(isValidObjectId('not-an-id')).toBe(false);
      expect(isValidObjectId('123')).toBe(false);
      expect(isValidObjectId('zzzzzzzzzzzzzzzzzzzzzzzz')).toBe(false);
      expect(isValidObjectId('')).toBe(false);
    });

    it('returns false for non-string, non-ObjectId types', () => {
      expect(isValidObjectId(null)).toBe(false);
      expect(isValidObjectId(undefined)).toBe(false);
      expect(isValidObjectId(12345)).toBe(false);
      expect(isValidObjectId({})).toBe(false);
      expect(isValidObjectId([])).toBe(false);
    });
  });

  describe('toObjectId', () => {
    it('converts a valid hex string to a mongoose.Types.ObjectId', () => {
      const result = toObjectId(validHexId);

      expect(result).toBeInstanceOf(mongoose.Types.ObjectId);
      expect(result.toString()).toBe(validHexId);
    });

    it('returns the same ObjectId instance when given an instance', () => {
      const result = toObjectId(instanceId);

      expect(result).toBe(instanceId);
    });

    it('throws a TypeError when given an invalid string or type', () => {
      expect(() => toObjectId('not-an-id')).toThrow(TypeError);
      expect(() => toObjectId(null)).toThrow(TypeError);
    });
  });
});
