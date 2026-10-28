/**
 * src/schemas/plot.schema.js
 *
 * Zod validation schemas for Plot management operations.
 */

import { z } from 'zod';
import { PLOT_SIZE_UNITS, PLOT_RATE_TYPES, PLOT_STATUSES } from '../models/Plot.model.js';
import { isValidObjectId } from '../utils/objectId.js';

const objectIdSchema = z.string().refine((val) => isValidObjectId(val), {
  message: 'Invalid ObjectId format',
});

const dateSchema = z.string().refine((val) => !isNaN(Date.parse(val)), {
  message: 'Invalid date format',
});

const plotImageItemSchema = z.union([
  z.string().trim().min(1),
  z.object({
    url: z.string().trim().min(1),
    publicId: z.string().trim().max(500).optional().nullable(),
    caption: z.string().trim().max(300).optional().nullable(),
    order: z.number().int().optional().default(0),
  }),
]);

export const createPlotSchema = z
  .object({
    plotId: z.string().trim().min(1, 'Plot identifier cannot be empty').max(60).optional(),
    plotRef: z.string().trim().min(1, 'Plot reference cannot be empty').max(60).optional(),
    colonyId: objectIdSchema.optional().nullable(),
    plotDate: dateSchema.optional().nullable(),
    size: z.number({ required_error: 'Plot size is required' }).positive('Plot size must be greater than 0'),
    sizeUnit: z.enum(PLOT_SIZE_UNITS, {
      errorMap: () => ({ message: `Invalid size unit. Must be one of: ${PLOT_SIZE_UNITS.join(', ')}` }),
    }),
    rate: z.number({ required_error: 'Rate is required' }).min(0, 'Rate cannot be negative'),
    rateType: z.enum(PLOT_RATE_TYPES).optional().default('total'),
    currency: z.string().trim().max(10).optional().default('INR'),
    description: z.string().trim().max(2000).optional().nullable(),
    status: z.enum(PLOT_STATUSES).optional().default('available'),
    images: z.array(plotImageItemSchema).optional().default([]),
    videoUrl: z.string().trim().max(1000).optional().nullable(),
    videoProvider: z.enum(['youtube', 'vimeo', 'cloudinary']).optional().nullable(),
    video: z
      .object({
        url: z.string().trim().max(1000).optional().nullable(),
        provider: z.enum(['youtube', 'vimeo', 'cloudinary']).optional().nullable(),
        publicId: z.string().trim().max(500).optional().nullable(),
      })
      .optional()
      .nullable(),
    isActive: z.boolean().optional().default(true),
  })
  .refine((data) => data.plotId || data.plotRef, {
    message: 'Either plotId or plotRef is required',
    path: ['plotRef'],
  });

export const updatePlotSchema = z.object({
  plotId: z.string().trim().min(1).max(60).optional(),
  plotRef: z.string().trim().min(1).max(60).optional(),
  colonyId: objectIdSchema.optional().nullable(),
  plotDate: dateSchema.optional().nullable(),
  size: z.number().positive('Plot size must be greater than 0').optional(),
  sizeUnit: z.enum(PLOT_SIZE_UNITS).optional(),
  rate: z.number().min(0, 'Rate cannot be negative').optional(),
  rateType: z.enum(PLOT_RATE_TYPES).optional(),
  currency: z.string().trim().max(10).optional(),
  description: z.string().trim().max(2000).optional().nullable(),
  status: z.enum(PLOT_STATUSES).optional(),
  images: z.array(plotImageItemSchema).optional(),
  videoUrl: z.string().trim().max(1000).optional().nullable(),
  videoProvider: z.enum(['youtube', 'vimeo', 'cloudinary']).optional().nullable(),
  video: z
    .object({
      url: z.string().trim().max(1000).optional().nullable(),
      provider: z.enum(['youtube', 'vimeo', 'cloudinary']).optional().nullable(),
      publicId: z.string().trim().max(500).optional().nullable(),
    })
    .optional()
    .nullable(),
  isActive: z.boolean().optional(),
});

export const queryPlotSchema = z.object({
  page: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).optional(),
  sortBy: z.string().optional(),
  sortOrder: z.enum(['asc', 'desc', 'ASC', 'DESC']).optional(),
  search: z.string().trim().optional(),
  plotId: z.string().trim().optional(),
  plotRef: z.string().trim().optional(),
  colonyId: z.string().optional(),
  status: z.enum(PLOT_STATUSES).optional(),
  isActive: z.enum(['true', 'false']).optional(),
  sizeMin: z.coerce.number().positive().optional(),
  sizeMax: z.coerce.number().positive().optional(),
  rateMin: z.coerce.number().min(0).optional(),
  rateMax: z.coerce.number().min(0).optional(),
  rateType: z.enum(PLOT_RATE_TYPES).optional(),
  plotDateFrom: dateSchema.optional(),
  plotDateTo: dateSchema.optional(),
});

export default {
  createPlotSchema,
  updatePlotSchema,
  queryPlotSchema,
};
