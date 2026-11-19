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
  PlotRateType,
  PlotStatus,
  PlotImage,
  PlotVideo,
  AgriListingType,
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
  Sprout,
  Droplets,
} from 'lucide-react';

export interface AgriFormModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  plot?: Plot | null;
  onSuccess: () => void;
}

const AGRI_SIZE_UNITS: PlotSizeUnit[] = ['acre', 'bigha', 'marla', 'kanal', 'gaj', 'sqyd', 'sqft', 'sqm'];

const WATER_SOURCES = [
  'Canal Water (Nahar)',
  'Borewell / Submersible',
  'Tube well Connection',
  'River / Pond Proximity',
  'Rainfed (Barani)',
  'None / Unspecified',
];

const ROAD_ACCESS_OPTIONS = [
  'National / State Highway Facing',
  'Tar / Pucca Road Facing',
  'Kacha Road / Tractor Path',
  'Shared Field Passage',
];

interface FormState {
  plotRef: string;
  listingType: AgriListingType;
  colonyId: string;
  size: string;
  sizeUnit: PlotSizeUnit;
  dimensions: string;
  rate: string;
  rateType: PlotRateType;
  waterSource: string;
  roadAccess: string;
  electricity: string;
  fencing: string;
  soilType: string;
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
  listingType: 'sale',
  colonyId: '',
  size: '',
  sizeUnit: 'acre',
  dimensions: '',
  rate: '',
  rateType: 'total',
  waterSource: 'Canal Water (Nahar)',
  roadAccess: 'Tar / Pucca Road Facing',
  electricity: '3-Phase Agri Power',
  fencing: 'Boundary Fenced',
  soilType: 'Agricultural Grade Soil',
  status: 'available',
  description: '',
  images: [],
  videoSourceType: 'upload',
  videoUrl: '',
  video: null,
  isActive: true,
};

