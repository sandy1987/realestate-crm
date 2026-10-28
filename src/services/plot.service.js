/**
 * src/services/plot.service.js
 *
 * Plot listing and management service.
 * Enforces firm scoping, colony ownership verification,
 * video URL / provider validation against firm settings,
 * whitelisted sorting, and pagination boundaries.
 */

import { Plot } from '../models/Plot.model.js';
import { Colony } from '../models/Colony.model.js';
import { Firm } from '../models/Firm.model.js';
import { isValidObjectId } from '../utils/objectId.js';
import { parsePagination, buildPaginationMeta } from '../utils/paginate.js';
import { validateVideoUrl } from '../utils/video.js';
import { recordAuditEvent } from './audit.service.js';
import { AUDIT_EVENTS } from '../constants/auditEvents.js';

function escapeRegex(str) {
  return typeof str === 'string' ? str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') : '';
}

/**
 * Creates a new plot within the authenticated firm.
 */
export async function createPlot({ firmId, data, userId, firmSettings }) {
  const plotRef = (data.plotRef || data.plotId || '').trim();

  if (!plotRef) {
    const error = new Error('Plot reference or identifier is required');
    error.statusCode = 400;
    error.code = 'VALIDATION_ERROR';
    throw error;
  }

  // Enforce firm-scoped uniqueness of plotRef
  const existing = await Plot.findOne({ firmId, plotRef });
  if (existing) {
    const error = new Error(`Plot with reference '${plotRef}' already exists in your firm`);
    error.statusCode = 409;
    error.code = 'PLOT_REF_CONFLICT';
    throw error;
  }

  // If colonyId is specified, verify it belongs to this exact firm and is active
  if (data.colonyId) {
    if (!isValidObjectId(data.colonyId)) {
      const error = new Error('Invalid colonyId format');
      error.statusCode = 400;
      error.code = 'INVALID_COLONY';
      throw error;
    }

    const colony = await Colony.findOne({
      _id: data.colonyId,
      firmId,
      isActive: true,
    });

    if (!colony) {
      const error = new Error('Colony does not exist or does not belong to your firm');
      error.statusCode = 400;
      error.code = 'INVALID_COLONY';
      throw error;
    }
  }

  // Handle video URL and provider validation if provided
  let videoData = null;
  const rawUrl = data.videoUrl || data.video?.url;
  const rawProvider = data.videoProvider || data.video?.provider || null;

  if (rawUrl) {
    const rawAllowed = firmSettings?.allowedVideoProviders || ['youtube', 'vimeo'];
    const allowed = Array.from(new Set([...rawAllowed, 'cloudinary']));
    const videoCheck = validateVideoUrl(rawUrl, rawProvider, allowed);

    if (!videoCheck.valid) {
      const error = new Error(videoCheck.error || 'Invalid video URL or provider');
      error.statusCode = 400;
      error.code = 'INVALID_VIDEO_URL';
      throw error;
    }

    videoData = {
      url: rawUrl.trim(),
      provider: videoCheck.provider,
      publicId: data.video?.publicId || null,
    };
  }

  // Format images array
  const images = Array.isArray(data.images)
    ? data.images.map((img, idx) => {
        if (typeof img === 'string') {
          return { url: img, publicId: null, caption: null, order: idx };
        }
        return {
          url: img.url,
          publicId: img.publicId || null,
          caption: img.caption || null,
          order: img.order !== undefined ? img.order : idx,
        };
      })
    : [];

  const plot = new Plot({
    firmId,
    plotRef,
    colonyId: data.colonyId || null,
    plotDate: data.plotDate ? new Date(data.plotDate) : null,
    size: data.size,
    sizeUnit: data.sizeUnit,
    rate: data.rate,
    rateType: data.rateType || 'total',
    currency: data.currency || firmSettings?.defaultCurrency || 'INR',
    description: data.description ?? null,
    status: data.status || 'available',
    images,
    videoUrl: videoData?.url || null,
    videoProvider: videoData?.provider || null,
    video: videoData || { url: null, provider: null, publicId: null },
    isActive: data.isActive !== undefined ? data.isActive : true,
    createdBy: userId,
    updatedBy: userId,
  });

  await plot.save();

  await recordAuditEvent({
    eventType: AUDIT_EVENTS.PLOT_CREATED,
    actorUserId: userId,
    firmId,
    resourceType: 'plot',
    resourceId: plot._id.toString(),
    action: 'create',
    metadata: { plotRef: plot.plotRef, colonyId: plot.colonyId ? plot.colonyId.toString() : null },
  });

  return plot.toSafeObject();
}

