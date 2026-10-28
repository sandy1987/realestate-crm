/**
 * src/schemas/colony.schema.js
 *
 * Zod validation schemas for Colony management operations.
 */

import { z } from 'zod';

export const createColonySchema = z.object({
  name: z
    .string({ required_error: 'Colony name is required' })
    .trim()
    .min(1, 'Colony name cannot be empty')
    .max(120, 'Colony name cannot exceed 120 characters'),

  description: z.string().trim().max(2000).optional().nullable(),
  address: z.string().trim().max(300).optional().nullable(),
  city: z.string().trim().max(80).optional().nullable(),
  state: z.string().trim().max(80).optional().nullable(),
  country: z.string().trim().max(80).optional().default('India'),
  pincode: z.string().trim().max(20).optional().nullable(),
  mapImageUrl: z.string().trim().max(1000).optional().nullable(),
  mapImage: z
    .object({
      url: z.string().trim().min(1),
      publicId: z.string().trim().max(500).optional().nullable(),
    })
    .optional()
    .nullable(),
});

export const updateColonySchema = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  description: z.string().trim().max(2000).optional().nullable(),
  address: z.string().trim().max(300).optional().nullable(),
  city: z.string().trim().max(80).optional().nullable(),
  state: z.string().trim().max(80).optional().nullable(),
  country: z.string().trim().max(80).optional(),
  pincode: z.string().trim().max(20).optional().nullable(),
  mapImageUrl: z.string().trim().max(1000).optional().nullable(),
  mapImage: z
    .object({
      url: z.string().trim().min(1),
      publicId: z.string().trim().max(500).optional().nullable(),
    })
    .optional()
    .nullable(),
  isActive: z.boolean().optional(),
});

export const queryColonySchema = z.object({
  page: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).optional(),
  sortBy: z.string().optional(),
  sortOrder: z.enum(['asc', 'desc', 'ASC', 'DESC']).optional(),
  search: z.string().trim().optional(),
  isActive: z.enum(['true', 'false']).optional(),
  city: z.string().trim().optional(),
  state: z.string().trim().optional(),
});

export default {
  createColonySchema,
  updateColonySchema,
  queryColonySchema,
};
