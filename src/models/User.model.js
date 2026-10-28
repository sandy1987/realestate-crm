/**
 * src/models/User.model.js
 *
 * User identity model.
 *
 * Invariants:
 *  - Email is globally unique across the entire platform.
 *  - SUPER_ADMIN firmId must be null.
 *  - FIRM_ADMIN and FIRM_STAFF firmId must be a valid ObjectId (non-null).
 *  - passwordHash is never returned in default queries (select: false) or serialized JSON.
 */

import mongoose from 'mongoose';
import { ROLES } from '../constants/roles.js';
import { ALL_PERMISSIONS } from '../constants/permissions.js';
import { verifyPassword } from '../utils/password.js';

const userSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^[^\s@]+@[^\s@]+\.[^\s@]+$/, 'Invalid email address format'],
    },

    passwordHash: {
      type: String,
      required: [true, 'Password hash is required'],
      select: false,
    },

    role: {
      type: String,
      enum: {
        values: Object.values(ROLES),
        message: 'Invalid user role: {VALUE}',
      },
      required: [true, 'User role is required'],
    },

    firmId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Firm',
      default: null,
      validate: {
        validator(v) {
          if (this.role === ROLES.SUPER_ADMIN) {
            return v == null;
          }
          return v != null;
        },
        message: 'firmId must be null for SUPER_ADMIN and required for tenant roles',
      },
    },

    permissions: {
      type: [String],
      enum: {
        values: ALL_PERMISSIONS,
        message: 'Invalid permission string: {VALUE}',
      },
      default: [],
    },

    firstName: {
      type: String,
      trim: true,
      maxlength: [60, 'First name cannot exceed 60 characters'],
      default: null,
    },

    lastName: {
      type: String,
      trim: true,
      maxlength: [60, 'Last name cannot exceed 60 characters'],
      default: null,
    },

    isActive: {
      type: Boolean,
      default: true,
    },

    isSuspended: {
      type: Boolean,
      default: false,
    },

    lastLoginAt: {
      type: Date,
      default: null,
    },

    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
  },
  {
    timestamps: true,
    toJSON: {
      transform(_doc, ret) {
        ret.id = ret._id.toString();
        delete ret._id;
        delete ret.__v;
        delete ret.passwordHash;
        return ret;
      },
    },
    toObject: {
      transform(_doc, ret) {
        ret.id = ret._id.toString();
        delete ret._id;
        delete ret.__v;
        delete ret.passwordHash;
        return ret;
      },
    },
  }
);

// Secondary compound indexes for tenant queries
userSchema.index({ firmId: 1, role: 1 });
userSchema.index({ firmId: 1, isActive: 1 });

/**
 * Instance method to verify a plaintext candidate password against this user's passwordHash.
 *
 * @param {string} candidatePassword
 * @returns {Promise<boolean>}
 */
userSchema.methods.verifyPassword = async function (candidatePassword) {
  if (!this.passwordHash) {
    throw new Error('Password hash is not loaded on user document. Call .select("+passwordHash") before verification.');
  }
  return verifyPassword(this.passwordHash, candidatePassword);
};

/**
 * Returns a plain object with only safe identity fields, omitting any internal secrets.
 *
 * @returns {object}
 */
userSchema.methods.toSafeObject = function () {
  return {
    id: this._id.toString(),
    email: this.email,
    role: this.role,
    firmId: this.firmId ? this.firmId.toString() : null,
    permissions: this.permissions || [],
    firstName: this.firstName || null,
    lastName: this.lastName || null,
    isActive: this.isActive,
    isSuspended: this.isSuspended,
    lastLoginAt: this.lastLoginAt || null,
    createdAt: this.createdAt,
    updatedAt: this.updatedAt,
  };
};

export const User = mongoose.model('User', userSchema);
export default User;