/**
 * Lists plots within the authenticated firm with whitelisted sorting, pagination, and multi-field filters.
 */
export async function listPlots({ firmId, query = {} }) {
  const allowedSortFields = [
    'createdAt',
    'plotDate',
    'rate',
    'size',
    'plotRef',
    'status',
    'updatedAt',
  ];

  const { page, limit, skip, sortBy, sortOrder } = parsePagination(query, allowedSortFields);

  const filter = { firmId };

  // Text search
  if (query.search) {
    const searchRegex = new RegExp(escapeRegex(query.search), 'i');
    filter.$or = [
      { plotRef: searchRegex },
      { description: searchRegex },
    ];
  }

  // Exact or partial plotRef filter
  if (query.plotRef || query.plotId) {
    const ref = (query.plotRef || query.plotId).trim();
    filter.plotRef = new RegExp(`^${escapeRegex(ref)}$`, 'i');
  }

  // Colony filter
  if (query.colonyId) {
    if (isValidObjectId(query.colonyId)) {
      filter.colonyId = query.colonyId;
    }
  }

  // Status filter
  if (query.status) {
    filter.status = query.status;
  }

  // Active status filter
  if (query.isActive !== undefined) {
    filter.isActive = query.isActive === 'true' || query.isActive === true;
  }

  // Rate type filter
  if (query.rateType) {
    filter.rateType = query.rateType;
  }

  // Size numeric range
  if (query.sizeMin !== undefined || query.sizeMax !== undefined) {
    filter.size = {};
    if (query.sizeMin !== undefined && !isNaN(Number(query.sizeMin))) {
      filter.size.$gte = Number(query.sizeMin);
    }
    if (query.sizeMax !== undefined && !isNaN(Number(query.sizeMax))) {
      filter.size.$lte = Number(query.sizeMax);
    }
  }

  // Rate numeric range
  if (query.rateMin !== undefined || query.rateMax !== undefined) {
    filter.rate = {};
    if (query.rateMin !== undefined && !isNaN(Number(query.rateMin))) {
      filter.rate.$gte = Number(query.rateMin);
    }
    if (query.rateMax !== undefined && !isNaN(Number(query.rateMax))) {
      filter.rate.$lte = Number(query.rateMax);
    }
  }

  // Date range filter
  if (query.plotDateFrom || query.plotDateTo) {
    filter.plotDate = {};
    if (query.plotDateFrom) {
      const fromDate = new Date(query.plotDateFrom);
      if (!isNaN(fromDate.getTime())) {
        filter.plotDate.$gte = fromDate;
      }
    }
    if (query.plotDateTo) {
      const toDate = new Date(query.plotDateTo);
      if (!isNaN(toDate.getTime())) {
        filter.plotDate.$lte = toDate;
      }
    }
  }

  const [total, items] = await Promise.all([
    Plot.countDocuments(filter),
    Plot.find(filter)
      .sort({ [sortBy]: sortOrder === 'asc' ? 1 : -1 })
      .skip(skip)
      .limit(limit),
  ]);

  return {
    items: items.map((plot) => plot.toSafeObject()),
    meta: buildPaginationMeta(total, page, limit),
  };
}

/**
 * Retrieves a single plot by database resource ID, strictly scoped to the authenticated firm.
 */
export async function getPlotById({ plotId, firmId }) {
  if (!isValidObjectId(plotId)) {
    const error = new Error('Plot not found');
    error.statusCode = 404;
    error.code = 'PLOT_NOT_FOUND';
    throw error;
  }

  const plot = await Plot.findOne({ _id: plotId, firmId });
  if (!plot) {
    const error = new Error('Plot not found');
    error.statusCode = 404;
    error.code = 'PLOT_NOT_FOUND';
    throw error;
  }

  return plot.toSafeObject();
}

/**
 * Updates an existing plot within the authenticated firm.
 */
