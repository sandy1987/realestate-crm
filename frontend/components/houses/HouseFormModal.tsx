'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Dialog, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/Dialog';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import {
  Plot,
  CreatePlotInput,
  UpdatePlotInput,
  PlotSizeUnit,
  PlotStatus,
  PlotImage,
  PlotVideo,
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
  Home,
  Building,
} from 'lucide-react';

export interface HouseFormModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  plot?: Plot | null;
  onSuccess: () => void;
}

export const HOUSE_TYPES = [
  'Flat / Apartment',
  'Independent House / Kothi',
  'Villa',
  'Duplex House',
  'Builder Floor',
  'Penthouse',
  'Studio / 1 RK',
  'Row House / Bungalow',
];

export const BHK_OPTIONS = [
  '1 BHK',
  '2 BHK',
  '3 BHK',
  '4 BHK',
  '5+ BHK',
  'Studio / 1 RK',
  'Duplex Kothi',
];

export const CONSTRUCTION_STATUSES = [
  'Ready to Move (Brand New)',
  'Ready to Move (Resale)',
  'Under Construction (Possession Soon)',
];

export const PARKING_OPTIONS = [
  '1 Covered Car Parking',
  '2 Covered Cars Parking',
  'Open / Stilt Parking',
  'Two-Wheeler Only',
  'Street Parking',
  'None',
];

export const FACING_OPTIONS = [
  'East (Most Preferred)',
  'North',
  'North-East',
  'West',
  'South',
  'North-West',
  'South-East',
  'South-West',
];

interface FormState {
  plotRef: string;
  colonyId: string;
  houseType: string;
  bhk: string;
  societyName: string;
  size: string; // built-up / total size
  sizeUnit: PlotSizeUnit;
  plotArea: string;
  floorNo: string;
  totalFloors: string;
  bathrooms: string;
  balconies: string;
  furnishing: string;
  parking: string;
  lift: string; // 'yes' | 'no'
  constructionStatus: string;
  facing: string;
  rate: string;
  status: PlotStatus;
  description: string;
  images: PlotImage[];
  videoUrl: string;
  videoProvider: 'youtube' | 'vimeo' | 'cloudinary' | '';
}

const initialFormState: FormState = {
  plotRef: '',
  colonyId: '',
  houseType: 'Flat / Apartment',
  bhk: '2 BHK',
  societyName: '',
  size: '',
  sizeUnit: 'sqft',
  plotArea: '',
  floorNo: '',
  totalFloors: '',
  bathrooms: '2',
  balconies: '1',
  furnishing: 'unfurnished',
  parking: '1 Covered Car Parking',
  lift: 'yes',
  constructionStatus: 'Ready to Move (Brand New)',
  facing: 'East (Most Preferred)',
  rate: '',
  status: 'available',
  description: '',
  images: [],
  videoUrl: '',
  videoProvider: '',
};

