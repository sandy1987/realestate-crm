'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Dialog, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/Dialog';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import {
  Plot,
  CreatePlotInput,
  UpdatePlotInput,
  PLOT_SIZE_UNITS,
  PlotSizeUnit,
  PlotStatus,
  PlotImage,
  PlotVideo,
  RentalFurnishing,
} from '@/types/plot';
import { Colony } from '@/types/colony';
import { plotsApi } from '@/lib/api/plots';
import { coloniesApi } from '@/lib/api/colonies';
import { mediaApi } from '@/lib/api/media';
import { ApiClientError } from '@/lib/api/errors';
import {
  AlertCircle,
  Upload,
  Image as ImageIcon,
  Video as VideoIcon,
  Trash2,
  Loader2,
  Film,
  CheckCircle2,
  KeyRound,
} from 'lucide-react';

export interface RentalFormModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  plot?: Plot | null;
  onSuccess: () => void;
}

const RENTAL_TYPES = [
  'Residential Flat / Apartment',
  'Independent House / Villa',
  'Commercial Shop',
  'Office Space',
  'Warehouse / Godown',
  'Open Land / Plot on Lease',
  'Builder Floor',
  'Other',
];

interface FormState {
  plotRef: string;
  colonyId: string;
  rentalType: string;
  rate: string;
  securityDeposit: string;
  furnishing: RentalFurnishing | '';
  availableFrom: string;
  preferredTenant: string;
  size: string;
  sizeUnit: PlotSizeUnit;
  dimensions: string;
  status: PlotStatus;
  description: string;
  images: PlotImage[];
  videoSourceType: 'upload' | 'external';
  videoUrl: string;
  video: PlotVideo | null;
  isActive: boolean;
}

const initialFormState: FormState = {
  plotRef: '',
  colonyId: '',
  rentalType: 'Residential Flat / Apartment',
  rate: '',
  securityDeposit: '',
  furnishing: 'unfurnished',
  availableFrom: '',
  preferredTenant: 'Family / All',
  size: '',
  sizeUnit: 'sqft',
  dimensions: '',
  status: 'available',
  description: '',
  images: [],
  videoSourceType: 'upload',
  videoUrl: '',
  video: null,
  isActive: true,
};

