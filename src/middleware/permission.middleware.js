/**
 * src/middleware/permission.middleware.js
 *
 * Granular permission authorization middleware factory.
 *
 * RULES:
 *  - FIRM_ADMIN role possesses all firm permissions implicitly.
 *  - FIRM_STAFF must possess the specific required permission string.
 *  - SUPER_ADMIN is rejected by tenant.middleware before reaching here.
 *  - Unauthenticated requests are rejected with 401.
 */

import { ROLES } from '../constants/roles.js';
import { sendError } from '../utils/apiResponse.js';

/**
 * Creates an Express middleware requiring a specific permission string.
 *
 * @param {string} permission - One of ALL_PERMISSIONS from constants/permissions.js
 * @returns {import('express').RequestHandler}
 */
export function requirePermission(permission) {
  return (req, res, next) => {
    if (!req.user) {
      return sendError(res, {
        statusCode: 401,
        code: 'UNAUTHORIZED',
        message: 'Authentication is required',
      });
    }

    // FIRM_ADMIN holds all firm-level permissions implicitly
    if (req.user.role === ROLES.FIRM_ADMIN) {
      return next();
    }

    // FIRM_STAFF requires explicit permission grant
    if (
      req.user.role === ROLES.FIRM_STAFF &&
      Array.isArray(req.user.permissions) &&
      req.user.permissions.includes(permission)
    ) {
      return next();
    }

    return sendError(res, {
      statusCode: 403,
      code: 'FORBIDDEN',
      message: `Required permission '${permission}' not granted`,
    });
  };
}

export default requirePermission;
