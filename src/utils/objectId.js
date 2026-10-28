/**
 * src/utils/objectId.js
 *
 * Mongoose ObjectId validation and casting utilities.
 */

import mongoose from 'mongoose';

const OBJECT_ID_HEX_REGEX = /^[0-9a-fA-F]{24}$/;

/**
 * Checks whether the given value is a valid 24-character hexadecimal MongoDB ObjectId
 * or an existing ObjectId instance.
 *
 * @param {unknown} value
 * @returns {boolean}
 */
export function isValidObjectId(value) {
  if (!value) return false;

  if (typeof value === 'string') {
    return OBJECT_ID_HEX_REGEX.test(value);
  }

  return (
    value instanceof mongoose.Types.ObjectId ||
    (typeof value === 'object' && value?._bsontype === 'ObjectID')
  );
}

/**
 * Safely converts a valid ObjectId string or returns the instance.
 * Throws a TypeError if the value is not a valid ObjectId.
 *
 * @param {string|mongoose.Types.ObjectId} value
 * @returns {mongoose.Types.ObjectId}
 */
export function toObjectId(value) {
  if (!isValidObjectId(value)) {
    throw new TypeError(`Invalid ObjectId representation: ${String(value)}`);
  }

  return typeof value === 'string' ? new mongoose.Types.ObjectId(value) : value;
}
