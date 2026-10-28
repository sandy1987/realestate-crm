/**
 * src/routes/auth.routes.js
 *
 * Authentication routes for login, token refresh, logout, profile identity,
 * and authenticated password changes.
 */

import { Router } from 'express';
import { authRateLimiter } from '../middleware/rateLimiter.middleware.js';
import { validate } from '../middleware/validate.middleware.js';
import { requireAuth } from '../middleware/auth.middleware.js';
import {
  loginSchema,
  refreshTokenSchema,
  changePasswordSchema,
} from '../schemas/auth.schema.js';
import * as authController from '../controllers/auth.controller.js';

const router = Router();

// Public auth endpoints (rate limited)
router.post('/login', authRateLimiter, validate(loginSchema), authController.login);
router.post('/refresh', authRateLimiter, validate(refreshTokenSchema), authController.refresh);
router.post('/logout', validate(refreshTokenSchema), authController.logout);

// Authenticated user identity and account endpoints
router.get('/me', requireAuth, authController.me);
router.post(
  '/change-password',
  requireAuth,
  authRateLimiter,
  validate(changePasswordSchema),
  authController.changePassword
);

export default router;
