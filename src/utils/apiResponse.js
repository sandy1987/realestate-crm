/**
 * src/utils/apiResponse.js
 *
 * Standard API response envelope helpers.
 *
 * Success envelope:
 * {
 *   success: true,
 *   data: { ... },
 *   meta?: { page, limit, total, totalPages }
 * }
 *
 * Error envelope:
 * {
 *   success: false,
 *   error: {
 *     code: 'ERROR_CODE',
 *     message: 'Human-readable message',
 *     details?: [ ... ]
 *   }
 * }
 */

/**
 * Sends a standardized success response.
 *
 * @param {import('express').Response} res
 * @param {*} data
 * @param {number} [statusCode=200]
 * @param {object|null} [meta=null]
 * @returns {import('express').Response}
 */
export function sendSuccess(res, data, statusCode = 200, meta = null) {
  const payload = {
    success: true,
    data,
  };

  if (meta !== null && meta !== undefined) {
    payload.meta = meta;
  }

  return res.status(statusCode).json(payload);
}

/**
 * Sends a standardized error response.
 *
 * @param {import('express').Response} res
 * @param {object} options
 * @param {number} [options.statusCode=500]
 * @param {string} [options.code='INTERNAL_ERROR']
 * @param {string} [options.message='Internal server error']
 * @param {*} [options.details=null]
 * @returns {import('express').Response}
 */
export function sendError(res, {
  statusCode = 500,
  code = 'INTERNAL_ERROR',
  message = 'Internal server error',
  details = null,
} = {}) {
  const payload = {
    success: false,
    error: {
      code,
      message,
    },
  };

  if (details !== null && details !== undefined) {
    payload.error.details = details;
  }

  return res.status(statusCode).json(payload);
}

// Convenient aliases
export const success = sendSuccess;
export const error = (res, arg1, arg2, arg3, arg4) => {
  // Support both sendError(res, { statusCode, code, message, details })
  // and error(res, code, message, statusCode, details)
  if (typeof arg1 === 'object' && arg1 !== null) {
    return sendError(res, arg1);
  }
  return sendError(res, {
    code: arg1 || 'INTERNAL_ERROR',
    message: arg2 || 'Internal server error',
    statusCode: typeof arg3 === 'number' ? arg3 : 500,
    details: arg4 ?? null,
  });
};
