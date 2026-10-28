/**
 * src/config/cloudinary.js
 *
 * Cloudinary configuration and helper utilities for media uploads and deletions.
 */

import { v2 as cloudinary } from 'cloudinary';
import { config } from './env.js';
import { logger } from './logger.js';

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
 * Upload a file buffer to Cloudinary using a stream.
 *
 * @param {Buffer} buffer - File buffer from multer
 * @param {object} options - Cloudinary upload options (folder, resource_type, etc.)
 * @returns {Promise<object>} - Cloudinary upload result
 */
export function uploadBufferToCloudinary(buffer, options = {}) {
  const cld = initCloudinary();

  return new Promise((resolve, reject) => {
    const uploadStream = cld.uploader.upload_stream(
      {
        resource_type: options.resource_type || 'auto',
        folder: options.folder || 'agent-broker/media',
        ...options,
      },
      (error, result) => {
        if (error) {
          logger.error({ error }, 'Cloudinary upload stream error');
          return reject(error);
        }
        resolve(result);
      }
    );

    uploadStream.end(buffer);
  });
}

/**
 * Delete a media asset from Cloudinary by public ID.
 *
 * @param {string} publicId - Cloudinary public ID
 * @param {object} options - Optional parameters (e.g. resource_type: 'video' | 'image')
 * @returns {Promise<object>}
 */
export function deleteFromCloudinary(publicId, options = {}) {
  const cld = initCloudinary();
  return cld.uploader.destroy(publicId, {
    resource_type: options.resource_type || 'image',
    invalidate: true,
    ...options,
  });
}

export { cloudinary, isConfigured };
export default cloudinary;
