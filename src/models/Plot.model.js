/**
 * src/models/Plot.model.js
 *
 * Real estate plot listing model.
 *
 * Multi-Tenant Invariants:
 *  - firmId is required on every document and indexed.
 *  - plotRef is unique within each firm ({ firmId: 1, plotRef: 1 } unique index).
 *  - Different firms may use the same plotRef / plotId without collision.
 *  - colonyId must reference an existing colony belonging to the exact same firm.
 *  - Video links are restricted to verified providers.
 *  - Never stores or joins private owner/source data (deferred to PlotPrivate in Phase 5).
 */

import mongoose from 'mongoose';

export const PLOT_SIZE_UNITS = ['sqft', 'sqyd', 'sqm', 'marla', 'kanal', 'acre', 'gaj'];
export const PLOT_RATE_TYPES = ['total', 'per_unit'];
export const PLOT_STATUSES = ['available', 'sold', 'reserved', 'on_hold'];

const plotSchema = new mongoose.Schema(
  {
    firmId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Firm',
      required: [true, 'Owning firmId is required'],
      index: true,
    },

    plotRef: {
      type: String,
      required: [true, 'Plot identifier or reference number is required'],
      trim: true,
      maxlength: [60, 'Plot reference cannot exceed 60 characters'],
    },

    colonyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Colony',
      default: null,
      index: true,
    },

    plotDate: {
      type: Date,
      default: null,
    },

    size: {
      type: Number,
      required: [true, 'Plot size is required'],
      min: [0.0001, 'Plot size must be a positive number'],
    },

    sizeUnit: {
      type: String,
      required: [true, 'Size unit is required'],
      enum: {
        values: PLOT_SIZE_UNITS,
        message: 'Invalid size unit: {VALUE}',
      },
    },

    dimensions: {
      type: String,
      trim: true,
      maxlength: [100, 'Dimensions cannot exceed 100 characters'],
      default: null,
    },

    rate: {
      type: mongoose.Schema.Types.Mixed,
      required: [true, 'Rate is required'],
      default: 0,
    },

    rateType: {
      type: String,
      enum: {
        values: PLOT_RATE_TYPES,
        message: 'Invalid rate type: {VALUE}',
      },
      default: 'total',
    },

    currency: {
      type: String,
      trim: true,
      default: 'INR',
    },

    description: {
      type: String,
      trim: true,
      maxlength: [2000, 'Description cannot exceed 2000 characters'],
      default: null,
    },

    status: {
      type: String,
      enum: {
        values: PLOT_STATUSES,
        message: 'Invalid plot status: {VALUE}',
      },
      default: 'available',
      index: true,
    },

    images: [
      {
        url: {
          type: String,
          required: true,
          trim: true,
        },
        publicId: {
          type: String,
          trim: true,
          default: null,
        },
        caption: {
          type: String,
          trim: true,
          default: null,
        },
        order: {
          type: Number,
          default: 0,
        },
      },
    ],

    videoUrl: {
      type: String,
      trim: true,
      default: null,
    },

    videoProvider: {
      type: String,
      enum: ['youtube', 'vimeo', 'cloudinary', null],
      default: null,
    },

    video: {
      url: {
        type: String,
        trim: true,
        default: null,
      },
      provider: {
        type: String,
        enum: ['youtube', 'vimeo', 'cloudinary', null],
        default: null,
      },
      publicId: {
        type: String,
        trim: true,
        default: null,
      },
    },

    category: {
      type: String,
      enum: ['plot', 'rental', 'agricultural', 'house'],
      default: 'plot',
      index: true,
    },

    // --- Specialized Rental Properties fields ---
    rentalType: {
      type: String,
      trim: true,
      default: null,
    },

    furnishing: {
      type: String,
      enum: ['unfurnished', 'semi_furnished', 'fully_furnished', null],
      default: null,
    },

    securityDeposit: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },

    availableFrom: {
      type: Date,
      default: null,
    },

    preferredTenant: {
      type: String,
      trim: true,
      maxlength: [200, 'Preferred tenant cannot exceed 200 characters'],
      default: null,
    },

    // --- Specialized Agricultural Land fields ---
    listingType: {
      type: String,
      enum: ['sale', 'rent', 'lease'],
      default: 'sale',
      index: true,
    },

    waterSource: {
      type: String,
      trim: true,
      maxlength: [200, 'Water source cannot exceed 200 characters'],
      default: null,
    },

    roadAccess: {
      type: String,
      trim: true,
      maxlength: [200, 'Road access cannot exceed 200 characters'],
      default: null,
    },

    electricity: {
      type: String,
      trim: true,
      maxlength: [200, 'Electricity details cannot exceed 200 characters'],
      default: null,
    },

    fencing: {
      type: String,
      trim: true,
      maxlength: [200, 'Fencing details cannot exceed 200 characters'],
      default: null,
    },

    soilType: {
      type: String,
      trim: true,
      maxlength: [200, 'Soil type cannot exceed 200 characters'],
      default: null,
    },

    // --- Specialized House & Flat Properties fields ---
    houseType: {
      type: String,
      trim: true,
      default: null,
    },

    bhk: {
      type: String,
      trim: true,
      default: null,
    },

    societyName: {
      type: String,
      trim: true,
      maxlength: [200, 'Society name cannot exceed 200 characters'],
      default: null,
    },

    floorNo: {
      type: String,
      trim: true,
      default: null,
    },

    totalFloors: {
      type: Number,
      default: null,
    },

    bathrooms: {
      type: Number,
      default: null,
    },

    balconies: {
      type: Number,
      default: null,
    },

    builtUpArea: {
      type: Number,
      default: null,
    },

    plotArea: {
      type: Number,
      default: null,
    },

    parking: {
      type: String,
      trim: true,
      default: null,
    },

    lift: {
      type: Boolean,
      default: null,
    },

    constructionStatus: {
      type: String,
      trim: true,
      default: null,
    },

    facing: {
      type: String,
      trim: true,
      default: null,
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
        ret.plotId = ret.plotRef;
        ret.images = ret.images || [];
        ret.videoUrl = ret.videoUrl || ret.video?.url || null;
        ret.videoProvider = ret.videoProvider || ret.video?.provider || null;
        delete ret._id;
        delete ret.__v;
        return ret;
      },
    },
    toObject: {
      transform(_doc, ret) {
        ret.id = ret._id.toString();
        ret.plotId = ret.plotRef;
        ret.images = ret.images || [];
        ret.videoUrl = ret.videoUrl || ret.video?.url || null;
        ret.videoProvider = ret.videoProvider || ret.video?.provider || null;
        delete ret._id;
        delete ret.__v;
        return ret;
      },
    },
  }
);

