/**
 * src/middleware/auth.middleware.js
 *
 * JWT authentication middleware.
 * Verifies the Bearer access token, retrieves the fresh user from the database,
 * checks account status (active/non-suspended), and attaches a frozen req.user.
 */

import { verifyAccessToken } from '../services/token.service.js';
import { User } from '../models/User.model.js';
import { sendError } from '../utils/apiResponse.js';

/**
 * Express middleware requiring a valid JWT Bearer access token.
 */
export async function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return sendError(res, {
      statusCode: 401,
      code: 'UNAUTHORIZED',
      message: 'Authentication token is required',
    });
  }

  const token = authHeader.slice(7).trim();

  let decoded;
  try {
    decoded = verifyAccessToken(token);
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return sendError(res, {
        statusCode: 401,
        code: 'TOKEN_EXPIRED',
        message: 'Authentication token has expired',
      });
    }
    return sendError(res, {
      statusCode: 401,
      code: 'INVALID_TOKEN',
      message: 'Authentication token is invalid',
    });
  }

  if (!decoded || !decoded.sub) {
    return sendError(res, {
      statusCode: 401,
      code: 'INVALID_TOKEN',
      message: 'Authentication token payload is invalid',
    });
  }

  // Lookup fresh user record from DB to verify current account status
  try {
    const user = await User.findById(decoded.sub);

    if (!user) {
      return sendError(res, {
        statusCode: 401,
        code: 'UNAUTHORIZED',
        message: 'User account no longer exists',
      });
    }

    if (!user.isActive || user.isSuspended) {
      return sendError(res, {
        statusCode: 403,
        code: 'ACCOUNT_DISABLED',
        message: 'User account has been deactivated or suspended',
      });
    }

    // Attach immutable identity object
    req.user = Object.freeze(user.toSafeObject());
    req.userId = user._id;

    return next();
  } catch (err) {
    return next(err);
  }
}

export default requireAuth;
