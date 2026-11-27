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

export type PropertyCategory = 'plot' | 'rental' | 'agricultural' | 'house';
export type RentalFurnishing = 'unfurnished' | 'semi_furnished' | 'fully_furnished';
export type AgriListingType = 'sale' | 'rent' | 'lease';
export type HouseType =
  | 'flat'
  | 'independent_house'
  | 'villa'
  | 'duplex'
  | 'builder_floor'
  | 'penthouse'
  | 'studio'
  | string;

export function getCategoryPrivateLabels(category?: PropertyCategory | string | null) {
  switch (category) {
    case 'rental':
      return {
        title: 'Confidential Rental Data',
        refLabel: 'Rental Code',
        itemType: 'rental property',
        editTitle: 'Edit Confidential Rental Details',
        recordTitle: 'Record Confidential Rental Details',
      };
    case 'house':
      return {
        title: 'Confidential House / Flat Data',
        refLabel: 'Property Ref',
        itemType: 'house / flat',
        editTitle: 'Edit Confidential House / Flat Details',
        recordTitle: 'Record Confidential House / Flat Details',
      };
    case 'agricultural':
      return {
        title: 'Confidential Agricultural Land Data',
        refLabel: 'Land Ref',
        itemType: 'agricultural land',
        editTitle: 'Edit Confidential Land Details',
        recordTitle: 'Record Confidential Land Details',
      };
    case 'plot':
    default:
      return {
        title: 'Confidential Plot Data',
        refLabel: 'Plot Ref',
        itemType: 'plot',
        editTitle: 'Edit Confidential Details',
        recordTitle: 'Record Confidential Details',
      };
  }
}

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

export interface PlotCreator {
  id: string;
  name: string;
  email: string;
  role: string;
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
  dimensions?: string | null;
  rate: number | string;
  rateType: PlotRateType;
  totalPrice?: number | null;
  currency: string;
  description: string | null;
  status: PlotStatus;
  category?: PropertyCategory;
  rentalType?: string | null;
  furnishing?: RentalFurnishing | null;
  securityDeposit?: number | string | null;
  availableFrom?: string | null;
  preferredTenant?: string | null;
  listingType?: AgriListingType;
  waterSource?: string | null;
  roadAccess?: string | null;
  electricity?: string | null;
  fencing?: string | null;
  soilType?: string | null;
  houseType?: string | null;
  bhk?: string | null;
  societyName?: string | null;
  floorNo?: string | null;
  totalFloors?: number | null;
  bathrooms?: number | null;
  balconies?: number | null;
  builtUpArea?: number | null;
  plotArea?: number | null;
  parking?: string | null;
  lift?: boolean | null;
  constructionStatus?: string | null;
  facing?: string | null;
  images?: PlotImage[];
  videoUrl: string | null;
  videoProvider: 'youtube' | 'vimeo' | 'cloudinary' | null;
  video: PlotVideo | null;
  isActive: boolean;
  createdBy: string | null;
  creator?: PlotCreator | null;
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
  dimensions?: string | null;
  rate: number | string;
  rateType?: PlotRateType;
  currency?: string;
  description?: string | null;
  status?: PlotStatus;
  category?: PropertyCategory;
  rentalType?: string | null;
  furnishing?: RentalFurnishing | null;
  securityDeposit?: number | string | null;
  availableFrom?: string | null;
  preferredTenant?: string | null;
  listingType?: AgriListingType;
  waterSource?: string | null;
  roadAccess?: string | null;
  electricity?: string | null;
  fencing?: string | null;
  soilType?: string | null;
  houseType?: string | null;
  bhk?: string | null;
  societyName?: string | null;
  floorNo?: string | null;
  totalFloors?: number | null;
  bathrooms?: number | null;
  balconies?: number | null;
  builtUpArea?: number | null;
  plotArea?: number | null;
  parking?: string | null;
  lift?: boolean | null;
  constructionStatus?: string | null;
  facing?: string | null;
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
  dimensions?: string | null;
  rate?: number | string;
  rateType?: PlotRateType;
  currency?: string;
  description?: string | null;
  status?: PlotStatus;
  category?: PropertyCategory;
  rentalType?: string | null;
  furnishing?: RentalFurnishing | null;
  securityDeposit?: number | string | null;
  availableFrom?: string | null;
  preferredTenant?: string | null;
  listingType?: AgriListingType;
  waterSource?: string | null;
  roadAccess?: string | null;
  electricity?: string | null;
  fencing?: string | null;
  soilType?: string | null;
  houseType?: string | null;
  bhk?: string | null;
  societyName?: string | null;
  floorNo?: string | null;
  totalFloors?: number | null;
  bathrooms?: number | null;
  balconies?: number | null;
  builtUpArea?: number | null;
  plotArea?: number | null;
  parking?: string | null;
  lift?: boolean | null;
  constructionStatus?: string | null;
  facing?: string | null;
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
  category?: PropertyCategory | 'all';
  rentalType?: string;
  listingType?: AgriListingType;
  houseType?: string;
  bhk?: string;
  advisorId?: string;
  createdBy?: string;
}
