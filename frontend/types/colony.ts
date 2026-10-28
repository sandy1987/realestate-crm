/**
 * Colony types strictly matching backend contract in src/models/Colony.model.js,
 * src/schemas/colony.schema.js, and OpenAPI specification.
 */

export interface ColonyMapImage {
  url: string;
  publicId?: string | null;
}

export interface Colony {
  id: string;
  _id?: string;
  firmId: string;
  name: string;
  description: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  country: string;
  pincode: string | null;
  mapImageUrl?: string | null;
  mapImage?: ColonyMapImage | null;
  isActive: boolean;
  createdBy: string | null;
  updatedBy: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateColonyInput {
  name: string;
  description?: string | null;
  address?: string | null;
  city?: string | null;
  state?: string | null;
  country?: string;
  pincode?: string | null;
  mapImageUrl?: string | null;
  mapImage?: ColonyMapImage | null;
}

export interface UpdateColonyInput {
  name?: string;
  description?: string | null;
  address?: string | null;
  city?: string | null;
  state?: string | null;
  country?: string;
  pincode?: string | null;
  mapImageUrl?: string | null;
  mapImage?: ColonyMapImage | null;
  isActive?: boolean;
}

export interface ColonyQueryParams {
  page?: number;
  limit?: number;
  sortBy?: 'createdAt' | 'name' | 'city' | 'state' | 'isActive' | string;
  sortOrder?: 'asc' | 'desc' | 'ASC' | 'DESC';
  search?: string;
  isActive?: 'true' | 'false' | boolean;
  city?: string;
  state?: string;
}
