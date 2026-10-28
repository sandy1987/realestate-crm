/**
 * frontend/types/plotPrivate.ts
 *
 * Confidential Plot Owner & Source types matching backend contract in
 * src/models/PlotPrivate.model.js, src/schemas/plotPrivate.schema.js, and OpenAPI specification.
 *
 * NOTE: Private seller/owner details are isolated strictly from public plot models.
 * They must NEVER be mixed with public plot tables or client storage.
 */

export interface PlotOwner {
  name: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
}

export interface PlotSource {
  name: string | null;
  phone: string | null;
  email: string | null;
  type: string | null;
}

export interface PlotPrivate {
  id: string;
  _id?: string;
  plotId: string;
  firmId: string;
  owner: PlotOwner;
  source: PlotSource;
  // Flat field aliases returned by model toSafeObject() for client convenience
  ownerName: string | null;
  ownerPhone: string | null;
  ownerEmail: string | null;
  ownerAddress: string | null;
  sourceName: string | null;
  sourcePhone: string | null;
  sourceEmail: string | null;
  sourceType: string | null;
  notes: string | null;
  createdBy: string | null;
  updatedBy: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface UpsertPlotPrivateInput {
  ownerName?: string | null;
  ownerPhone?: string | null;
  ownerEmail?: string | null;
  ownerAddress?: string | null;
  sourceName?: string | null;
  sourcePhone?: string | null;
  sourceEmail?: string | null;
  sourceType?: string | null;
  notes?: string | null;
  owner?: Partial<PlotOwner> | null;
  source?: Partial<PlotSource> | null;
}

export interface PatchPlotPrivateInput {
  ownerName?: string | null;
  ownerPhone?: string | null;
  ownerEmail?: string | null;
  ownerAddress?: string | null;
  sourceName?: string | null;
  sourcePhone?: string | null;
  sourceEmail?: string | null;
  sourceType?: string | null;
  notes?: string | null;
  owner?: Partial<PlotOwner> | null;
  source?: Partial<PlotSource> | null;
}
