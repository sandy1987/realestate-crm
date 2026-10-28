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
  PLOT_RATE_TYPES,
  PLOT_STATUSES,
  PlotSizeUnit,
  PlotRateType,
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
  Link as LinkIcon,
  Film,
  CheckCircle2,
} from 'lucide-react';

export interface PlotFormModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  plot?: Plot | null;
  onSuccess: () => void;
}

interface FormState {
  plotRef: string;
  colonyId: string;
  plotDate: string;
  size: string;
  sizeUnit: PlotSizeUnit;
  rate: string;
  rateType: PlotRateType;
  currency: string;
  status: PlotStatus;
  images: PlotImage[];
  videoUrl: string;
  video: PlotVideo | null;
  videoSourceType: 'upload' | 'url';
  description: string;
  isActive: boolean;
}

function getInitialPlotFormState(plot?: Plot | null): FormState {
  if (plot) {
    let dateString = '';
    if (plot.plotDate) {
      try {
        dateString = new Date(plot.plotDate).toISOString().split('T')[0];
      } catch {
        dateString = '';
      }
    }
    const hasUploadedVideo = plot.video?.provider === 'cloudinary';
    return {
      plotRef: plot.plotRef || plot.plotId || '',
      colonyId: plot.colonyId || '',
      plotDate: dateString,
      size: String(plot.size ?? ''),
      sizeUnit: plot.sizeUnit || 'sqyd',
      rate: String(plot.rate ?? ''),
      rateType: plot.rateType || 'total',
      currency: plot.currency || 'INR',
      status: plot.status || 'available',
      images: Array.isArray(plot.images) ? plot.images : [],
      videoUrl: plot.videoUrl || plot.video?.url || '',
      video: plot.video || (plot.videoUrl ? { url: plot.videoUrl, provider: plot.videoProvider || null } : null),
      videoSourceType: hasUploadedVideo ? 'upload' : 'url',
      description: plot.description || '',
      isActive: plot.isActive ?? true,
    };
  }
  return {
    plotRef: '',
    colonyId: '',
    plotDate: '',
    size: '',
    sizeUnit: 'sqyd',
    rate: '',
    rateType: 'total',
    currency: 'INR',
    status: 'available',
    images: [],
    videoUrl: '',
    video: null,
    videoSourceType: 'upload',
    description: '',
    isActive: true,
  };
}

