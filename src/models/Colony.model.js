/**
 * src/models/Colony.model.js
 *
 * Colony residential development / sector model.
 *
 * Multi-Tenant Invariants:
 *  - firmId is required on every document and indexed.
 *  - Colony name is unique within each firm ({ firmId: 1, name: 1 } unique index).
 *  - Different firms may have colonies with the same name.
 */

import mongoose from 'mongoose';

const colonySchema = new mongoose.Schema(
  {
    firmId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Firm',
      required: [true, 'Owning firmId is required'],
      index: true,
    },

    name: {
      type: String,
      required: [true, 'Colony name is required'],
      trim: true,
      maxlength: [120, 'Colony name cannot exceed 120 characters'],
    },

    description: {
      type: String,
      trim: true,
      maxlength: [2000, 'Description cannot exceed 2000 characters'],
      default: null,
    },

    address: {
      type: String,
      trim: true,
      maxlength: [300, 'Address cannot exceed 300 characters'],
      default: null,
    },

    city: {
      type: String,
      trim: true,
      maxlength: [80, 'City cannot exceed 80 characters'],
      default: null,
    },

    state: {
      type: String,
      trim: true,
      maxlength: [80, 'State cannot exceed 80 characters'],
      default: null,
    },

    country: {
      type: String,
      trim: true,
      default: 'India',
    },

    pincode: {
      type: String,
      trim: true,
      maxlength: [20, 'Pincode cannot exceed 20 characters'],
      default: null,
    },

    mapImageUrl: {
      type: String,
      trim: true,
      default: null,
    },

    mapImage: {
      url: {
        type: String,
        trim: true,
        default: null,
      },
      publicId: {
        type: String,
        trim: true,
        default: null,
      },
    },

    isActive: {
      type: Boolean,
      default: true,
      index: true,
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
        ret.mapImageUrl = ret.mapImageUrl || ret.mapImage?.url || null;
        delete ret._id;
        delete ret.__v;
        return ret;
      },
    },
    toObject: {
      transform(_doc, ret) {
        ret.id = ret._id.toString();
        ret.mapImageUrl = ret.mapImageUrl || ret.mapImage?.url || null;
        delete ret._id;
        delete ret.__v;
        return ret;
      },
    },
  }
);

// Compound indexes
colonySchema.index({ firmId: 1, name: 1 }, { unique: true });
colonySchema.index({ firmId: 1, isActive: 1 });

/**
 * Returns safe serializable colony details.
 *
 * @returns {object}
 */
colonySchema.methods.toSafeObject = function () {
  const effectiveMapUrl = this.mapImageUrl || this.mapImage?.url || null;
  return {
    id: this._id.toString(),
    firmId: this.firmId.toString(),
    name: this.name,
    description: this.description || null,
    address: this.address || null,
    city: this.city || null,
    state: this.state || null,
    country: this.country || 'India',
    pincode: this.pincode || null,
    mapImageUrl: effectiveMapUrl,
    mapImage: this.mapImage?.url
      ? this.mapImage
      : effectiveMapUrl
      ? { url: effectiveMapUrl, publicId: null }
      : null,
    isActive: this.isActive,
    createdBy: this.createdBy ? this.createdBy.toString() : null,
    updatedBy: this.updatedBy ? this.updatedBy.toString() : null,
    createdAt: this.createdAt,
    updatedAt: this.updatedAt,
  };
};

export const Colony = mongoose.model('Colony', colonySchema);
export default Colony;
