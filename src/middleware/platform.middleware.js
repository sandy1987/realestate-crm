/**
 * src/middleware/platform.middleware.js
 *
 * Platform administrator authorization guard.
 * Restricts platform-level routes exclusively to authenticated SUPER_ADMIN accounts.
 *
 * Invariant:
 *  - SUPER_ADMIN has firmId: null.
 *  - Tenant users (FIRM_ADMIN, FIRM_STAFF) are rejected with 403.
 *  - Unauthenticated callers are rejected with 401.
 */

import { ROLES } from '../constants/roles.js';
import { sendError } from '../utils/apiResponse.js';

/**
 * Express middleware restricting route to SUPER_ADMIN role.
 */
export function requirePlatformAdmin(req, res, next) {
  if (!req.user) {
    return sendError(res, {
      statusCode: 401,
      code: 'UNAUTHORIZED',
      message: 'Authentication is required',
    });
  }

  if (req.user.role !== ROLES.SUPER_ADMIN) {
    return sendError(res, {
      statusCode: 403,
      code: 'FORBIDDEN',
      message: 'Platform administrator access required',
    });
  }

  // Defensive enforcement of platform invariant
  if (req.user.firmId !== null) {
    return sendError(res, {
      statusCode: 403,
      code: 'FORBIDDEN',
      message: 'Platform administrator identity cannot have an assigned firm',
    });
  }

  return next();
}

export default requirePlatformAdmin;
