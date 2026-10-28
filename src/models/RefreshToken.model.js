/**
 * src/models/RefreshToken.model.js
 *
 * Refresh token storage for persistent authenticated sessions.
 * Stores only cryptographic SHA-256 hashes of refresh tokens, never raw token strings.
 */

import mongoose from 'mongoose';

const refreshTokenSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'userId is required for refresh token session'],
      index: true,
    },

    firmId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Firm',
      default: null,
    },

    tokenHash: {
      type: String,
      required: [true, 'tokenHash is required'],
      unique: true,
      index: true,
    },

    isRevoked: {
      type: Boolean,
      default: false,
      index: true,
    },

    expiresAt: {
      type: Date,
      required: [true, 'expiresAt is required'],
    },

    userAgent: {
      type: String,
      default: null,
    },

    ipAddress: {
      type: String,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

// TTL index to automatically purge expired tokens from MongoDB
refreshTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const RefreshToken = mongoose.model('RefreshToken', refreshTokenSchema);
export default RefreshToken;
