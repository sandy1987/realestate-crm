/**
 * src/schemas/audit.schema.js
 *
 * Zod validation schemas for audit log query endpoints.
 */

import { z } from 'zod';
import { ALL_AUDIT_EVENTS } from '../constants/auditEvents.js';

const dateSchema = z.string().refine((val) => !isNaN(Date.parse(val)), {
  message: 'Invalid date format',
});

export const queryFirmAuditSchema = z.object({
  page: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).optional(),
  sortBy: z.string().optional(),
  sortOrder: z.enum(['asc', 'desc', 'ASC', 'DESC']).optional(),
  eventType: z.enum(ALL_AUDIT_EVENTS).optional(),
  actorUserId: z.string().trim().optional(),
  resourceType: z.string().trim().optional(),
  resourceId: z.string().trim().optional(),
  outcome: z.enum(['success', 'failure']).optional(),
  dateFrom: dateSchema.optional(),
  dateTo: dateSchema.optional(),
});

export const queryPlatformAuditSchema = queryFirmAuditSchema.extend({
  firmId: z.string().trim().optional(),
  platformOnly: z.enum(['true', 'false']).optional(),
});

export default {
  queryFirmAuditSchema,
  queryPlatformAuditSchema,
};
