/**
 * Public Plot types strictly matching backend contract in src/models/Plot.model.js,
 * src/schemas/plot.schema.js, and OpenAPI specification.
 *
 * NOTE: Private seller/owner details are isolated in PlotPrivate on the backend
 * and are strictly excluded from all public plot interfaces and representations.
 */

export const PLOT_SIZE_UNITS = [
  'sqft',
  'sqyd',
  'sqm',
  'marla',
  'kanal',
  'acre',
  'gaj',
] as const;

export type PlotSizeUnit = (typeof PLOT_SIZE_UNITS)[number];

export const PLOT_RATE_TYPES = ['total', 'per_unit'] as const;

export type PlotRateType = (typeof PLOT_RATE_TYPES)[number];

export const PLOT_STATUSES = ['available', 'sold', 'reserved', 'on_hold'] as const;

export type PlotStatus = (typeof PLOT_STATUSES)[number];

export interface PlotImage {
  url: string;
  publicId?: string | null;
  caption?: string | null;
  order?: number;
}

export interface PlotVideo {
  url: string | null;
  provider: 'youtube' | 'vimeo' | 'cloudinary' | null;
  publicId?: string | null;
}

export interface Plot {
  id: string;
  _id?: string;
  plotId: string;
  plotRef: string;
  firmId: string;
  colonyId: string | null;
  plotDate: string | null;
  size: number;
  sizeUnit: PlotSizeUnit;
  rate: number;
  rateType: PlotRateType;
  currency: string;
  description: string | null;
  status: PlotStatus;
  images?: PlotImage[];
  videoUrl: string | null;
  videoProvider: 'youtube' | 'vimeo' | 'cloudinary' | null;
  video: PlotVideo | null;
  isActive: boolean;
  createdBy: string | null;
  updatedBy: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreatePlotInput {
  plotRef: string;
  plotId?: string;
  colonyId?: string | null;
  plotDate?: string | null;
  size: number;
  sizeUnit: PlotSizeUnit;
  rate: number;
  rateType?: PlotRateType;
  currency?: string;
  description?: string | null;
  status?: PlotStatus;
  images?: PlotImage[];
  videoUrl?: string | null;
  videoProvider?: 'youtube' | 'vimeo' | 'cloudinary' | null;
  video?: PlotVideo | null;
  isActive?: boolean;
}

export interface UpdatePlotInput {
  plotRef?: string;
  plotId?: string;
  colonyId?: string | null;
  plotDate?: string | null;
  size?: number;
  sizeUnit?: PlotSizeUnit;
  rate?: number;
  rateType?: PlotRateType;
  currency?: string;
  description?: string | null;
  status?: PlotStatus;
  images?: PlotImage[];
  videoUrl?: string | null;
  videoProvider?: 'youtube' | 'vimeo' | 'cloudinary' | null;
  video?: PlotVideo | null;
  isActive?: boolean;
}

export interface PlotQueryParams {
  page?: number;
  limit?: number;
  sortBy?: 'createdAt' | 'plotDate' | 'rate' | 'size' | 'plotRef' | 'status' | 'updatedAt' | string;
  sortOrder?: 'asc' | 'desc' | 'ASC' | 'DESC';
  search?: string;
  plotRef?: string;
  plotId?: string;
  colonyId?: string;
  status?: PlotStatus;
  isActive?: 'true' | 'false' | boolean;
  sizeMin?: number;
  sizeMax?: number;
  rateMin?: number;
  rateMax?: number;
  rateType?: PlotRateType;
  plotDateFrom?: string;
  plotDateTo?: string;
}
