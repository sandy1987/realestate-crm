/**
 * src/schemas/firm.schema.js
 *
 * Zod validation schemas for Firm provisioning and platform management.
 */

import { z } from 'zod';

const slugRegex = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export const createFirmSchema = z.object({
  name: z
    .string({ required_error: 'Firm name is required' })
    .trim()
    .min(1, 'Firm name cannot be empty')
    .max(120, 'Firm name cannot exceed 120 characters'),

  slug: z
    .string({ required_error: 'Firm slug is required' })
    .trim()
    .toLowerCase()
    .min(2, 'Slug must be at least 2 characters long')
    .max(80, 'Slug cannot exceed 80 characters')
    .regex(
      slugRegex,
      'Slug must consist of lowercase alphanumeric characters separated by single hyphens'
    ),

  contactEmail: z
    .string()
    .trim()
    .toLowerCase()
    .email('Invalid contact email format')
    .optional()
    .nullable(),

  contactPhone: z
    .string()
    .trim()
    .max(30, 'Contact phone cannot exceed 30 characters')
    .optional()
    .nullable(),

  settings: z
    .object({
      allowedVideoProviders: z
        .array(z.enum(['youtube', 'vimeo', 'cloudinary']))
        .optional()
        .default(['youtube', 'vimeo', 'cloudinary']),
      defaultCurrency: z.string().trim().default('INR'),
    })
    .optional(),

  // Optional provisioning of initial FIRM_ADMIN simultaneously
  adminEmail: z
    .string()
    .trim()
    .toLowerCase()
    .email('Invalid admin email format')
    .optional(),

  adminPassword: z
    .string()
    .min(8, 'Admin password must be at least 8 characters long')
    .optional(),

  adminFirstName: z.string().trim().max(60).optional(),
  adminLastName: z.string().trim().max(60).optional(),
});

export const updateFirmSchema = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  contactEmail: z.string().trim().toLowerCase().email().optional().nullable(),
  contactPhone: z.string().trim().max(30).optional().nullable(),
  settings: z
    .object({
      allowedVideoProviders: z.array(z.enum(['youtube', 'vimeo', 'cloudinary'])).optional(),
      defaultCurrency: z.string().trim().optional(),
    })
    .optional(),
});

export const updateFirmCloudinarySchema = z.object({
  cloudName: z
    .string({ required_error: 'Cloud Name is required' })
    .trim()
    .min(1, 'Cloud Name cannot be empty'),
  apiKey: z
    .string({ required_error: 'API Key is required' })
    .trim()
    .min(1, 'API Key cannot be empty'),
  apiSecret: z
    .string({ required_error: 'API Secret is required' })
    .trim()
    .min(1, 'API Secret cannot be empty'),
});

export const testFirmCloudinarySchema = z
  .object({
    cloudName: z.string().trim().optional(),
    apiKey: z.string().trim().optional(),
    apiSecret: z.string().trim().optional(),
  })
  .optional();

export default {
  createFirmSchema,
  updateFirmSchema,
  updateFirmCloudinarySchema,
  testFirmCloudinarySchema,
};