export async function updatePlot({ plotId, firmId, data, userId, firmSettings }) {
  if (!isValidObjectId(plotId)) {
    const error = new Error('Plot not found');
    error.statusCode = 404;
    error.code = 'PLOT_NOT_FOUND';
    throw error;
  }

  const plot = await Plot.findOne({ _id: plotId, firmId });
  if (!plot) {
    const error = new Error('Plot not found');
    error.statusCode = 404;
    error.code = 'PLOT_NOT_FOUND';
    throw error;
  }

  // If updating plotRef or plotId, ensure uniqueness within this firm
  const targetRef = (data.plotRef || data.plotId || '').trim();
  if (targetRef && targetRef !== plot.plotRef) {
    const existing = await Plot.findOne({
      firmId,
      plotRef: targetRef,
      _id: { $ne: plotId },
    });

    if (existing) {
      const error = new Error(`Plot with reference '${targetRef}' already exists in your firm`);
      error.statusCode = 409;
      error.code = 'PLOT_REF_CONFLICT';
      throw error;
    }
    plot.plotRef = targetRef;
  }

  // If colonyId is being updated, verify it belongs to this firm
  if (data.colonyId !== undefined) {
    if (data.colonyId === null) {
      plot.colonyId = null;
    } else {
      if (!isValidObjectId(data.colonyId)) {
        const error = new Error('Invalid colonyId format');
        error.statusCode = 400;
        error.code = 'INVALID_COLONY';
        throw error;
      }

      const colony = await Colony.findOne({
        _id: data.colonyId,
        firmId,
        isActive: true,
      });

      if (!colony) {
        const error = new Error('Colony does not exist or does not belong to your firm');
        error.statusCode = 400;
        error.code = 'INVALID_COLONY';
        throw error;
      }
      plot.colonyId = data.colonyId;
    }
  }

  // If video is being updated
  const newUrl = data.videoUrl !== undefined ? data.videoUrl : data.video?.url;
  const newProvider = data.videoProvider !== undefined ? data.videoProvider : data.video?.provider;

  if (newUrl !== undefined) {
    if (newUrl) {
      const rawAllowed = firmSettings?.allowedVideoProviders || ['youtube', 'vimeo'];
      const allowed = Array.from(new Set([...rawAllowed, 'cloudinary']));
      const videoCheck = validateVideoUrl(newUrl, newProvider, allowed);

      if (!videoCheck.valid) {
        const error = new Error(videoCheck.error || 'Invalid video URL or provider');
        error.statusCode = 400;
        error.code = 'INVALID_VIDEO_URL';
        throw error;
      }

      plot.videoUrl = newUrl.trim();
      plot.videoProvider = videoCheck.provider;
      plot.video = {
        url: newUrl.trim(),
        provider: videoCheck.provider,
        publicId: data.video?.publicId || plot.video?.publicId || null,
      };
    } else {
      plot.videoUrl = null;
      plot.videoProvider = null;
      plot.video = { url: null, provider: null, publicId: null };
    }
  }

  if (data.images !== undefined) {
    plot.images = Array.isArray(data.images)
      ? data.images.map((img, idx) => {
          if (typeof img === 'string') {
            return { url: img, publicId: null, caption: null, order: idx };
          }
          return {
            url: img.url,
            publicId: img.publicId || null,
            caption: img.caption || null,
            order: img.order !== undefined ? img.order : idx,
          };
        })
      : [];
  }

  if (data.plotDate !== undefined) {
    plot.plotDate = data.plotDate ? new Date(data.plotDate) : null;
  }
  if (data.size !== undefined) plot.size = data.size;
  if (data.sizeUnit !== undefined) plot.sizeUnit = data.sizeUnit;
  if (data.rate !== undefined) plot.rate = data.rate;
  if (data.rateType !== undefined) plot.rateType = data.rateType;
  if (data.currency !== undefined) plot.currency = data.currency;
  if (data.description !== undefined) plot.description = data.description;
  if (data.status !== undefined) plot.status = data.status;
  if (data.isActive !== undefined) plot.isActive = data.isActive;

  plot.updatedBy = userId;
  await plot.save();

  await recordAuditEvent({
    eventType: AUDIT_EVENTS.PLOT_UPDATED,
    actorUserId: userId,
    firmId,
    resourceType: 'plot',
    resourceId: plot._id.toString(),
    action: 'update',
    metadata: { plotRef: plot.plotRef },
  });

  return plot.toSafeObject();
}

/**
 * Deactivates a plot (soft deletion).
 */
export async function deactivatePlot({ plotId, firmId, userId }) {
  if (!isValidObjectId(plotId)) {
    const error = new Error('Plot not found');
    error.statusCode = 404;
    error.code = 'PLOT_NOT_FOUND';
    throw error;
  }

  const plot = await Plot.findOne({ _id: plotId, firmId });
  if (!plot) {
    const error = new Error('Plot not found');
    error.statusCode = 404;
    error.code = 'PLOT_NOT_FOUND';
    throw error;
  }

  plot.isActive = false;
  plot.updatedBy = userId;
  await plot.save();

  await recordAuditEvent({
    eventType: AUDIT_EVENTS.PLOT_DELETED,
    actorUserId: userId,
    firmId,
    resourceType: 'plot',
    resourceId: plot._id.toString(),
    action: 'deactivate',
    metadata: { plotRef: plot.plotRef },
  });

  return plot.toSafeObject();
}