export function PlotFormModal({ open, onOpenChange, plot, onSuccess }: PlotFormModalProps) {
  const isEditing = Boolean(plot);
  const [formData, setFormData] = useState<FormState>(() => getInitialPlotFormState(plot));
  const [colonies, setColonies] = useState<Colony[]>([]);
  const [isLoadingColonies, setIsLoadingColonies] = useState(true);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [generalError, setGeneralError] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [isUploadingImages, setIsUploadingImages] = useState(false);
  const [isUploadingVideo, setIsUploadingVideo] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const imageInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);

  // Sync form state when modal opens or plot prop updates
  useEffect(() => {
    if (open) {
      setFormData(getInitialPlotFormState(plot));
      setErrors({});
      setGeneralError(null);
      setUploadError(null);
    }
  }, [open, plot]);

  // Load colonies list for dropdown asynchronously
  useEffect(() => {
    let isMounted = true;
    coloniesApi
      .listColonies({ isActive: 'true', limit: 100 })
      .then((res) => {
        if (isMounted) {
          setColonies(res.data);
          setIsLoadingColonies(false);
        }
      })
      .catch(() => {
        if (isMounted) {
          setIsLoadingColonies(false);
        }
      });
    return () => {
      isMounted = false;
    };
  }, []);

  // Multi-image upload handler
  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files ? Array.from(e.target.files) : [];
    if (files.length === 0) return;

    setIsUploadingImages(true);
    setUploadError(null);

    try {
      const uploaded = await mediaApi.uploadFiles(files);
      const newImages: PlotImage[] = uploaded.map((item, idx) => ({
        url: item.secure_url || item.url,
        publicId: item.publicId,
        order: formData.images.length + idx,
      }));

      setFormData((prev) => ({
        ...prev,
        images: [...prev.images, ...newImages],
      }));
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to upload images';
      setUploadError(msg);
    } finally {
      setIsUploadingImages(false);
      if (imageInputRef.current) {
        imageInputRef.current.value = '';
      }
    }
  };

  const handleRemoveImage = (indexToRemove: number) => {
    setFormData((prev) => ({
      ...prev,
      images: prev.images.filter((_, idx) => idx !== indexToRemove),
    }));
  };

  // Video upload handler
  const handleVideoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploadingVideo(true);
    setUploadError(null);

    try {
      const uploaded = await mediaApi.uploadFile(file);
      setFormData((prev) => ({
        ...prev,
        video: {
          url: uploaded.secure_url || uploaded.url,
          provider: 'cloudinary',
          publicId: uploaded.publicId,
        },
        videoUrl: uploaded.secure_url || uploaded.url,
      }));
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to upload video';
      setUploadError(msg);
    } finally {
      setIsUploadingVideo(false);
      if (videoInputRef.current) {
        videoInputRef.current.value = '';
      }
    }
  };

  const handleRemoveVideo = () => {
    setFormData((prev) => ({
      ...prev,
      video: null,
      videoUrl: '',
    }));
  };

  const validate = (): boolean => {
    const errs: Record<string, string> = {};
    const trimmedRef = formData.plotRef.trim();

    if (!trimmedRef) {
      errs.plotRef = 'Plot reference / ID is required';
    } else if (trimmedRef.length > 60) {
      errs.plotRef = 'Plot reference cannot exceed 60 characters';
    }

    const numSize = Number(formData.size);
    if (!formData.size || isNaN(numSize) || numSize <= 0) {
      errs.size = 'Plot size must be a positive number';
    }

    const numRate = Number(formData.rate);
    if (formData.rate === '' || isNaN(numRate) || numRate < 0) {
      errs.rate = 'Rate cannot be negative';
    }

    // Video validation
    if (formData.videoSourceType === 'url' && formData.videoUrl.trim()) {
      try {
        const parsed = new URL(formData.videoUrl.trim());
        if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
          errs.videoUrl = 'Video URL must use HTTP or HTTPS protocol';
        } else {
          const host = parsed.hostname.toLowerCase();
          const allowedHosts = [
            'youtube.com',
            'www.youtube.com',
            'm.youtube.com',
            'youtu.be',
            'vimeo.com',
            'www.vimeo.com',
            'player.vimeo.com',
            'res.cloudinary.com',
            'cloudinary.com',
          ];
          if (!allowedHosts.some((h) => host === h || host.endsWith('.' + h))) {
            errs.videoUrl = 'Video URL must be a valid YouTube, Vimeo, or Cloudinary link';
          }
        }
      } catch {
        errs.videoUrl = 'Malformed video URL format';
      }
    }

    if (formData.description && formData.description.length > 2000) {
      errs.description = 'Description cannot exceed 2000 characters';
    }

    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate() || isSubmitting) return;

    setIsSubmitting(true);
    setGeneralError(null);

    try {
      const parsedSize = Number(formData.size);
      const parsedRate = Number(formData.rate);
      const colonyIdValue = formData.colonyId.trim() || null;
      const plotDateValue = formData.plotDate.trim() ? new Date(formData.plotDate).toISOString() : null;

      let effectiveVideoUrl: string | null = null;
      let effectiveVideoProvider: 'youtube' | 'vimeo' | 'cloudinary' | null = null;
      let effectiveVideo: PlotVideo | null = null;

      if (formData.videoSourceType === 'upload') {
        if (formData.video?.url) {
          effectiveVideoUrl = formData.video.url;
          effectiveVideoProvider = 'cloudinary';
          effectiveVideo = formData.video;
        }
      } else {
        if (formData.videoUrl.trim()) {
          effectiveVideoUrl = formData.videoUrl.trim();
          effectiveVideo = { url: effectiveVideoUrl, provider: null };
        }
      }

      if (isEditing && plot) {
        const payload: UpdatePlotInput = {
          plotRef: formData.plotRef.trim(),
          colonyId: colonyIdValue,
          plotDate: plotDateValue,
          size: parsedSize,
          sizeUnit: formData.sizeUnit,
          rate: parsedRate,
          rateType: formData.rateType,
          currency: formData.currency.trim() || 'INR',
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
          colonyId: colonyIdValue,
          plotDate: plotDateValue,
          size: parsedSize,
          sizeUnit: formData.sizeUnit,
          rate: parsedRate,
          rateType: formData.rateType,
          currency: formData.currency.trim() || 'INR',
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
        if (err.code === 'PLOT_REF_CONFLICT' || err.status === 409) {
          setErrors((prev) => ({
            ...prev,
            plotRef: `Plot reference '${formData.plotRef.trim()}' already exists in your firm`,
          }));
        } else if (err.code === 'INVALID_COLONY') {
          setErrors((prev) => ({
            ...prev,
            colonyId: 'Selected colony does not exist or does not belong to your firm',
          }));
        } else if (err.code === 'INVALID_VIDEO_URL') {
          setErrors((prev) => ({
            ...prev,
            videoUrl: err.message || 'Invalid video URL. Please provide a supported link.',
          }));
        } else {
          setGeneralError(err.message || 'Failed to save plot. Please try again.');
        }
      } else if (err instanceof Error) {
        setGeneralError(err.message);
      } else {
        setGeneralError('An unexpected error occurred. Please try again.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogHeader>
        <DialogTitle>{isEditing ? 'Edit Plot' : 'Register New Plot'}</DialogTitle>
        <DialogDescription>
          {isEditing
            ? 'Update the public inventory details, dimensions, pricing, images, and video tour.'
            : 'Add a new public real estate plot listing with photos and video walkthrough.'}
        </DialogDescription>
      </DialogHeader>

      {generalError && (
        <div className="mb-4 flex items-start gap-2.5 rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-800">
          <AlertCircle className="h-4 w-4 shrink-0 text-red-600 mt-0.5" />
          <span>{generalError}</span>
        </div>
      )}

      {uploadError && (
        <div className="mb-4 flex items-start gap-2.5 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
          <AlertCircle className="h-4 w-4 shrink-0 text-amber-600 mt-0.5" />
          <span>{uploadError}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Row 1: Plot Reference & Colony */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Input
            id="plot-ref"
            label="Plot Reference / Number *"
            placeholder="e.g. PLOT-A104"
            value={formData.plotRef}
            onChange={(e) => {
              setFormData((prev) => ({ ...prev, plotRef: e.target.value }));
              if (errors.plotRef) {
                setErrors((prev) => {
                  const rest = { ...prev };
                  delete rest.plotRef;
                  return rest;
                });
              }
            }}
            error={errors.plotRef}
            maxLength={60}
            required
            autoFocus
          />

          <div className="space-y-1.5">
            <label htmlFor="plot-colony" className="block text-xs font-semibold text-slate-700">
              Colony / Sector Development
            </label>
            <select
              id="plot-colony"
              value={formData.colonyId}
              onChange={(e) => setFormData((prev) => ({ ...prev, colonyId: e.target.value }))}
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 hover:border-slate-400"
            >
              <option value="">(None / Independent Plot)</option>
              {colonies.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} {c.city ? `(${c.city})` : ''}
                </option>
              ))}
            </select>
            {isLoadingColonies && <p className="text-[11px] text-slate-400">Loading colonies...</p>}
            {errors.colonyId && <p className="text-xs text-red-600 font-medium">{errors.colonyId}</p>}
          </div>
        </div>

        {/* Row 2: Date, Size & Size Unit */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Input
            id="plot-date"
            type="date"
            label="Plot Date"
            value={formData.plotDate}
            onChange={(e) => setFormData((prev) => ({ ...prev, plotDate: e.target.value }))}
          />

          <Input
            id="plot-size"
            type="number"
            step="any"
            min="0.0001"
            label="Size *"
            placeholder="e.g. 200"
            value={formData.size}
            onChange={(e) => setFormData((prev) => ({ ...prev, size: e.target.value }))}
            error={errors.size}
            required
          />

          <div className="space-y-1.5">
            <label htmlFor="plot-size-unit" className="block text-xs font-semibold text-slate-700">
              Size Unit *
            </label>
            <select
              id="plot-size-unit"
              value={formData.sizeUnit}
              onChange={(e) => setFormData((prev) => ({ ...prev, sizeUnit: e.target.value as PlotSizeUnit }))}
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 hover:border-slate-400"
            >
              {PLOT_SIZE_UNITS.map((u) => (
                <option key={u} value={u}>
                  {u}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Row 3: Rate, Rate Type & Status */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Input
            id="plot-rate"
            type="number"
            step="any"
            min="0"
            label="Rate (Price) *"
            placeholder="e.g. 5000000"
            value={formData.rate}
            onChange={(e) => setFormData((prev) => ({ ...prev, rate: e.target.value }))}
            error={errors.rate}
            required
          />

          <div className="space-y-1.5">
            <label htmlFor="plot-rate-type" className="block text-xs font-semibold text-slate-700">
              Rate Type *
            </label>
            <select
              id="plot-rate-type"
              value={formData.rateType}
              onChange={(e) => setFormData((prev) => ({ ...prev, rateType: e.target.value as PlotRateType }))}
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 hover:border-slate-400"
            >
              {PLOT_RATE_TYPES.map((rt) => (
                <option key={rt} value={rt}>
                  {rt === 'total' ? 'Total Lump Sum' : 'Per Unit Area'}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5">
            <label htmlFor="plot-status" className="block text-xs font-semibold text-slate-700">
              Status *
            </label>
            <select
              id="plot-status"
              value={formData.status}
              onChange={(e) => setFormData((prev) => ({ ...prev, status: e.target.value as PlotStatus }))}
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 hover:border-slate-400 capitalize"
            >
              {PLOT_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s.replace('_', ' ')}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* ─── Media Section 1: Plot Photos (Cloudinary) ─── */}
        <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3.5 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ImageIcon className="h-4 w-4 text-blue-600" />
              <span className="text-xs font-semibold text-slate-800">
                Plot Photos ({formData.images.length})
              </span>
            </div>
            <span className="text-[11px] text-slate-500">Cloudinary Upload</span>
          </div>

          {/* Uploaded Images Grid */}
          {formData.images.length > 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              {formData.images.map((img, idx) => (
                <div
                  key={idx}
                  className="group relative aspect-4/3 overflow-hidden rounded-lg border border-slate-200 bg-slate-100 shadow-2xs"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={img.url}
                    alt={`Plot photo ${idx + 1}`}
                    className="h-full w-full object-cover transition-transform duration-200 group-hover:scale-105"
                  />
                  <button
                    type="button"
                    onClick={() => handleRemoveImage(idx)}
                    className="absolute right-1.5 top-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-slate-900/70 text-white opacity-0 transition-opacity hover:bg-red-600 group-hover:opacity-100 cursor-pointer"
                    title="Remove photo"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                  <span className="absolute bottom-1 left-1.5 rounded bg-black/60 px-1 py-0.5 text-[9px] font-medium text-white">
                    #{idx + 1}
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* Add Photos Button / Input */}
          <input
            type="file"
            ref={imageInputRef}
            onChange={handleImageUpload}
            accept="image/jpeg,image/png,image/webp,image/avif,image/gif"
            multiple
            className="hidden"
          />

          <button
            type="button"
            disabled={isUploadingImages}
            onClick={() => imageInputRef.current?.click()}
            className="flex w-full items-center justify-center gap-2 rounded-lg border border-dashed border-slate-300 bg-white py-2.5 text-xs font-medium text-slate-700 transition hover:border-blue-400 hover:bg-blue-50/40 hover:text-blue-600 disabled:opacity-60 cursor-pointer"
          >
            {isUploadingImages ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin text-blue-600" />
                <span>Uploading photos to Cloudinary...</span>
              </>
            ) : (
              <>
                <Upload className="h-4 w-4 text-slate-500" />
                <span>Click to Upload Plot Photos (JPG, PNG, WEBP)</span>
              </>
            )}
          </button>
        </div>

        {/* ─── Media Section 2: Video Tour ─── */}
        <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3.5 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Film className="h-4 w-4 text-purple-600" />
              <span className="text-xs font-semibold text-slate-800">Video Tour / Walkthrough</span>
            </div>

            {/* Toggle between Upload vs External Link */}
            <div className="flex items-center rounded-lg border border-slate-200 bg-white p-0.5">
              <button
                type="button"
                onClick={() => setFormData((prev) => ({ ...prev, videoSourceType: 'upload' }))}
                className={`rounded-md px-2.5 py-1 text-[11px] font-medium transition cursor-pointer ${
                  formData.videoSourceType === 'upload'
                    ? 'bg-purple-600 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Upload Video
              </button>
              <button
                type="button"
                onClick={() => setFormData((prev) => ({ ...prev, videoSourceType: 'url' }))}
                className={`rounded-md px-2.5 py-1 text-[11px] font-medium transition cursor-pointer ${
                  formData.videoSourceType === 'url'
                    ? 'bg-purple-600 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                External Link
              </button>
            </div>
          </div>

          {/* Option A: Direct Video Upload via Cloudinary */}
          {formData.videoSourceType === 'upload' && (
            <div>
              {formData.video?.url ? (
                <div className="space-y-2">
                  <div className="relative overflow-hidden rounded-lg border border-slate-200 bg-black">
                    <video
                      src={formData.video.url}
                      controls
                      className="max-h-44 w-full rounded-lg object-contain"
                    />
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="flex items-center gap-1.5 text-emerald-600 font-medium">
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      Video uploaded & ready
                    </span>
                    <button
                      type="button"
                      onClick={handleRemoveVideo}
                      className="flex items-center gap-1 text-red-600 hover:underline cursor-pointer"
                    >
                      <Trash2 className="h-3 w-3" />
                      Remove Video
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <input
                    type="file"
                    ref={videoInputRef}
                    onChange={handleVideoUpload}
                    accept="video/mp4,video/quicktime,video/webm"
                    className="hidden"
                  />
                  <button
                    type="button"
                    disabled={isUploadingVideo}
                    onClick={() => videoInputRef.current?.click()}
                    className="flex w-full items-center justify-center gap-2 rounded-lg border border-dashed border-slate-300 bg-white py-3 text-xs font-medium text-slate-700 transition hover:border-purple-400 hover:bg-purple-50/40 hover:text-purple-600 disabled:opacity-60 cursor-pointer"
                  >
                    {isUploadingVideo ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin text-purple-600" />
                        <span>Uploading video to Cloudinary (this may take a few moments)...</span>
                      </>
                    ) : (
                      <>
                        <VideoIcon className="h-4 w-4 text-purple-500" />
                        <span>Upload Video File (MP4, MOV, WEBM up to 100MB)</span>
                      </>
                    )}
                  </button>
                </>
              )}
            </div>
          )}

          {/* Option B: External YouTube / Vimeo link */}
          {formData.videoSourceType === 'url' && (
            <Input
              id="plot-video-url"
              type="url"
              label="Video Tour Link (YouTube, Vimeo, or Hosted Video)"
              placeholder="https://www.youtube.com/watch?v=..."
              value={formData.videoUrl}
              onChange={(e) => setFormData((prev) => ({ ...prev, videoUrl: e.target.value }))}
              error={errors.videoUrl}
              maxLength={1000}
            />
          )}
        </div>

        {/* Public Notes / Description */}
        <div className="space-y-1.5">
          <label htmlFor="plot-description" className="block text-xs font-semibold text-slate-700">
            Public Notes / Description
          </label>
          <textarea
            id="plot-description"
            rows={3}
            placeholder="Public marketing description or amenities..."
            value={formData.description}
            onChange={(e) => setFormData((prev) => ({ ...prev, description: e.target.value }))}
            maxLength={2000}
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 transition-colors placeholder:text-slate-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:border-transparent hover:border-slate-400"
          />
          {errors.description && <p className="text-xs text-red-600 font-medium">{errors.description}</p>}
        </div>

        {/* Is Active Checkbox when editing */}
        {isEditing && (
          <div className="flex items-center gap-2 pt-1">
            <input
              type="checkbox"
              id="plot-is-active"
              checked={formData.isActive}
              onChange={(e) => setFormData((prev) => ({ ...prev, isActive: e.target.checked }))}
              className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
            />
            <label htmlFor="plot-is-active" className="text-xs font-semibold text-slate-700 cursor-pointer">
              Plot is Active in Listings
            </label>
          </div>
        )}

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isSubmitting || isUploadingImages || isUploadingVideo}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            isLoading={isSubmitting}
            disabled={isSubmitting || isUploadingImages || isUploadingVideo}
          >
            {isEditing ? 'Save Changes' : 'Register Plot'}
          </Button>
        </DialogFooter>
      </form>
    </Dialog>
  );
}
