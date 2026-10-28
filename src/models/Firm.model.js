/**
 * src/models/Firm.model.js
 *
 * Firm tenant organization model.
 *
 * Each real estate firm is an isolated tenant.
 * The slug serves as a normalized, globally unique tenant identifier.
 */

import mongoose from 'mongoose';

const firmSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Firm name is required'],
      trim: true,
      maxlength: [120, 'Firm name cannot exceed 120 characters'],
    },

    slug: {
      type: String,
      required: [true, 'Firm slug identifier is required'],
      unique: true,
      lowercase: true,
      trim: true,
      match: [
        /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
        'Slug must consist of lowercase alphanumeric characters separated by single hyphens',
      ],
      maxlength: [80, 'Slug cannot exceed 80 characters'],
    },

    contactEmail: {
      type: String,
      lowercase: true,
      trim: true,
      match: [/^[^\s@]+@[^\s@]+\.[^\s@]+$/, 'Invalid contact email format'],
      default: null,
    },

    contactPhone: {
      type: String,
      trim: true,
      maxlength: [30, 'Contact phone cannot exceed 30 characters'],
      default: null,
    },

    isActive: {
      type: Boolean,
      default: true,
    },

    settings: {
      allowedVideoProviders: {
        type: [String],
        enum: ['youtube', 'vimeo', 'cloudinary'],
        default: ['youtube', 'vimeo', 'cloudinary'],
      },
      defaultCurrency: {
        type: String,
        default: 'INR',
      },
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

// Secondary indexes
firmSchema.index({ isActive: 1 });

/**
 * Returns safe serializable firm details.
 *
 * @returns {object}
 */
firmSchema.methods.toSafeObject = function () {
  return {
    id: this._id.toString(),
    name: this.name,
    slug: this.slug,
    contactEmail: this.contactEmail || null,
    contactPhone: this.contactPhone || null,
    isActive: this.isActive,
    settings: {
      allowedVideoProviders: this.settings?.allowedVideoProviders || ['youtube', 'vimeo', 'cloudinary'],
      defaultCurrency: this.settings?.defaultCurrency || 'INR',
    },
    createdBy: this.createdBy ? this.createdBy.toString() : null,
    createdAt: this.createdAt,
    updatedAt: this.updatedAt,
  };
};

export const Firm = mongoose.model('Firm', firmSchema);
export default Firm;
