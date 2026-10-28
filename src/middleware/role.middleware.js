/**
 * src/middleware/role.middleware.js
 *
 * Role authorization middleware factory.
 * Enforces that req.user.role matches at least one of the permitted roles.
 */

import { sendError } from '../utils/apiResponse.js';

/**
 * Creates an Express middleware restricting route access to specified roles.
 *
 * @param {...string} allowedRoles
 * @returns {import('express').RequestHandler}
 */
export function requireRole(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user) {
      return sendError(res, {
        statusCode: 401,
        code: 'UNAUTHORIZED',
        message: 'Authentication is required',
      });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return sendError(res, {
        statusCode: 403,
        code: 'FORBIDDEN',
        message: 'Insufficient role permissions',
      });
    }

    return next();
  };
}

export default requireRole;
