/**
 * src/schemas/plotPrivate.schema.js
 *
 * Zod validation schemas for PlotPrivate owner and source management.
 */

import { z } from 'zod';

const emailSchema = z.string().trim().email('Invalid email address format').max(120);
const phoneSchema = z.string().trim().max(30, 'Phone cannot exceed 30 characters');

const ownerObjectSchema = z.object({
  name: z.string().trim().max(120).optional().nullable(),
  phone: phoneSchema.optional().nullable(),
  email: emailSchema.optional().nullable(),
  address: z.string().trim().max(300).optional().nullable(),
});

const sourceObjectSchema = z.object({
  name: z.string().trim().max(120).optional().nullable(),
  phone: phoneSchema.optional().nullable(),
  email: emailSchema.optional().nullable(),
  type: z.string().trim().max(50).optional().nullable(),
});

export const putPlotPrivateSchema = z
  .object({
    owner: ownerObjectSchema.optional().nullable(),
    source: sourceObjectSchema.optional().nullable(),

    // Flat field aliases for client convenience
    ownerName: z.string().trim().max(120).optional().nullable(),
    ownerPhone: phoneSchema.optional().nullable(),
    ownerEmail: emailSchema.optional().nullable(),
    ownerAddress: z.string().trim().max(300).optional().nullable(),

    sourceName: z.string().trim().max(120).optional().nullable(),
    sourcePhone: phoneSchema.optional().nullable(),
    sourceEmail: emailSchema.optional().nullable(),
    sourceType: z.string().trim().max(50).optional().nullable(),

    notes: z.string().trim().max(5000, 'Notes cannot exceed 5000 characters').optional().nullable(),
  })
  .strict(); // Rejects unapproved fields (e.g., nationalId, firmId)

export const patchPlotPrivateSchema = z
  .object({
    owner: ownerObjectSchema.optional().nullable(),
    source: sourceObjectSchema.optional().nullable(),

    ownerName: z.string().trim().max(120).optional().nullable(),
    ownerPhone: phoneSchema.optional().nullable(),
    ownerEmail: emailSchema.optional().nullable(),
    ownerAddress: z.string().trim().max(300).optional().nullable(),

    sourceName: z.string().trim().max(120).optional().nullable(),
    sourcePhone: phoneSchema.optional().nullable(),
    sourceEmail: emailSchema.optional().nullable(),
    sourceType: z.string().trim().max(50).optional().nullable(),

    notes: z.string().trim().max(5000).optional().nullable(),
  })
  .strict();

export default {
  putPlotPrivateSchema,
  patchPlotPrivateSchema,
};
