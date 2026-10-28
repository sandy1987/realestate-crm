/**
 * src/middleware/validate.middleware.js
 *
 * Request validation middleware factory using Zod.
 * Validates request body, query, or params against a Zod schema.
 * Replaces request target with parsed/sanitized data (stripping undeclared fields).
 * Returns standard 400 VALIDATION_ERROR envelope on failure.
 */

import { sendError } from '../utils/apiResponse.js';

/**
 * Creates an Express middleware that validates incoming requests with a Zod schema.
 *
 * @param {import('zod').ZodSchema} schema - Zod schema to validate against
 * @param {'body'|'query'|'params'} [source='body'] - Request property to validate
 * @returns {import('express').RequestHandler}
 */
export function validate(schema, source = 'body') {
  return (req, res, next) => {
    // If schema defines shape with body/query/params envelope, validate the composite
    let target;
    let isEnvelope = false;

    if (schema?.shape && (schema.shape.body || schema.shape.query || schema.shape.params)) {
      target = {
        body: req.body,
        query: req.query,
        params: req.params,
      };
      isEnvelope = true;
    } else {
      target = req[source];
    }

    const result = schema.safeParse(target);

    if (!result.success) {
      const details = result.error.issues.map((issue) => ({
        field: issue.path.join('.'),
        message: issue.message,
      }));

      return sendError(res, {
        statusCode: 400,
        code: 'VALIDATION_ERROR',
        message: 'Request validation failed',
        details,
      });
    }

    // Replace with validated (and stripped) data
    if (isEnvelope) {
      if (result.data.body !== undefined) req.body = result.data.body;
      if (result.data.query !== undefined) req.query = result.data.query;
      if (result.data.params !== undefined) req.params = result.data.params;
    } else {
      req[source] = result.data;
    }

    return next();
  };
}

export default validate;