// Pre-save hook to ensure videoUrl/videoProvider and video object stay synchronized
plotSchema.pre('save', function (next) {
  if (this.videoUrl && !this.video?.url) {
    if (!this.video) this.video = {};
    this.video.url = this.videoUrl;
    this.video.provider = this.videoProvider || null;
  } else if (this.video?.url && !this.videoUrl) {
    this.videoUrl = this.video.url;
    this.videoProvider = this.video.provider || null;
  }
  next();
});

// Compound indexes
plotSchema.index({ firmId: 1, plotRef: 1 }, { unique: true });
plotSchema.index({ firmId: 1, colonyId: 1 });
plotSchema.index({ firmId: 1, status: 1 });
plotSchema.index({ firmId: 1, isActive: 1, createdAt: -1 });
plotSchema.index({ firmId: 1, createdBy: 1 });
plotSchema.index({ firmId: 1, category: 1, createdAt: -1 });
plotSchema.index({ firmId: 1, category: 1, createdBy: 1 });

/**
 * Returns safe serializable plot details with public listing fields only.
 *
 * @returns {object}
 */
plotSchema.methods.toSafeObject = function () {
  const effectiveUrl = this.videoUrl || this.video?.url || null;
  const effectiveProvider = this.videoProvider || this.video?.provider || null;

  let creator = null;
  if (this.createdBy && typeof this.createdBy === 'object' && this.createdBy.email) {
    const name = [this.createdBy.firstName, this.createdBy.lastName].filter(Boolean).join(' ') || this.createdBy.email;
    creator = {
      id: this.createdBy._id ? this.createdBy._id.toString() : String(this.createdBy.id || ''),
      name,
      email: this.createdBy.email,
      role: this.createdBy.role || 'FIRM_STAFF',
    };
  }

  let createdById = null;
  if (this.createdBy) {
    createdById = this.createdBy._id ? this.createdBy._id.toString() : this.createdBy.toString();
  }

  let updatedById = null;
  if (this.updatedBy) {
    updatedById = this.updatedBy._id ? this.updatedBy._id.toString() : this.updatedBy.toString();
  }

  return {
    id: this._id.toString(),
    plotId: this.plotRef,
    plotRef: this.plotRef,
    firmId: this.firmId.toString(),
    colonyId: this.colonyId ? this.colonyId.toString() : null,
    plotDate: this.plotDate || null,
    category: this.category || 'plot',
    rentalType: this.rentalType || null,
    furnishing: this.furnishing || null,
    securityDeposit: this.securityDeposit ?? null,
    availableFrom: this.availableFrom || null,
    preferredTenant: this.preferredTenant || null,
    listingType: this.listingType || 'sale',
    waterSource: this.waterSource || null,
    roadAccess: this.roadAccess || null,
    electricity: this.electricity || null,
    fencing: this.fencing || null,
    soilType: this.soilType || null,
    houseType: this.houseType || null,
    bhk: this.bhk || null,
    societyName: this.societyName || null,
    floorNo: this.floorNo || null,
    totalFloors: this.totalFloors ?? null,
    bathrooms: this.bathrooms ?? null,
    balconies: this.balconies ?? null,
    builtUpArea: this.builtUpArea ?? null,
    plotArea: this.plotArea ?? null,
    parking: this.parking || null,
    lift: this.lift ?? null,
    constructionStatus: this.constructionStatus || null,
    facing: this.facing || null,
    size: this.size,
    sizeUnit: this.sizeUnit,
    dimensions: this.dimensions || null,
    rate: this.rate,
    rateType: this.rateType,
    totalPrice: this.totalPrice ?? (
      this.rateType === 'per_unit' && !isNaN(Number(this.rate)) && !isNaN(Number(this.size))
        ? Number(this.rate) * Number(this.size)
        : (!isNaN(Number(this.rate)) ? Number(this.rate) : null)
    ),
    currency: this.currency || 'INR',
    description: this.description || null,
    status: this.status,
    images: this.images || [],
    videoUrl: effectiveUrl,
    videoProvider: effectiveProvider,
    video: effectiveUrl
      ? {
          url: effectiveUrl,
          provider: effectiveProvider,
          publicId: this.video?.publicId || null,
        }
      : null,
    isActive: this.isActive,
    createdBy: createdById,
    creator,
    updatedBy: updatedById,
    createdAt: this.createdAt,
    updatedAt: this.updatedAt,
  };
};

export const Plot = mongoose.model('Plot', plotSchema);
export default Plot;