export function AgriFormModal({ open, onOpenChange, plot, onSuccess }: AgriFormModalProps) {
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
      setFormData({
        plotRef: plot.plotRef || plot.plotId || '',
        listingType: plot.listingType || 'sale',
        colonyId: plot.colonyId || '',
        size: String(plot.size ?? ''),
        sizeUnit: plot.sizeUnit || 'acre',
        dimensions: plot.dimensions || '',
        rate: String(plot.rate ?? ''),
        rateType: plot.rateType || 'total',
        waterSource: plot.waterSource || 'Canal Water (Nahar)',
        roadAccess: plot.roadAccess || 'Tar / Pucca Road Facing',
        electricity: plot.electricity || '',
        fencing: plot.fencing || '',
        soilType: plot.soilType || '',
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
    if (!formData.plotRef.trim()) errs.plotRef = 'Land reference / code is required';
    if (!formData.rate.trim()) errs.rate = 'Price / Lease rate is required';
    if (!formData.size.trim()) {
      errs.size = 'Land area / size is required';
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
          category: 'agricultural',
          listingType: formData.listingType,
          rate: finalRate,
          rateType: formData.rateType,
          colonyId: formData.colonyId || null,
          size: parsedSize,
          sizeUnit: formData.sizeUnit,
          dimensions: formData.dimensions.trim() || null,
          waterSource: formData.waterSource.trim() || null,
          roadAccess: formData.roadAccess.trim() || null,
          electricity: formData.electricity.trim() || null,
          fencing: formData.fencing.trim() || null,
          soilType: formData.soilType.trim() || null,
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
          category: 'agricultural',
          listingType: formData.listingType,
          rate: finalRate,
          rateType: formData.rateType,
          colonyId: formData.colonyId || null,
          size: parsedSize,
          sizeUnit: formData.sizeUnit,
          dimensions: formData.dimensions.trim() || null,
          waterSource: formData.waterSource.trim() || null,
          roadAccess: formData.roadAccess.trim() || null,
          electricity: formData.electricity.trim() || null,
          fencing: formData.fencing.trim() || null,
          soilType: formData.soilType.trim() || null,
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
        setGeneralError(err.message || 'Validation error while saving agricultural land');
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
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-100 text-amber-900">
            <Sprout className="h-4 w-4" />
          </div>
          <div>
            <DialogTitle>{isEdit ? 'Edit Agricultural Land' : 'Register Agricultural Land'}</DialogTitle>
            <DialogDescription>
              {isEdit
                ? 'Update farmland listing specifications, irrigation, and ownership details.'
                : 'Add a new agricultural property for sale or lease/rent with rural attributes.'}
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
        {/* Row 1: Purpose & Code */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Listing Purpose *</label>
            <select
              value={formData.listingType}
              onChange={(e) => setFormData((prev) => ({ ...prev, listingType: e.target.value as AgriListingType }))}
              className="h-9 w-full rounded-lg border border-slate-300 bg-white px-3 text-xs font-bold text-slate-800 focus:outline-none"
            >
              <option value="sale">For Sale (Outright Purchase)</option>
              <option value="lease">For Rent / Lease (Theka / Annual)</option>
            </select>
          </div>

          <Input
            id="agri-ref"
            label="Land Identifier / Code *"
            placeholder="e.g. AGRI-FARM-05"
            value={formData.plotRef}
            onChange={(e) => setFormData((prev) => ({ ...prev, plotRef: e.target.value }))}
            error={errors.plotRef}
            autoFocus
          />

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Village / Region / Colony</label>
            <select
              value={formData.colonyId}
              onChange={(e) => setFormData((prev) => ({ ...prev, colonyId: e.target.value }))}
              className="h-9 w-full rounded-lg border border-slate-300 bg-white px-3 text-xs text-slate-800 focus:outline-none"
            >
              <option value="">(None / Direct Village Land)</option>
              {colonies.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} {c.city ? `(${c.city})` : ''}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Row 2: Land Area, Unit, Dimensions, Status */}
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
          <Input
            id="agri-size"
            label="Land Area *"
            placeholder="e.g. 5"
            value={formData.size}
            onChange={(e) => setFormData((prev) => ({ ...prev, size: e.target.value }))}
            error={errors.size}
          />

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Area Unit</label>
            <select
              value={formData.sizeUnit}
              onChange={(e) => setFormData((prev) => ({ ...prev, sizeUnit: e.target.value as PlotSizeUnit }))}
              className="h-9 w-full rounded-lg border border-slate-300 bg-white px-2.5 text-xs font-semibold text-slate-800 focus:outline-none"
            >
              {AGRI_SIZE_UNITS.map((u) => (
                <option key={u} value={u}>
                  {u.toUpperCase()}
                </option>
              ))}
            </select>
          </div>

          <Input
            id="agri-dimensions"
            label="Frontage / Dimensions"
            placeholder="e.g. 200ft Road Front"
            value={formData.dimensions}
            onChange={(e) => setFormData((prev) => ({ ...prev, dimensions: e.target.value }))}
          />

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Status</label>
            <select
              value={formData.status}
              onChange={(e) => setFormData((prev) => ({ ...prev, status: e.target.value as PlotStatus }))}
              className="h-9 w-full rounded-lg border border-slate-300 bg-white px-2.5 text-xs text-slate-800 focus:outline-none"
            >
              <option value="available">Available</option>
              <option value="reserved">Reserved / Token Given</option>
              <option value="on_hold">On Hold</option>
              <option value="sold">{formData.listingType === 'sale' ? 'Sold' : 'Leased Out'}</option>
            </select>
          </div>
        </div>

        {/* Row 3: Pricing & Pricing Model */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Input
            id="agri-rate"
            label={formData.listingType === 'sale' ? 'Sale Price *' : 'Lease Rate (Rent) *'}
            placeholder={formData.listingType === 'sale' ? 'e.g. 45 Lakh/Acre or 2.5 Crore' : 'e.g. 80000/yr or 15000/mo'}
            value={formData.rate}
            onChange={(e) => setFormData((prev) => ({ ...prev, rate: e.target.value }))}
            error={errors.rate}
          />

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Pricing Model</label>
            <select
              value={formData.rateType}
              onChange={(e) => setFormData((prev) => ({ ...prev, rateType: e.target.value as PlotRateType }))}
              className="h-9 w-full rounded-lg border border-slate-300 bg-white px-3 text-xs text-slate-800 focus:outline-none"
            >
              <option value="total">Lump Sum Total</option>
              <option value="per_unit">Rate Per Unit (Per Acre/Bigha)</option>
            </select>
          </div>
        </div>

        {/* Row 4: Water Source & Road Access */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Water / Irrigation Facility</label>
            <select
              value={formData.waterSource}
              onChange={(e) => setFormData((prev) => ({ ...prev, waterSource: e.target.value }))}
              className="h-9 w-full rounded-lg border border-slate-300 bg-white px-3 text-xs text-slate-800 focus:outline-none"
            >
              {WATER_SOURCES.map((w) => (
                <option key={w} value={w}>
                  {w}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Road Connectivity</label>
            <select
              value={formData.roadAccess}
              onChange={(e) => setFormData((prev) => ({ ...prev, roadAccess: e.target.value }))}
              className="h-9 w-full rounded-lg border border-slate-300 bg-white px-3 text-xs text-slate-800 focus:outline-none"
            >
              {ROAD_ACCESS_OPTIONS.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Row 5: Electricity, Fencing, Soil Type */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Input
            id="agri-electricity"
            label="Electricity / Power"
            placeholder="e.g. 3-Phase Tubewell Meter, Solar"
            value={formData.electricity}
            onChange={(e) => setFormData((prev) => ({ ...prev, electricity: e.target.value }))}
          />

          <Input
            id="agri-fencing"
            label="Fencing / Boundary"
            placeholder="e.g. Barbed Wire, Pole Fencing"
            value={formData.fencing}
            onChange={(e) => setFormData((prev) => ({ ...prev, fencing: e.target.value }))}
          />

          <Input
            id="agri-soil"
            label="Soil Type"
            placeholder="e.g. Fertile Alluvial, Black Soil"
            value={formData.soilType}
            onChange={(e) => setFormData((prev) => ({ ...prev, soilType: e.target.value }))}
          />
        </div>

        {/* Media: Photos Upload */}
        <div className="space-y-2">
          <label className="block text-xs font-semibold text-slate-700">Land & Boundary Photos</label>
          <div className="flex flex-wrap gap-2 items-center">
            {formData.images.map((img, idx) => (
              <div key={idx} className="relative h-16 w-16 rounded-lg overflow-hidden border border-slate-200 group">
                <img src={img.url} alt={`Land photo ${idx + 1}`} className="h-full w-full object-cover" />
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
              {isUploadingImage ? 'Uploading...' : 'Add Land Photos'}
            </Button>
          </div>
        </div>

        {/* Description */}
        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">
            Agricultural Highlights & Notes
          </label>
          <textarea
            rows={3}
            placeholder="Khasra/Killa details, crop history, distance from nearest mandi/highway..."
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
            {isEdit ? 'Save Changes' : 'Register Agricultural Land'}
          </Button>
        </DialogFooter>
      </form>
    </Dialog>
  );
}

