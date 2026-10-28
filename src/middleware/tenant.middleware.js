/**
 * src/middleware/tenant.middleware.js
 *
 * Tenant context and isolation middleware.
 *
 * RULES:
 *  - Platform administrators (SUPER_ADMIN) are strictly rejected with 403.
 *  - Only tenant roles (FIRM_ADMIN, FIRM_STAFF) can enter tenant routes.
 *  - firmId is sourced strictly from the trusted, authenticated req.user.firmId.
 *  - Any firmId supplied in req.body, req.query, or req.params is completely ignored.
 *  - Verifies that the tenant Firm exists and isActive === true.
 *  - Attaches immutable req.tenant and req.firmId context.
 */

import mongoose from 'mongoose';
import { ROLES } from '../constants/roles.js';
import { Firm } from '../models/Firm.model.js';
import { isValidObjectId } from '../utils/objectId.js';
import { sendError } from '../utils/apiResponse.js';

/**
 * Express middleware establishing verified tenant context for tenant-scoped routes.
 */
export async function requireTenantContext(req, res, next) {
  // 1. Ensure user is authenticated
  if (!req.user) {
    return sendError(res, {
      statusCode: 401,
      code: 'UNAUTHORIZED',
      message: 'Authentication is required',
    });
  }

  // 2. Reject SUPER_ADMIN from accessing tenant routes (Strict Tenant Isolation)
  if (req.user.role === ROLES.SUPER_ADMIN) {
    return sendError(res, {
      statusCode: 403,
      code: 'FORBIDDEN',
      message: 'Platform administrators cannot access tenant routes',
    });
  }

  // 3. Ensure user belongs to an approved tenant role
  if (req.user.role !== ROLES.FIRM_ADMIN && req.user.role !== ROLES.FIRM_STAFF) {
    return sendError(res, {
      statusCode: 403,
      code: 'FORBIDDEN',
      message: 'Access restricted to firm members',
    });
  }

  // 4. Validate user's firm assignment
  const userFirmId = req.user.firmId;
  if (!userFirmId || !isValidObjectId(userFirmId)) {
    return sendError(res, {
      statusCode: 403,
      code: 'FORBIDDEN',
      message: 'User does not belong to a valid firm',
    });
  }

  try {
    // 5. Verify the firm exists in database and is active
    const firm = await Firm.findById(userFirmId);

    if (!firm) {
      return sendError(res, {
        statusCode: 403,
        code: 'FIRM_NOT_FOUND',
        message: 'Assigned firm does not exist',
      });
    }

    if (!firm.isActive) {
      return sendError(res, {
        statusCode: 403,
        code: 'FIRM_SUSPENDED',
        message: 'Firm account is suspended or disabled',
      });
    }

    // 6. Attach trusted, immutable tenant context
    const firmObjectId = Object.freeze(new mongoose.Types.ObjectId(userFirmId));
    const safeFirm = Object.freeze(firm.toSafeObject());

    req.firmId = firmObjectId;
    req.firm = safeFirm;
    req.tenant = Object.freeze({
      firmId: firmObjectId,
      firm: safeFirm,
    });

    return next();
  } catch (err) {
    return next(err);
  }
}

// Aliases for architectural naming consistency
export const requireFirmMember = requireTenantContext;
export const setTenantContext = requireTenantContext;

export default requireTenantContext;
