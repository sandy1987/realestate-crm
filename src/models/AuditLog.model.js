/**
 * src/models/AuditLog.model.js
 *
 * Audit trail log model.
 * Records security-sensitive and business actions across tenants and platform.
 *
 * Invariants:
 *  - Immutable: documents are insert-only; no updatedAt or mutation hooks.
 *  - firmId is indexed and populated for tenant actions, null for platform events.
 *  - Strict metadata sanitization: sensitive credentials, tokens, or PII are never stored.
 *  - eventType is validated against approved ALL_AUDIT_EVENTS.
 */

import mongoose from 'mongoose';
import { ALL_AUDIT_EVENTS } from '../constants/auditEvents.js';
import { ROLES } from '../constants/roles.js';

const auditLogSchema = new mongoose.Schema(
  {
    eventType: {
      type: String,
      required: [true, 'Audit event type is required'],
      enum: {
        values: ALL_AUDIT_EVENTS,
        message: 'Invalid audit event type: {VALUE}',
      },
      index: true,
    },

    actorUserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
      index: true,
    },

    actorRole: {
      type: String,
      enum: {
        values: Object.values(ROLES).concat([null]),
        message: 'Invalid actor role: {VALUE}',
      },
      default: null,
    },

    firmId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Firm',
      default: null,
      index: true,
    },

    resourceType: {
      type: String,
      required: [true, 'Resource type is required'],
      index: true,
    },

    resourceId: {
      type: String,
      default: null,
    },

    action: {
      type: String,
      required: [true, 'Action is required'],
    },

    outcome: {
      type: String,
      enum: ['success', 'failure'],
      default: 'success',
      index: true,
    },

    requestId: {
      type: String,
      default: null,
    },

    ipAddress: {
      type: String,
      default: null,
    },

    userAgent: {
      type: String,
      default: null,
    },

    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: () => ({}),
    },
  },
  {
    timestamps: { createdAt: true, updatedAt: false }, // Immutable append-only log
    toJSON: {
      transform(_doc, ret) {
        ret.id = ret._id.toString();
        delete ret._id;
        delete ret.__v;
        return ret;
      },
    },
    toObject: {
      transform(_doc, ret) {
        ret.id = ret._id.toString();
        delete ret._id;
        delete ret.__v;
        return ret;
      },
    },
  }
);

// Compound indexes for optimal audit querying
auditLogSchema.index({ firmId: 1, createdAt: -1 });
auditLogSchema.index({ firmId: 1, eventType: 1, createdAt: -1 });
auditLogSchema.index({ firmId: 1, actorUserId: 1, createdAt: -1 });
auditLogSchema.index({ eventType: 1, createdAt: -1 });
auditLogSchema.index({ actorUserId: 1, createdAt: -1 });

/**
 * Returns safe serializable representation of audit record.
 */
auditLogSchema.methods.toSafeObject = function () {
  return {
    id: this._id.toString(),
    eventType: this.eventType,
    actorUserId: this.actorUserId ? this.actorUserId.toString() : null,
    actorRole: this.actorRole || null,
    firmId: this.firmId ? this.firmId.toString() : null,
    resourceType: this.resourceType,
    resourceId: this.resourceId || null,
    action: this.action,
    outcome: this.outcome,
    requestId: this.requestId || null,
    ipAddress: this.ipAddress || null,
    userAgent: this.userAgent || null,
    metadata: this.metadata || {},
    createdAt: this.createdAt,
  };
};

export const AuditLog = mongoose.model('AuditLog', auditLogSchema);
export default AuditLog;