export function RentalFormModal({ open, onOpenChange, plot, onSuccess }: RentalFormModalProps) {
  const isEdit = Boolean(plot);
  const [formData, setFormData] = useState<FormState>(initialFormState);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [generalError, setGeneralError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [isUploadingVideo, setIsUploadingVideo] = useState(false);
  const [colonies, setColonies] = useState<Colony[]>([]);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let isMounted = true;
    coloniesApi
      .listColonies({ limit: 100 })
      .then((res) => {
        if (isMounted) setColonies(res.data);
      })
      .catch(() => {});
    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (plot) {
      const availDate = plot.availableFrom
        ? new Date(plot.availableFrom).toISOString().split('T')[0]
        : '';
      setFormData({
        plotRef: plot.plotRef || plot.plotId || '',
        colonyId: plot.colonyId || '',
        rentalType: plot.rentalType || 'Residential Flat / Apartment',
        rate: String(plot.rate ?? ''),
        securityDeposit: String(plot.securityDeposit ?? ''),
        furnishing: (plot.furnishing as RentalFurnishing) || 'unfurnished',
        availableFrom: availDate,
        preferredTenant: plot.preferredTenant || '',
        size: String(plot.size ?? ''),
        sizeUnit: plot.sizeUnit || 'sqft',
        dimensions: plot.dimensions || '',
        status: plot.status || 'available',
        description: plot.description || '',
        images: plot.images || [],
        videoSourceType: plot.video?.url ? 'upload' : plot.videoUrl ? 'external' : 'upload',
        videoUrl: plot.videoUrl || '',
        video: plot.video || null,
        isActive: plot.isActive !== undefined ? plot.isActive : true,
      });
    } else {
      setFormData(initialFormState);
    }
    setErrors({});
    setGeneralError(null);
  }, [plot, open]);

  const validate = (): boolean => {
    const errs: Record<string, string> = {};
    if (!formData.plotRef.trim()) errs.plotRef = 'Property reference / code is required';
    if (!formData.rate.trim()) errs.rate = 'Monthly rent is required';
    if (!formData.size.trim()) {
      errs.size = 'Property area / size is required';
    } else if (isNaN(Number(formData.size)) || Number(formData.size) <= 0) {
      errs.size = 'Size must be a valid positive number';
    }
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleImageFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    setIsUploadingImage(true);
    setGeneralError(null);
    try {
      const uploaded = await mediaApi.uploadFiles(Array.from(files));
      const newImages: PlotImage[] = uploaded.map((item, i) => ({
        url: item.secure_url || item.url,
        publicId: item.publicId,
        order: formData.images.length + i,
      }));
      setFormData((prev) => ({ ...prev, images: [...prev.images, ...newImages] }));
    } catch (err) {
      setGeneralError(err instanceof Error ? err.message : 'Failed to upload images');
    } finally {
      setIsUploadingImage(false);
      if (imageInputRef.current) imageInputRef.current.value = '';
    }
  };

  const handleVideoFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsUploadingVideo(true);
    setGeneralError(null);
    try {
      const res = await mediaApi.uploadFile(file);
      setFormData((prev) => ({
        ...prev,
        video: { url: res.secure_url || res.url, provider: 'cloudinary', publicId: res.publicId },
        videoUrl: res.secure_url || res.url,
      }));
    } catch (err) {
      setGeneralError(err instanceof Error ? err.message : 'Failed to upload video');
    } finally {
      setIsUploadingVideo(false);
      if (videoInputRef.current) videoInputRef.current.value = '';
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate() || isSubmitting) return;

    setIsSubmitting(true);
    setGeneralError(null);

    try {
      const parsedSize = Number(formData.size);
      const rawRate = formData.rate.trim();
      const finalRate = !isNaN(Number(rawRate)) ? Number(rawRate) : rawRate;
      const rawDeposit = formData.securityDeposit.trim();
      const finalDeposit = rawDeposit ? (!isNaN(Number(rawDeposit)) ? Number(rawDeposit) : rawDeposit) : null;

      let effectiveVideoUrl: string | null = null;
      let effectiveVideoProvider: 'youtube' | 'vimeo' | 'cloudinary' | null = null;
      let effectiveVideo: PlotVideo | null = null;

      if (formData.videoSourceType === 'upload' && formData.video?.url) {
        effectiveVideoUrl = formData.video.url;
        effectiveVideoProvider = 'cloudinary';
        effectiveVideo = formData.video;
      } else if (formData.videoSourceType === 'external' && formData.videoUrl.trim()) {
        effectiveVideoUrl = formData.videoUrl.trim();
        effectiveVideoProvider = formData.videoUrl.includes('vimeo') ? 'vimeo' : 'youtube';
        effectiveVideo = { url: effectiveVideoUrl, provider: effectiveVideoProvider, publicId: null };
      }

      if (isEdit && plot) {
        const payload: UpdatePlotInput = {
          plotRef: formData.plotRef.trim(),
          category: 'rental',
          rentalType: formData.rentalType,
          rate: finalRate,
          rateType: 'total',
          securityDeposit: finalDeposit,
          furnishing: (formData.furnishing as RentalFurnishing) || null,
          availableFrom: formData.availableFrom ? new Date(formData.availableFrom).toISOString() : null,
          preferredTenant: formData.preferredTenant.trim() || null,
          colonyId: formData.colonyId || null,
          size: parsedSize,
          sizeUnit: formData.sizeUnit,
          dimensions: formData.dimensions.trim() || null,
          status: formData.status,
          images: formData.images,
          videoUrl: effectiveVideoUrl,
          videoProvider: effectiveVideoProvider,
          video: effectiveVideo,
          description: formData.description.trim() || null,
          isActive: formData.isActive,
        };
        await plotsApi.updatePlot(plot.id, payload);
      } else {
        const payload: CreatePlotInput = {
          plotRef: formData.plotRef.trim(),
          category: 'rental',
          rentalType: formData.rentalType,
          rate: finalRate,
          rateType: 'total',
          securityDeposit: finalDeposit,
          furnishing: (formData.furnishing as RentalFurnishing) || null,
          availableFrom: formData.availableFrom ? new Date(formData.availableFrom).toISOString() : null,
          preferredTenant: formData.preferredTenant.trim() || null,
          colonyId: formData.colonyId || null,
          size: parsedSize,
          sizeUnit: formData.sizeUnit,
          dimensions: formData.dimensions.trim() || null,
          status: formData.status,
          images: formData.images,
          videoUrl: effectiveVideoUrl,
          videoProvider: effectiveVideoProvider,
          video: effectiveVideo,
          description: formData.description.trim() || null,
        };
        await plotsApi.createPlot(payload);
      }

      onSuccess();
      onOpenChange(false);
    } catch (err: unknown) {
      if (err instanceof ApiClientError) {
        setGeneralError(err.message || 'Validation error while saving rental property');
      } else if (err instanceof Error) {
        setGeneralError(err.message);
      } else {
        setGeneralError('An unexpected error occurred');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogHeader>
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-100 text-emerald-800">
            <KeyRound className="h-4 w-4" />
          </div>
          <div>
            <DialogTitle>{isEdit ? 'Edit Rental Property' : 'List New Rental Property'}</DialogTitle>
            <DialogDescription>
              {isEdit
                ? 'Update rental listing details, pricing, and availability.'
                : 'Add a new rental listing (residential, commercial, or lease) with lease specifications.'}
            </DialogDescription>
          </div>
        </div>
      </DialogHeader>

      {generalError && (
        <div className="mb-4 flex items-start gap-2.5 rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-800">
          <AlertCircle className="h-4 w-4 shrink-0 text-red-600 mt-0.5" />
          <span>{generalError}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4 max-h-[75vh] overflow-y-auto px-1">
        {/* Row 1: Property Code & Colony */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Input
            id="rental-ref"
            label="Property Identifier / Code *"
            placeholder="e.g. RENT-FLAT-102 or SHOP-B12"
            value={formData.plotRef}
            onChange={(e) => setFormData((prev) => ({ ...prev, plotRef: e.target.value }))}
            error={errors.plotRef}
            autoFocus
          />

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Colony / Sector Development
            </label>
            <select
              value={formData.colonyId}
              onChange={(e) => setFormData((prev) => ({ ...prev, colonyId: e.target.value }))}
              className="h-9 w-full rounded-lg border border-slate-300 bg-white px-3 text-xs text-slate-800 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="">(None / Independent Location)</option>
              {colonies.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} {c.city ? `(${c.city})` : ''}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Row 2: Property Type & Furnishing */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Property Type</label>
            <select
              value={formData.rentalType}
              onChange={(e) => setFormData((prev) => ({ ...prev, rentalType: e.target.value }))}
              className="h-9 w-full rounded-lg border border-slate-300 bg-white px-3 text-xs text-slate-800 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              {RENTAL_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Furnishing Status</label>
            <select
              value={formData.furnishing}
              onChange={(e) => setFormData((prev) => ({ ...prev, furnishing: e.target.value as RentalFurnishing }))}
              className="h-9 w-full rounded-lg border border-slate-300 bg-white px-3 text-xs text-slate-800 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="unfurnished">Unfurnished</option>
              <option value="semi_furnished">Semi-Furnished</option>
              <option value="fully_furnished">Fully Furnished</option>
            </select>
          </div>
        </div>

        {/* Row 3: Monthly Rent & Security Deposit */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Input
            id="rental-rate"
            label="Monthly Rent *"
            placeholder="e.g. 25000 or 1.5 Lakh/mo"
            value={formData.rate}
            onChange={(e) => setFormData((prev) => ({ ...prev, rate: e.target.value }))}
            error={errors.rate}
          />

          <Input
            id="rental-deposit"
            label="Security Deposit / Advance"
            placeholder="e.g. 50000 or 2 Months Rent"
            value={formData.securityDeposit}
            onChange={(e) => setFormData((prev) => ({ ...prev, securityDeposit: e.target.value }))}
          />
        </div>

        {/* Row 4: Area Size, Unit, Dimensions, Status */}
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
          <Input
            id="rental-size"
            label="Size / Area *"
            placeholder="e.g. 1200"
            value={formData.size}
            onChange={(e) => setFormData((prev) => ({ ...prev, size: e.target.value }))}
            error={errors.size}
          />

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Size Unit</label>
            <select
              value={formData.sizeUnit}
              onChange={(e) => setFormData((prev) => ({ ...prev, sizeUnit: e.target.value as PlotSizeUnit }))}
              className="h-9 w-full rounded-lg border border-slate-300 bg-white px-2.5 text-xs text-slate-800 focus:border-blue-500 focus:outline-none"
            >
              {PLOT_SIZE_UNITS.map((u) => (
                <option key={u} value={u}>
                  {u}
                </option>
              ))}
            </select>
          </div>

          <Input
            id="rental-dimensions"
            label="Dimensions"
            placeholder="e.g. 30*40"
            value={formData.dimensions}
            onChange={(e) => setFormData((prev) => ({ ...prev, dimensions: e.target.value }))}
          />

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Status</label>
            <select
              value={formData.status}
              onChange={(e) => setFormData((prev) => ({ ...prev, status: e.target.value as PlotStatus }))}
              className="h-9 w-full rounded-lg border border-slate-300 bg-white px-2.5 text-xs text-slate-800 focus:border-blue-500 focus:outline-none"
            >
              <option value="available">Available</option>
              <option value="reserved">Reserved</option>
              <option value="on_hold">On Hold</option>
              <option value="sold">Rented Out</option>
            </select>
          </div>
        </div>

        {/* Row 5: Available From Date & Preferred Tenant */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Input
            id="rental-available"
            label="Available From"
            type="date"
            value={formData.availableFrom}
            onChange={(e) => setFormData((prev) => ({ ...prev, availableFrom: e.target.value }))}
          />

          <Input
            id="rental-tenant"
            label="Preferred Tenant"
            placeholder="e.g. Family Only, Bachelors OK, Company Lease"
            value={formData.preferredTenant}
            onChange={(e) => setFormData((prev) => ({ ...prev, preferredTenant: e.target.value }))}
          />
        </div>

        {/* Media: Photos Upload */}
        <div className="space-y-2">
          <label className="block text-xs font-semibold text-slate-700">Property Photos</label>
          <div className="flex flex-wrap gap-2 items-center">
            {formData.images.map((img, idx) => (
              <div key={idx} className="relative h-16 w-16 rounded-lg overflow-hidden border border-slate-200 group">
                <img src={img.url} alt={`Photo ${idx + 1}`} className="h-full w-full object-cover" />
                <button
                  type="button"
                  onClick={() =>
                    setFormData((prev) => ({
                      ...prev,
                      images: prev.images.filter((_, i) => i !== idx),
                    }))
                  }
                  className="absolute inset-0 bg-red-900/60 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}

            <input
              ref={imageInputRef}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={handleImageFileChange}
            />

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => imageInputRef.current?.click()}
              disabled={isUploadingImage}
              leftIcon={isUploadingImage ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
            >
              {isUploadingImage ? 'Uploading...' : 'Add Photos'}
            </Button>
          </div>
        </div>

        {/* Description */}
        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">
            Rental Description & Key Features
          </label>
          <textarea
            rows={3}
            placeholder="Highlight amenities, floor number, parking, maintenance terms..."
            value={formData.description}
            onChange={(e) => setFormData((prev) => ({ ...prev, description: e.target.value }))}
            className="w-full rounded-lg border border-slate-300 p-2.5 text-xs text-slate-800 focus:border-blue-500 focus:outline-none"
          />
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button type="submit" isLoading={isSubmitting} disabled={isSubmitting}>
            {isEdit ? 'Save Changes' : 'List Rental Property'}
          </Button>
        </DialogFooter>
      </form>
    </Dialog>
  );
}

