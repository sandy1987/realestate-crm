/**
 * src/config/cloudinary.js
 *
 * Cloudinary configuration and helper utilities for media uploads and deletions.
 */

import { v2 as cloudinary } from 'cloudinary';
import { config } from './env.js';
import { logger } from './logger.js';
import { Firm } from '../models/Firm.model.js';
import { isValidObjectId } from '../utils/objectId.js';

let isConfigured = false;

function initCloudinary() {
  if (isConfigured) return cloudinary;

  let cloudName = config.CLOUDINARY_CLOUD_NAME;
  let apiKey = config.CLOUDINARY_API_KEY;
  let apiSecret = config.CLOUDINARY_API_SECRET;

  // Handle accidental full cloudinary:// URL inside CLOUDINARY_CLOUD_NAME
  if (cloudName && cloudName.includes('cloudinary://')) {
    try {
      const parsed = new URL(cloudName);
      cloudName = parsed.hostname;
      if (!apiKey && parsed.username) apiKey = parsed.username;
      if (!apiSecret && parsed.password) apiSecret = parsed.password;
    } catch {
      // fallback if standard URL parsing fails
      const atSplit = cloudName.split('@');
      if (atSplit.length > 1) {
        cloudName = atSplit[1].replace('/', '');
      }
    }
  }

  if (cloudName && apiKey && apiSecret) {
    cloudinary.config({
      cloud_name: cloudName,
      api_key: apiKey,
      api_secret: apiSecret,
      secure: true,
    });
    isConfigured = true;
    logger.info({ cloudName }, 'Cloudinary initialized successfully');
  } else if (config.CLOUDINARY_URL) {
    cloudinary.config({
      cloudinary_url: config.CLOUDINARY_URL,
      secure: true,
    });
    isConfigured = true;
    logger.info('Cloudinary initialized via CLOUDINARY_URL');
  } else {
    logger.warn('Cloudinary credentials not fully configured; upload endpoints will be disabled.');
  }

  return cloudinary;
}

initCloudinary();

/**
 * Resolves Cloudinary credentials for a specific tenant firm.
 * Falls back to default platform .env credentials if unconfigured.
 *
 * @param {string|mongoose.Types.ObjectId} firmId
 * @returns {Promise<{ cloudName: string, apiKey: string, apiSecret: string, isCustom: boolean }>}
 */
export async function resolveFirmCloudinary(firmId) {
  if (firmId && isValidObjectId(firmId)) {
    try {
      const firm = await Firm.findById(firmId).select('+cloudinary.apiSecret');
      if (
        firm &&
        firm.cloudinary?.isConfigured &&
        firm.cloudinary.cloudName &&
        firm.cloudinary.apiKey &&
        firm.cloudinary.apiSecret
      ) {
        return {
          cloudName: firm.cloudinary.cloudName,
          apiKey: firm.cloudinary.apiKey,
          apiSecret: firm.cloudinary.apiSecret,
          isCustom: true,
        };
      }
    } catch (err) {
      logger.error({ err, firmId }, 'Error resolving firm Cloudinary credentials, falling back to default');
    }
  }

  return {
    cloudName: config.CLOUDINARY_CLOUD_NAME || null,
    apiKey: config.CLOUDINARY_API_KEY || null,
    apiSecret: config.CLOUDINARY_API_SECRET || null,
    isCustom: false,
  };
}

/**
 * Tests connection to a Cloudinary account using provided credentials.
 *
 * @param {object} params
 * @param {string} params.cloudName
 * @param {string} params.apiKey
 * @param {string} params.apiSecret
 * @returns {Promise<{ success: boolean, status?: string, error?: string }>}
 */
export async function testCloudinaryCredentials({ cloudName, apiKey, apiSecret }) {
  if (!cloudName || !apiKey || !apiSecret) {
    return { success: false, error: 'cloudName, apiKey, and apiSecret are all required' };
  }

  try {
    const pingRes = await cloudinary.api.ping({
      cloud_name: cloudName,
      api_key: apiKey,
      api_secret: apiSecret,
    });
    return {
      success: pingRes?.status === 'ok',
      status: pingRes?.status || 'ok',
    };
  } catch (err) {
    logger.warn({ err: err.message, cloudName }, 'Cloudinary test connection failed');
    return {
      success: false,
      error: err.error?.message || err.message || 'Failed to authenticate with Cloudinary',
    };
  }
}

/**
 * Upload a file buffer to Cloudinary using a stream.
 * Supports per-tenant credentials.
 *
 * @param {Buffer} buffer - File buffer from multer
 * @param {object} options - Cloudinary upload options (folder, resource_type, etc.)
 * @param {object|null} credentials - Optional dedicated tenant credentials
 * @returns {Promise<object>} - Cloudinary upload result
 */
export function uploadBufferToCloudinary(buffer, options = {}, credentials = null) {
  const cld = initCloudinary();

  const streamOptions = {
    resource_type: options.resource_type || 'auto',
    folder: options.folder || 'agent-broker/media',
    ...options,
  };

  if (credentials && credentials.cloudName && credentials.apiKey && credentials.apiSecret) {
    streamOptions.cloud_name = credentials.cloudName;
    streamOptions.api_key = credentials.apiKey;
    streamOptions.api_secret = credentials.apiSecret;
  }

  return new Promise((resolve, reject) => {
    const uploadStream = cld.uploader.upload_stream(streamOptions, (error, result) => {
      if (error) {
        logger.error({ error }, 'Cloudinary upload stream error');
        return reject(error);
      }
      resolve(result);
    });

    uploadStream.end(buffer);
  });
}

/**
 * Delete a media asset from Cloudinary by public ID.
 * Supports per-tenant credentials.
 *
 * @param {string} publicId - Cloudinary public ID
 * @param {object} options - Optional parameters (e.g. resource_type: 'video' | 'image')
 * @param {object|null} credentials - Optional dedicated tenant credentials
 * @returns {Promise<object>}
 */
export function deleteFromCloudinary(publicId, options = {}, credentials = null) {
  const cld = initCloudinary();

  const destroyOptions = {
    resource_type: options.resource_type || 'image',
    invalidate: true,
    ...options,
  };

  if (credentials && credentials.cloudName && credentials.apiKey && credentials.apiSecret) {
    destroyOptions.cloud_name = credentials.cloudName;
    destroyOptions.api_key = credentials.apiKey;
    destroyOptions.api_secret = credentials.apiSecret;
  }

  return cld.uploader.destroy(publicId, destroyOptions);
}

export { cloudinary, isConfigured };
export default cloudinary;
