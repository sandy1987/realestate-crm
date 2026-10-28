/**
 * src/routes/media.routes.js
 *
 * Media upload and management routes backed by Cloudinary.
 * Protected by requireAuth, requireTenantContext, and requirePermission(PERMS.PLOTS_WRITE).
 */

import { Router } from 'express';
import multer from 'multer';
import { requireAuth } from '../middleware/auth.middleware.js';
import { requireTenantContext } from '../middleware/tenant.middleware.js';
import { requirePermission } from '../middleware/permission.middleware.js';
import { PERMS } from '../constants/permissions.js';
import * as mediaController from '../controllers/media.controller.js';

const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: {
    fileSize: 100 * 1024 * 1024, // 100 MB max
    files: 10,
  },
});

const router = Router();

router.use(requireAuth);
router.use(requireTenantContext);

/**
 * Handle multipart uploads supporting either "file" (single) or "files" (multiple) fields.
 */
const uploadMiddleware = (req, res, next) => {
  upload.fields([
    { name: 'file', maxCount: 1 },
    { name: 'files', maxCount: 10 },
  ])(req, res, (err) => {
    if (err) {
      if (err instanceof multer.MulterError) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'UPLOAD_ERROR',
            message: err.message,
          },
        });
      }
      return res.status(400).json({
        success: false,
        error: {
          code: 'UPLOAD_ERROR',
          message: err.message || 'File upload failed',
        },
      });
    }

    // Flatten into req.files or req.file for controller convenience
    if (req.files) {
      if (req.files.file && req.files.file.length > 0) {
        req.file = req.files.file[0];
      }
      if (req.files.files && req.files.files.length > 0) {
        req.files = req.files.files;
      } else if (req.file) {
        req.files = [req.file];
      } else {
        req.files = [];
      }
    }
    next();
  });
};

router.post(
  '/upload',
  requirePermission(PERMS.PLOTS_WRITE),
  uploadMiddleware,
  mediaController.uploadMedia
);

router.delete(
  '/:publicId(*)?',
  requirePermission(PERMS.PLOTS_WRITE),
  mediaController.deleteMedia
);

export default router;
