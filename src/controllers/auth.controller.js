/**
 * src/controllers/auth.controller.js
 *
 * Route handlers for authentication operations.
 */

import { asyncHandler } from '../utils/asyncHandler.js';
import { sendSuccess } from '../utils/apiResponse.js';
import * as authService from '../services/auth.service.js';

export const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;
  const ipAddress = req.ip || null;
  const userAgent = req.get('user-agent') || null;

  const result = await authService.login({
    email,
    password,
    ipAddress,
    userAgent,
  });

  return sendSuccess(res, result, 200);
});

export const me = asyncHandler(async (req, res) => {
  // req.user is guaranteed populated and frozen by requireAuth middleware
  return sendSuccess(res, req.user, 200);
});

export const refresh = asyncHandler(async (req, res) => {
  const { refreshToken } = req.body;
  const ipAddress = req.ip || null;
  const userAgent = req.get('user-agent') || null;

  const result = await authService.refresh({
    refreshToken,
    ipAddress,
    userAgent,
  });

  return sendSuccess(res, result, 200);
});

export const logout = asyncHandler(async (req, res) => {
  const { refreshToken } = req.body;

  await authService.logout({ refreshToken });

  return sendSuccess(res, { message: 'Logged out successfully' }, 200);
});

export const changePassword = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const { currentPassword, newPassword } = req.body;

  const result = await authService.changePassword(
    userId,
    {
      currentPassword,
      newPassword,
    },
    req.user?.role
  );

  return sendSuccess(res, result, 200);
});

export default {
  login,
  me,
  refresh,
  logout,
  changePassword,
};
