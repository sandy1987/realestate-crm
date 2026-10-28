/**
 * src/schemas/firmUser.schema.js
 *
 * Zod validation schemas for firm-scoped user administration operations.
 */

import { z } from 'zod';
import { ROLES } from '../constants/roles.js';
import { ALL_PERMISSIONS } from '../constants/permissions.js';

export const createFirmUserSchema = z
  .object({
    email: z
      .string({ required_error: 'Email is required' })
      .trim()
      .toLowerCase()
      .email('Invalid email address format')
      .max(120, 'Email cannot exceed 120 characters'),

    password: z
      .string({ required_error: 'Password is required' })
      .min(8, 'Password must be at least 8 characters long')
      .max(128, 'Password cannot exceed 128 characters'),

    firstName: z.string().trim().max(60).optional().nullable(),
    lastName: z.string().trim().max(60).optional().nullable(),

    role: z
      .literal(ROLES.FIRM_STAFF, {
        errorMap: () => ({ message: 'Tenant administrators can only create FIRM_STAFF accounts' }),
      })
      .optional()
      .default(ROLES.FIRM_STAFF),

    permissions: z
      .array(
        z.enum(ALL_PERMISSIONS, {
          errorMap: (issue) => ({ message: `Invalid permission: ${issue.received}` }),
        })
      )
      .optional()
      .default([]),
  })
  .strict();

export const updateFirmUserSchema = z
  .object({
    firstName: z.string().trim().max(60).optional().nullable(),
    lastName: z.string().trim().max(60).optional().nullable(),
    permissions: z
      .array(
        z.enum(ALL_PERMISSIONS, {
          errorMap: (issue) => ({ message: `Invalid permission: ${issue.received}` }),
        })
      )
      .optional(),
  })
  .strict();

export const updateFirmUserStatusSchema = z
  .object({
    isActive: z.boolean().optional(),
    isSuspended: z.boolean().optional(),
  })
  .strict()
  .refine(
    (data) => data.isActive !== undefined || data.isSuspended !== undefined,
    {
      message: 'At least one of isActive or isSuspended must be provided',
    }
  );

export const queryFirmUserSchema = z.object({
  page: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).optional(),
  sortBy: z.string().optional(),
  sortOrder: z.enum(['asc', 'desc', 'ASC', 'DESC']).optional(),
  search: z.string().trim().optional(),
  role: z.enum([ROLES.FIRM_ADMIN, ROLES.FIRM_STAFF]).optional(),
  isActive: z.enum(['true', 'false']).optional(),
  isSuspended: z.enum(['true', 'false']).optional(),
});

export default {
  createFirmUserSchema,
  updateFirmUserSchema,
  updateFirmUserStatusSchema,
  queryFirmUserSchema,
};
