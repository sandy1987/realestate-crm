/**
 * src/controllers/media.controller.js
 *
 * Handles media uploads (images and videos) and deletions via Cloudinary.
 * Enforces firm scoping, MIME validation, and file size limits.
 */

import { asyncHandler } from '../utils/asyncHandler.js';
import { sendSuccess, sendError } from '../utils/apiResponse.js';
import { uploadBufferToCloudinary, deleteFromCloudinary } from '../config/cloudinary.js';

const ALLOWED_IMAGE_MIMES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'image/avif',
  'image/svg+xml',
]);

const ALLOWED_VIDEO_MIMES = new Set([
  'video/mp4',
  'video/quicktime',
  'video/webm',
  'video/x-msvideo',
  'video/mpeg',
]);

const MAX_IMAGE_SIZE = 10 * 1024 * 1024; // 10 MB
const MAX_VIDEO_SIZE = 100 * 1024 * 1024; // 100 MB

/**
 * Upload single or multiple files to Cloudinary.
 * POST /api/v1/media/upload
 */
export const uploadMedia = asyncHandler(async (req, res) => {
  const firmId = req.tenant.firmId.toString();
  const rawFiles = req.files || (req.file ? [req.file] : []);

  if (!rawFiles || rawFiles.length === 0) {
    return sendError(res, {
      statusCode: 400,
      code: 'NO_FILE_PROVIDED',
      message: 'No file uploaded. Please attach file with field name "file" or "files"',
    });
  }

  const results = [];

  for (const file of rawFiles) {
    const mime = file.mimetype.toLowerCase();
    let resourceType = 'auto';

    if (ALLOWED_IMAGE_MIMES.has(mime)) {
      resourceType = 'image';
      if (file.size > MAX_IMAGE_SIZE) {
        return sendError(res, {
          statusCode: 400,
          code: 'FILE_TOO_LARGE',
          message: `Image '${file.originalname}' exceeds 10MB limit`,
        });
      }
    } else if (ALLOWED_VIDEO_MIMES.has(mime)) {
      resourceType = 'video';
      if (file.size > MAX_VIDEO_SIZE) {
        return sendError(res, {
          statusCode: 400,
          code: 'FILE_TOO_LARGE',
          message: `Video '${file.originalname}' exceeds 100MB limit`,
        });
      }
    } else {
      return sendError(res, {
        statusCode: 400,
        code: 'INVALID_FILE_TYPE',
        message: `File '${file.originalname}' has unsupported type '${mime}'. Allowed: JPG, PNG, WEBP, SVG, MP4, MOV, WEBM`,
      });
    }

    const folderType = req.body?.folderType || 'plots';
    const folder =
      folderType === 'colony'
        ? `agent-broker/${firmId}/colonies/maps`
        : `agent-broker/${firmId}/plots/${resourceType === 'video' ? 'videos' : 'images'}`;

    const uploadRes = await uploadBufferToCloudinary(file.buffer, {
      resource_type: resourceType,
      folder,
    });

    results.push({
      url: uploadRes.secure_url || uploadRes.url,
      secure_url: uploadRes.secure_url || uploadRes.url,
      publicId: uploadRes.public_id,
      resourceType: uploadRes.resource_type,
      format: uploadRes.format,
      width: uploadRes.width,
      height: uploadRes.height,
      bytes: uploadRes.bytes,
      duration: uploadRes.duration || null,
      originalFilename: file.originalname,
    });
  }

  // If single file uploaded, return single object; if multiple, return array
  const responseData = req.file && !req.files ? results[0] : results.length === 1 ? results[0] : results;
  return sendSuccess(res, responseData, 201);
});

/**
 * Delete media asset from Cloudinary.
 * DELETE /api/v1/media/:publicId?
 */
export const deleteMedia = asyncHandler(async (req, res) => {
  const firmId = req.tenant.firmId.toString();
  const publicId = req.params.publicId || req.query.publicId || req.body?.publicId;
  const resourceType = req.query.resourceType || req.body?.resourceType || 'image';

  if (!publicId) {
    return sendError(res, {
      statusCode: 400,
      code: 'MISSING_PUBLIC_ID',
      message: 'publicId is required for deletion',
    });
  }

  // Cross-tenant safety check: Ensure publicId starts with firm's folder
  const expectedPrefix = `agent-broker/${firmId}/`;
  if (!publicId.startsWith(expectedPrefix)) {
    return sendError(res, {
      statusCode: 403,
      code: 'FORBIDDEN_RESOURCE',
      message: 'Cannot delete media assets belonging to another firm',
    });
  }

  const result = await deleteFromCloudinary(publicId, { resource_type: resourceType });
  return sendSuccess(res, { result, publicId });
});
