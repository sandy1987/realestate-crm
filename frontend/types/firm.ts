/**
 * Firm types strictly matching backend contract in src/models/Firm.model.js,
 * src/schemas/firm.schema.js, and OpenAPI specification.
 */

import { UserSummary } from './user';

export type FirmStatus = 'active' | 'suspended';

export interface FirmSettings {
  allowedVideoProviders: ('youtube' | 'vimeo')[];
  defaultCurrency: string;
}

export interface Firm {
  id: string;
  _id?: string;
  name: string;
  slug: string;
  contactEmail: string | null;
  contactPhone: string | null;
  isActive: boolean;
  settings: FirmSettings;
  createdBy?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateFirmInput {
  name: string;
  slug: string;
  contactEmail?: string | null;
  contactPhone?: string | null;
  settings?: Partial<FirmSettings>;
  adminEmail?: string;
  adminPassword?: string;
  adminFirstName?: string;
  adminLastName?: string;
}

export interface ProvisionFirmResult {
  firm: Firm;
  admin?: UserSummary | null;
}

export interface FirmQueryParams {
  page?: number;
  limit?: number;
  sortBy?: 'createdAt' | 'name' | 'slug' | 'isActive' | string;
  sortOrder?: 'asc' | 'desc' | 'ASC' | 'DESC';
  search?: string;
}
