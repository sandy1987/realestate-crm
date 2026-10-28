/**
 * src/models/PlotPrivate.model.js
 *
 * Dedicated private owner and source/referrer data model.
 *
 * Architectural Invariants:
 *  - Separate MongoDB collection from public plots.
 *  - firmId is required as a mandatory tenant isolation fence.
 *  - plotId is required and uniquely indexed with firmId ({ firmId: 1, plotId: 1 }).
 *  - Exactly one private record exists per plot.
 *  - Access is restricted exclusively to FIRM_ADMIN or FIRM_STAFF with explicit private permissions.
 *  - Never joined or populated into public plot query results.
 */

import mongoose from 'mongoose';

const plotPrivateSchema = new mongoose.Schema(
  {
    firmId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Firm',
      required: [true, 'Owning firmId is required'],
      index: true,
    },

    plotId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Plot',
      required: [true, 'Associated plotId is required'],
      index: true,
    },

    owner: {
      name: {
        type: String,
        trim: true,
        maxlength: [120, 'Owner name cannot exceed 120 characters'],
        default: null,
      },
      phone: {
        type: String,
        trim: true,
        maxlength: [30, 'Owner phone cannot exceed 30 characters'],
        default: null,
      },
      email: {
        type: String,
        trim: true,
        lowercase: true,
        maxlength: [120, 'Owner email cannot exceed 120 characters'],
        default: null,
      },
      address: {
        type: String,
        trim: true,
        maxlength: [300, 'Owner address cannot exceed 300 characters'],
        default: null,
      },
    },

    source: {
      name: {
        type: String,
        trim: true,
        maxlength: [120, 'Source name cannot exceed 120 characters'],
        default: null,
      },
      phone: {
        type: String,
        trim: true,
        maxlength: [30, 'Source phone cannot exceed 30 characters'],
        default: null,
      },
      email: {
        type: String,
        trim: true,
        lowercase: true,
        maxlength: [120, 'Source email cannot exceed 120 characters'],
        default: null,
      },
      type: {
        type: String,
        trim: true,
        maxlength: [50, 'Source type cannot exceed 50 characters'],
        default: null,
      },
    },

    notes: {
      type: String,
      trim: true,
      maxlength: [5000, 'Private notes cannot exceed 5000 characters'],
      default: null,
    },

    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },

    updatedBy: {
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
        ret.plotId = ret.plotId.toString();
        ret.firmId = ret.firmId.toString();
        delete ret._id;
        delete ret.__v;
        return ret;
      },
    },
    toObject: {
      transform(_doc, ret) {
        ret.id = ret._id.toString();
        ret.plotId = ret.plotId.toString();
        ret.firmId = ret.firmId.toString();
        delete ret._id;
        delete ret.__v;
        return ret;
      },
    },
  }
);

// Compound unique index ensuring one private record per plot within a firm
plotPrivateSchema.index({ firmId: 1, plotId: 1 }, { unique: true });

/**
 * Returns safe serializable representation of private record for authorized users.
 *
 * @returns {object}
 */
plotPrivateSchema.methods.toSafeObject = function () {
  return {
    id: this._id.toString(),
    plotId: this.plotId.toString(),
    firmId: this.firmId.toString(),
    owner: {
      name: this.owner?.name || null,
      phone: this.owner?.phone || null,
      email: this.owner?.email || null,
      address: this.owner?.address || null,
    },
    source: {
      name: this.source?.name || null,
      phone: this.source?.phone || null,
      email: this.source?.email || null,
      type: this.source?.type || null,
    },
    ownerName: this.owner?.name || null,
    ownerPhone: this.owner?.phone || null,
    ownerEmail: this.owner?.email || null,
    ownerAddress: this.owner?.address || null,
    sourceName: this.source?.name || null,
    sourcePhone: this.source?.phone || null,
    sourceEmail: this.source?.email || null,
    sourceType: this.source?.type || null,
    notes: this.notes || null,
    createdBy: this.createdBy ? this.createdBy.toString() : null,
    updatedBy: this.updatedBy ? this.updatedBy.toString() : null,
    createdAt: this.createdAt,
    updatedAt: this.updatedAt,
  };
};

export const PlotPrivate = mongoose.model('PlotPrivate', plotPrivateSchema);
export default PlotPrivate;