/**
 * Generates formatted marketing details and shareable WhatsApp URLs for a plot.
 * Strictly guarantees that private owner/source details are NEVER included.
 *
 * @param {object} params
 * @param {string} params.plotId - Database resource ID of the plot
 * @param {string|mongoose.Types.ObjectId} params.firmId - Authenticated firm tenant ID
 * @param {string|mongoose.Types.ObjectId} [params.userId] - Optional authenticated user ID for audit logging
 */
export async function getPlotWhatsAppShare({ plotId, firmId, userId }) {
  if (!isValidObjectId(plotId)) {
    const error = new Error('Plot not found');
    error.statusCode = 404;
    error.code = 'PLOT_NOT_FOUND';
    throw error;
  }

  const plot = await Plot.findOne({ _id: plotId, firmId });
  if (!plot) {
    const error = new Error('Plot not found');
    error.statusCode = 404;
    error.code = 'PLOT_NOT_FOUND';
    throw error;
  }

  // Fetch optional colony and firm in parallel for complete public marketing presentation
  const [colony, firm] = await Promise.all([
    plot.colonyId ? Colony.findOne({ _id: plot.colonyId, firmId }) : null,
    Firm.findById(firmId),
  ]);

  const colonyName = colony
    ? `${colony.name}${colony.city ? `, ${colony.city}` : colony.location ? `, ${colony.location}` : ''}`
    : 'Direct / Independent';

  const sizeStr = `${plot.size} ${(plot.sizeUnit || 'sqft').toUpperCase()}`;

  let rateStr = 'Contact for Price';
  if (plot.rate) {
    const currency = plot.currency || 'INR';
    const formattedRate = Number(plot.rate).toLocaleString('en-IN');
    rateStr = plot.rateType === 'per_unit'
      ? `${currency} ${formattedRate} / ${plot.sizeUnit || 'sqft'}`
      : `${currency} ${formattedRate} (Total)`;
  }

  const statusStr = (plot.status || 'available').toUpperCase();
  const videoUrl = plot.videoUrl || plot.video?.url;

  // Build clean, professional WhatsApp formatted message
  const lines = [
    '🏡 *PLOT SPECIFICATION & DETAILS* 🏡',
    '━━━━━━━━━━━━━━━━━━━━━━━━━',
    `📍 *Location / Colony:* ${colonyName}`,
    `🏷️ *Plot Reference:* ${plot.plotRef}`,
    `📐 *Area / Size:* ${sizeStr}`,
    `💰 *Price / Rate:* ${rateStr}`,
    `⚡ *Status:* ${statusStr}`,
  ];

  if (plot.description && plot.description.trim()) {
    lines.push(`📝 *Description:* ${plot.description.trim()}`);
  }

  if (videoUrl) {
    lines.push(`🎥 *Video Walkthrough:* ${videoUrl.trim()}`);
  }

  lines.push('━━━━━━━━━━━━━━━━━━━━━━━━━');

  if (firm) {
    lines.push(`🏢 *Offered By:* ${firm.name}`);
    if (firm.contactPhone) {
      lines.push(`📞 *Call / WhatsApp:* ${firm.contactPhone}`);
    } else if (firm.contactEmail) {
      lines.push(`✉️ *Email:* ${firm.contactEmail}`);
    }
  }

  const messageText = lines.join('\n');
  const encodedText = encodeURIComponent(messageText);

  // WhatsApp Web & universal API links (without hardcoded phone so user can choose any contact)
  const whatsappWebUrl = `https://web.whatsapp.com/send?text=${encodedText}`;
  const whatsappApiUrl = `https://api.whatsapp.com/send?text=${encodedText}`;

  // Emit audit log if userId is present
  if (userId) {
    try {
      await recordAuditEvent({
        eventType: AUDIT_EVENTS.PLOT_SHARED_WHATSAPP,
        actorUserId: userId,
        firmId,
        resourceType: 'plot',
        resourceId: plot._id.toString(),
        action: 'share_whatsapp',
        metadata: {
          plotRef: plot.plotRef,
          channel: 'whatsapp',
        },
      });
    } catch {
      // Non-blocking
    }
  }

  return {
    plotId: plot._id.toString(),
    plotRef: plot.plotRef,
    messageText,
    whatsappWebUrl,
    whatsappApiUrl,
  };
}

export default {
  createPlot,
  listPlots,
  getPlotById,
  updatePlot,
  deactivatePlot,
  getPlotWhatsAppShare,
};
