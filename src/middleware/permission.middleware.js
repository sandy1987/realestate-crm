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

/**
 * Category-aware permission authorization middleware for property operations.
 * Allows category-specific permission (e.g. houses:read) OR legacy plots:* permission for backward compatibility.
 *
 * @param {'read' | 'write' | 'delete' | 'export'} action
 * @returns {import('express').RequestHandler}
 */
export function requirePropertyPermission(action = 'read') {
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

    if (req.user.role === ROLES.FIRM_STAFF && Array.isArray(req.user.permissions)) {
      const category = req.query?.category || req.body?.category;
      let requiredPerm = `plots:${action}`;

      if (category === 'house') {
        requiredPerm = `houses:${action}`;
      } else if (category === 'agricultural') {
        requiredPerm = `agricultural:${action}`;
      } else if (category === 'rental') {
        requiredPerm = `rentals:${action}`;
      }

      // Check specific category permission OR legacy plots:* fallback
      if (
        req.user.permissions.includes(requiredPerm) ||
        req.user.permissions.includes(`plots:${action}`)
      ) {
        return next();
      }

      // For general reading without category parameter, allow if user has any property read permission
      if (!category && action === 'read') {
        const anyRead = ['plots:read', 'houses:read', 'agricultural:read', 'rentals:read'];
        if (anyRead.some((p) => req.user.permissions.includes(p))) {
          return next();
        }
      }

      // For general updating/deleting without category in body, allow if user has any property write/delete permission
      if (!category && (action === 'write' || action === 'delete')) {
        const anyAction = [
          `plots:${action}`,
          `houses:${action}`,
          `agricultural:${action}`,
          `rentals:${action}`,
        ];
        if (anyAction.some((p) => req.user.permissions.includes(p))) {
          return next();
        }
      }
    }

    return sendError(res, {
      statusCode: 403,
      code: 'FORBIDDEN',
      message: `Permission denied for ${action} operation on property`,
    });
  };
}

export default requirePermission;