export function HouseFormModal({ open, onOpenChange, plot, onSuccess }: HouseFormModalProps) {
  const isEdit = Boolean(plot);
  const [formData, setFormData] = useState<FormState>(initialFormState);
  const [colonies, setColonies] = useState<Colony[]>([]);
  const [isLoadingColonies, setIsLoadingColonies] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [generalError, setGeneralError] = useState<string | null>(null);

  // Upload states
  const [isUploadingImages, setIsUploadingImages] = useState(false);
  const [isUploadingVideo, setIsUploadingVideo] = useState(false);
  const [videoMode, setVideoMode] = useState<'upload' | 'url'>('upload');
  const imageInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setIsLoadingColonies(true);
      coloniesApi
        .listColonies({ limit: 100, sortBy: 'name', sortOrder: 'asc' })
        .then((res) => setColonies(res.data))
        .catch(() => setColonies([]))
        .finally(() => setIsLoadingColonies(false));
    }
  }, [open]);

  useEffect(() => {
    if (plot) {
      setFormData({
        plotRef: plot.plotRef || plot.plotId || '',
        colonyId: plot.colonyId || '',
        houseType: plot.houseType || 'Flat / Apartment',
        bhk: plot.bhk || '2 BHK',
        societyName: plot.societyName || '',
        size: plot.size ? String(plot.size) : '',
        sizeUnit: plot.sizeUnit || 'sqft',
        plotArea: plot.plotArea ? String(plot.plotArea) : '',
        floorNo: plot.floorNo || '',
        totalFloors: plot.totalFloors ? String(plot.totalFloors) : '',
        bathrooms: plot.bathrooms !== null && plot.bathrooms !== undefined ? String(plot.bathrooms) : '2',
        balconies: plot.balconies !== null && plot.balconies !== undefined ? String(plot.balconies) : '1',
        furnishing: plot.furnishing || 'unfurnished',
        parking: plot.parking || '1 Covered Car Parking',
        lift: plot.lift === false ? 'no' : 'yes',
        constructionStatus: plot.constructionStatus || 'Ready to Move (Brand New)',
        facing: plot.facing || 'East (Most Preferred)',
        rate: plot.rate ? String(plot.rate) : '',
        status: plot.status || 'available',
        description: plot.description || '',
        images: plot.images || [],
        videoUrl: plot.videoUrl || plot.video?.url || '',
        videoProvider: (plot.videoProvider || plot.video?.provider || '') as any,
      });
      setVideoMode(plot.video?.provider === 'cloudinary' ? 'upload' : 'url');
    } else {
      setFormData(initialFormState);
      setVideoMode('upload');
    }
    setErrors({});
    setGeneralError(null);
  }, [plot, open]);

  const isFlatType =
    formData.houseType.includes('Flat') ||
    formData.houseType.includes('Builder Floor') ||
    formData.houseType.includes('Penthouse') ||
    formData.houseType.includes('Studio');

  // Handle Multi-Image Upload
  const handleImageFiles = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setIsUploadingImages(true);
    setGeneralError(null);

    try {
      const fileList = Array.from(files);
      const results = await mediaApi.uploadFiles(fileList);
      const uploadedList = Array.isArray(results) ? results : [results];

      const newImages: PlotImage[] = uploadedList.map((item, idx) => ({
        url: item.secure_url || item.url,
        publicId: item.publicId,
        order: formData.images.length + idx,
      }));

      setFormData((prev) => ({
        ...prev,
        images: [...prev.images, ...newImages],
      }));
    } catch (err: any) {
      setGeneralError(err?.message || 'Failed to upload images. Please check your network or Cloudinary storage.');
    } finally {
      setIsUploadingImages(false);
      if (imageInputRef.current) imageInputRef.current.value = '';
    }
  };

  const handleRemoveImage = (index: number) => {
    setFormData((prev) => ({
      ...prev,
      images: prev.images.filter((_, i) => i !== index),
    }));
  };

  // Handle Video Upload
  const handleVideoFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 100 * 1024 * 1024) {
      setGeneralError('Video size exceeds 100MB limit.');
      return;
    }

    setIsUploadingVideo(true);
    setGeneralError(null);

    try {
      const uploaded = await mediaApi.uploadVideo(file);

      setFormData((prev) => ({
        ...prev,
        videoUrl: uploaded.secure_url || uploaded.url,
        videoProvider: 'cloudinary',
      }));
    } catch (err: any) {
      setGeneralError(err?.message || 'Failed to upload video walkthrough.');
    } finally {
      setIsUploadingVideo(false);
      if (videoInputRef.current) videoInputRef.current.value = '';
    }
  };

  const validate = (): boolean => {
    const errs: Record<string, string> = {};
    if (!formData.plotRef.trim()) errs.plotRef = 'House / Flat number or reference is required';
    if (!formData.size || isNaN(Number(formData.size)) || Number(formData.size) <= 0) {
      errs.size = 'Valid built-up area is required';
    }
    if (!formData.rate.trim()) errs.rate = 'Total asking price is required';

    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setGeneralError(null);
    if (!validate()) return;

    setIsSubmitting(true);
    try {
      const numRate = Number(formData.rate);
      const parsedRate = isNaN(numRate) ? formData.rate.trim() : numRate;

      const payload = {
        plotRef: formData.plotRef.trim(),
        colonyId: formData.colonyId || null,
        category: 'house' as const,
        houseType: formData.houseType,
        bhk: formData.bhk,
        societyName: formData.societyName.trim() || null,
        size: Number(formData.size),
        sizeUnit: formData.sizeUnit,
        plotArea: formData.plotArea ? Number(formData.plotArea) : null,
        floorNo: formData.floorNo.trim() || null,
        totalFloors: formData.totalFloors ? Number(formData.totalFloors) : null,
        bathrooms: formData.bathrooms ? Number(formData.bathrooms) : null,
        balconies: formData.balconies ? Number(formData.balconies) : null,
        furnishing: (formData.furnishing || null) as any,
        parking: formData.parking || null,
        lift: isFlatType ? formData.lift === 'yes' : null,
        constructionStatus: formData.constructionStatus || null,
        facing: formData.facing || null,
        rate: parsedRate,
        rateType: 'total' as const,
        status: formData.status,
        description: formData.description.trim() || null,
        images: formData.images,
        videoUrl: formData.videoUrl.trim() || null,
        videoProvider: formData.videoUrl.trim()
          ? ((formData.videoProvider as any) || (formData.videoUrl.includes('cloudinary') ? 'cloudinary' : 'youtube'))
          : null,
      };

      if (isEdit && plot) {
        await plotsApi.updatePlot(plot.id, payload as UpdatePlotInput);
      } else {
        await plotsApi.createPlot(payload as CreatePlotInput);
      }

      onSuccess();
      onOpenChange(false);
    } catch (err) {
      if (err instanceof ApiClientError) {
        setGeneralError(err.message);
      } else {
        setGeneralError('Failed to save house/flat listing.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogHeader>
        <div className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-100 text-blue-700">
            <Home className="h-5 w-5" />
          </div>
          <div>
            <DialogTitle className="text-base font-bold text-slate-900">
              {isEdit ? 'Edit House / Flat Listing' : 'Register New House / Flat'}
            </DialogTitle>
            <DialogDescription className="text-xs">
              Add ready-made residential homes, independent houses, villas, or society flats for sale.
            </DialogDescription>
          </div>
        </div>
      </DialogHeader>

      <form onSubmit={handleSubmit} className="space-y-4 my-2 text-xs">
        {generalError && (
          <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700">
            <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
            <span>{generalError}</span>
          </div>
        )}

        {/* Row 1: Subtype & BHK Configuration */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-blue-50/50 p-3 rounded-xl border border-blue-100">
          <div>
            <label className="block text-xs font-semibold text-slate-800 mb-1">
              Property Sub-Type *
            </label>
            <select
              value={formData.houseType}
              onChange={(e) => setFormData((prev) => ({ ...prev, houseType: e.target.value }))}
              className="h-9 w-full rounded-lg border border-slate-300 bg-white px-3 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium"
            >
              {HOUSE_TYPES.map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-800 mb-1">
              BHK Configuration *
            </label>
            <select
              value={formData.bhk}
              onChange={(e) => setFormData((prev) => ({ ...prev, bhk: e.target.value }))}
              className="h-9 w-full rounded-lg border border-slate-300 bg-white px-3 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium"
            >
              {BHK_OPTIONS.map((bhk) => (
                <option key={bhk} value={bhk}>
                  {bhk}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Row 2: Reference & Colony / Sector */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Input
            label="House / Flat No. or Reference *"
            placeholder="e.g. Flat 402, House #14, Villa A-3"
            value={formData.plotRef}
            onChange={(e) => setFormData((prev) => ({ ...prev, plotRef: e.target.value }))}
            error={errors.plotRef}
            required
          />

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Colony / Sector Development
            </label>
            <select
              value={formData.colonyId}
              onChange={(e) => setFormData((prev) => ({ ...prev, colonyId: e.target.value }))}
              disabled={isLoadingColonies}
              className="h-9 w-full rounded-lg border border-slate-300 bg-white px-3 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
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

        {/* Row 3: Society Name & Floor Details */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Society / Building / Project
            </label>
            <Input
              placeholder={isFlatType ? 'e.g. Silver Springs Heights' : 'e.g. Omaxe City Enclave (Optional)'}
              value={formData.societyName}
              onChange={(e) => setFormData((prev) => ({ ...prev, societyName: e.target.value }))}
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Floor / Storey
            </label>
            <Input
              placeholder={isFlatType ? 'e.g. 4th Floor' : 'e.g. G+1 Double Storey'}
              value={formData.floorNo}
              onChange={(e) => setFormData((prev) => ({ ...prev, floorNo: e.target.value }))}
            />
          </div>

          {isFlatType ? (
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Total Floors in Building
              </label>
              <Input
                type="number"
                placeholder="e.g. 7"
                value={formData.totalFloors}
                onChange={(e) => setFormData((prev) => ({ ...prev, totalFloors: e.target.value }))}
              />
            </div>
          ) : (
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Plot Land Area (Optional)
              </label>
              <Input
                type="number"
                placeholder="e.g. 100 (in sq.yd)"
                value={formData.plotArea}
                onChange={(e) => setFormData((prev) => ({ ...prev, plotArea: e.target.value }))}
              />
            </div>
          )}
        </div>

        {/* Row 4: Built-up Area & Asking Price */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Built-up / Carpet Area *
            </label>
            <Input
              type="number"
              placeholder="e.g. 1450"
              value={formData.size}
              onChange={(e) => setFormData((prev) => ({ ...prev, size: e.target.value }))}
              error={errors.size}
              required
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Area Unit</label>
            <select
              value={formData.sizeUnit}
              onChange={(e) => setFormData((prev) => ({ ...prev, sizeUnit: e.target.value as PlotSizeUnit }))}
              className="h-9 w-full rounded-lg border border-slate-300 bg-white px-3 text-xs text-slate-800 focus:outline-none"
            >
              <option value="sqft">sq.ft</option>
              <option value="sqyd">sq.yd</option>
              <option value="sqm">sq.m</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Total Sale Price (₹) *
            </label>
            <Input
              placeholder="e.g. 6500000, 1.25 Cr"
              value={formData.rate}
              onChange={(e) => setFormData((prev) => ({ ...prev, rate: e.target.value }))}
              error={errors.rate}
              required
            />
          </div>
        </div>

        {/* Row 5: Bathrooms, Balconies, Furnishing */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Bathrooms</label>
            <select
              value={formData.bathrooms}
              onChange={(e) => setFormData((prev) => ({ ...prev, bathrooms: e.target.value }))}
              className="h-9 w-full rounded-lg border border-slate-300 bg-white px-3 text-xs text-slate-800 focus:outline-none"
            >
              <option value="1">1 Bathroom</option>
              <option value="2">2 Bathrooms</option>
              <option value="3">3 Bathrooms</option>
              <option value="4">4 Bathrooms</option>
              <option value="5">5+ Bathrooms</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Balconies</label>
            <select
              value={formData.balconies}
              onChange={(e) => setFormData((prev) => ({ ...prev, balconies: e.target.value }))}
              className="h-9 w-full rounded-lg border border-slate-300 bg-white px-3 text-xs text-slate-800 focus:outline-none"
            >
              <option value="0">0 (No Balcony)</option>
              <option value="1">1 Balcony</option>
              <option value="2">2 Balconies</option>
              <option value="3">3 Balconies</option>
              <option value="4">4+ Balconies</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Furnishing</label>
            <select
              value={formData.furnishing}
              onChange={(e) => setFormData((prev) => ({ ...prev, furnishing: e.target.value }))}
              className="h-9 w-full rounded-lg border border-slate-300 bg-white px-3 text-xs text-slate-800 focus:outline-none"
            >
              <option value="unfurnished">Unfurnished</option>
              <option value="semi_furnished">Semi-Furnished</option>
              <option value="fully_furnished">Fully-Furnished</option>
            </select>
          </div>
        </div>

        {/* Row 6: Parking, Lift, Status */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Parking</label>
            <select
              value={formData.parking}
              onChange={(e) => setFormData((prev) => ({ ...prev, parking: e.target.value }))}
              className="h-9 w-full rounded-lg border border-slate-300 bg-white px-3 text-xs text-slate-800 focus:outline-none"
            >
              {PARKING_OPTIONS.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </div>

          {isFlatType ? (
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Lift Facility</label>
              <select
                value={formData.lift}
                onChange={(e) => setFormData((prev) => ({ ...prev, lift: e.target.value }))}
                className="h-9 w-full rounded-lg border border-slate-300 bg-white px-3 text-xs text-slate-800 focus:outline-none"
              >
                <option value="yes">Yes (Lift Available)</option>
                <option value="no">No Lift</option>
              </select>
            </div>
          ) : (
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Facing / Vastu</label>
              <select
                value={formData.facing}
                onChange={(e) => setFormData((prev) => ({ ...prev, facing: e.target.value }))}
                className="h-9 w-full rounded-lg border border-slate-300 bg-white px-3 text-xs text-slate-800 focus:outline-none"
              >
                {FACING_OPTIONS.map((f) => (
                  <option key={f} value={f}>
                    {f}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Inventory Status</label>
            <select
              value={formData.status}
              onChange={(e) => setFormData((prev) => ({ ...prev, status: e.target.value as PlotStatus }))}
              className="h-9 w-full rounded-lg border border-slate-300 bg-white px-3 text-xs text-slate-800 focus:outline-none font-medium capitalize"
            >
              <option value="available">Available</option>
              <option value="reserved">Reserved</option>
              <option value="sold">Sold</option>
              <option value="on_hold">On Hold</option>
            </select>
          </div>
        </div>

        {/* Row 7: Construction Status & Facing (if Flat) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Construction Status</label>
            <select
              value={formData.constructionStatus}
              onChange={(e) => setFormData((prev) => ({ ...prev, constructionStatus: e.target.value }))}
              className="h-9 w-full rounded-lg border border-slate-300 bg-white px-3 text-xs text-slate-800 focus:outline-none"
            >
              {CONSTRUCTION_STATUSES.map((cs) => (
                <option key={cs} value={cs}>
                  {cs}
                </option>
              ))}
            </select>
          </div>

          {isFlatType && (
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Facing / Vastu</label>
              <select
                value={formData.facing}
                onChange={(e) => setFormData((prev) => ({ ...prev, facing: e.target.value }))}
                className="h-9 w-full rounded-lg border border-slate-300 bg-white px-3 text-xs text-slate-800 focus:outline-none"
              >
                {FACING_OPTIONS.map((f) => (
                  <option key={f} value={f}>
                    {f}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        {/* Media: Photos (Cloudinary Upload) */}
        <div className="space-y-2 border-t border-slate-100 pt-3">
          <div className="flex items-center justify-between">
            <span className="font-semibold text-slate-700 flex items-center gap-1.5">
              <ImageIcon className="h-4 w-4 text-blue-600" />
              House / Flat Photos ({formData.images.length})
            </span>
            <span className="text-[10px] text-slate-400">Cloudinary Upload</span>
          </div>

          {/* Upload Button */}
          <div className="flex items-center gap-2">
            <input
              type="file"
              ref={imageInputRef}
              multiple
              accept="image/*"
              onChange={handleImageFiles}
              className="hidden"
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={isUploadingImages}
              onClick={() => imageInputRef.current?.click()}
              className="w-full border-dashed border-slate-300 hover:border-blue-500 py-3"
            >
              {isUploadingImages ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin text-blue-600" />
                  Uploading Photos to Cloudinary...
                </>
              ) : (
                <>
                  <Upload className="h-4 w-4 mr-2 text-slate-500" />
                  Click to Upload Property Photos (JPG, PNG, WEBP)
                </>
              )}
            </Button>
          </div>

          {/* Thumbnails */}
          {formData.images.length > 0 && (
            <div className="grid grid-cols-4 sm:grid-cols-6 gap-2 pt-2">
              {formData.images.map((img, idx) => (
                <div
                  key={idx}
                  className="relative group aspect-square rounded-lg overflow-hidden border border-slate-200 bg-slate-100"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={img.url} alt={`Photo ${idx + 1}`} className="w-full h-full object-cover" />
                  <button
                    type="button"
                    onClick={() => handleRemoveImage(idx)}
                    className="absolute top-1 right-1 p-1 bg-red-600 text-white rounded opacity-0 group-hover:opacity-100 transition-opacity"
                    title="Remove image"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Media: Video Walkthrough */}
        <div className="space-y-2 border-t border-slate-100 pt-3">
          <div className="flex items-center justify-between">
            <span className="font-semibold text-slate-700 flex items-center gap-1.5">
              <Film className="h-4 w-4 text-purple-600" />
              Video Tour / Walkthrough
            </span>
            <div className="flex gap-1 bg-slate-100 p-0.5 rounded-lg text-[10px]">
              <button
                type="button"
                onClick={() => setVideoMode('upload')}
                className={`px-2 py-0.5 rounded ${
                  videoMode === 'upload' ? 'bg-purple-600 text-white font-semibold' : 'text-slate-600'
                }`}
              >
                Upload Video
              </button>
              <button
                type="button"
                onClick={() => setVideoMode('url')}
                className={`px-2 py-0.5 rounded ${
                  videoMode === 'url' ? 'bg-purple-600 text-white font-semibold' : 'text-slate-600'
                }`}
              >
                External Link
              </button>
            </div>
          </div>

          {videoMode === 'upload' ? (
            <div>
              <input
                type="file"
                ref={videoInputRef}
                accept="video/mp4,video/quicktime,video/webm"
                onChange={handleVideoFile}
                className="hidden"
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={isUploadingVideo}
                onClick={() => videoInputRef.current?.click()}
                className="w-full border-dashed border-slate-300 hover:border-purple-500 py-3 text-xs"
              >
                {isUploadingVideo ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin text-purple-600" />
                    Uploading Video Walkthrough...
                  </>
                ) : formData.videoUrl && formData.videoProvider === 'cloudinary' ? (
                  <>
                    <CheckCircle2 className="h-4 w-4 mr-2 text-emerald-600" />
                    Video Uploaded! Click to Replace
                  </>
                ) : (
                  <>
                    <VideoIcon className="h-4 w-4 mr-2 text-slate-500" />
                    Upload Video File (MP4, MOV, WEBM up to 100MB)
                  </>
                )}
              </Button>
            </div>
          ) : (
            <Input
              placeholder="Paste YouTube or Vimeo video link (e.g. https://youtu.be/...)"
              value={formData.videoUrl}
              onChange={(e) =>
                setFormData((prev) => ({
                  ...prev,
                  videoUrl: e.target.value,
                  videoProvider: e.target.value.includes('vimeo') ? 'vimeo' : 'youtube',
                }))
              }
            />
          )}
        </div>

        {/* Description / Public Marketing Notes */}
        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">
            Marketing Highlights / Specifications
          </label>
          <textarea
            rows={3}
            placeholder="Key selling points: Modular kitchen, Italian marble flooring, 24/7 security, club house access, nearby schools..."
            value={formData.description}
            onChange={(e) => setFormData((prev) => ({ ...prev, description: e.target.value }))}
            className="w-full rounded-lg border border-slate-300 p-2.5 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <DialogFooter className="mt-4 border-t border-slate-100 pt-3">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="submit" isLoading={isSubmitting} disabled={isSubmitting}>
            {isEdit ? 'Update Listing' : 'Register House / Flat'}
          </Button>
        </DialogFooter>
      </form>
    </Dialog>
  );
}

