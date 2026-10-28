'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Dialog, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/Dialog';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Colony, CreateColonyInput, UpdateColonyInput, ColonyMapImage } from '@/types/colony';
import { coloniesApi } from '@/lib/api/colonies';
import { mediaApi } from '@/lib/api/media';
import { ApiClientError } from '@/lib/api/errors';
import {
  AlertCircle,
  MapPin,
  Upload,
  Image as ImageIcon,
  Trash2,
  Loader2,
  CheckCircle2,
} from 'lucide-react';

export interface ColonyFormModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  colony?: Colony | null;
  onSuccess: () => void;
}

interface FormState {
  name: string;
  city: string;
  state: string;
  pincode: string;
  address: string;
  country: string;
  mapImageUrl: string;
  mapImage: ColonyMapImage | null;
  description: string;
  isActive: boolean;
}

function getInitialFormState(colony?: Colony | null): FormState {
  if (colony) {
    const effectiveUrl = colony.mapImageUrl || colony.mapImage?.url || '';
    return {
      name: colony.name || '',
      city: colony.city || '',
      state: colony.state || '',
      pincode: colony.pincode || '',
      address: colony.address || '',
      country: colony.country || 'India',
      mapImageUrl: effectiveUrl,
      mapImage: colony.mapImage || (effectiveUrl ? { url: effectiveUrl, publicId: null } : null),
      description: colony.description || '',
      isActive: colony.isActive ?? true,
    };
  }
  return {
    name: '',
    city: '',
    state: '',
    pincode: '',
    address: '',
    country: 'India',
    mapImageUrl: '',
    mapImage: null,
    description: '',
    isActive: true,
  };
}

export function ColonyFormModal({ open, onOpenChange, colony, onSuccess }: ColonyFormModalProps) {
  const isEditing = Boolean(colony);
  const [formData, setFormData] = useState<FormState>(() => getInitialFormState(colony));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [generalError, setGeneralError] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [isUploadingMap, setIsUploadingMap] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const mapInputRef = useRef<HTMLInputElement>(null);

  // Sync state whenever dialog opens or colony prop changes
  useEffect(() => {
    if (open) {
      setFormData(getInitialFormState(colony));
      setErrors({});
      setGeneralError(null);
      setUploadError(null);
    }
  }, [open, colony]);

  const handleMapUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploadingMap(true);
    setUploadError(null);

    try {
      const uploaded = await mediaApi.uploadFile(file);
      setFormData((prev) => ({
        ...prev,
        mapImage: {
          url: uploaded.secure_url || uploaded.url,
          publicId: uploaded.publicId,
        },
        mapImageUrl: uploaded.secure_url || uploaded.url,
      }));
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to upload colony map image';
      setUploadError(msg);
    } finally {
      setIsUploadingMap(false);
      if (mapInputRef.current) {
        mapInputRef.current.value = '';
      }
    }
  };

  const handleRemoveMap = () => {
    setFormData((prev) => ({
      ...prev,
      mapImage: null,
      mapImageUrl: '',
    }));
  };

  const validate = (): boolean => {
    const errs: Record<string, string> = {};
    const trimmedName = formData.name.trim();

    if (!trimmedName) {
      errs.name = 'Colony name is required';
    } else if (trimmedName.length > 120) {
      errs.name = 'Colony name cannot exceed 120 characters';
    }

    if (formData.city && formData.city.length > 80) {
      errs.city = 'City cannot exceed 80 characters';
    }

    if (formData.state && formData.state.length > 80) {
      errs.state = 'State cannot exceed 80 characters';
    }

    if (formData.pincode && formData.pincode.length > 20) {
      errs.pincode = 'Pincode cannot exceed 20 characters';
    }

    if (formData.address && formData.address.length > 300) {
      errs.address = 'Address cannot exceed 300 characters';
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
      const effectiveMapUrl = formData.mapImageUrl.trim() || formData.mapImage?.url || null;

      if (isEditing && colony) {
        const payload: UpdateColonyInput = {
          name: formData.name.trim(),
          city: formData.city.trim() || null,
          state: formData.state.trim() || null,
          pincode: formData.pincode.trim() || null,
          address: formData.address.trim() || null,
          country: formData.country.trim() || 'India',
          mapImageUrl: effectiveMapUrl,
          mapImage: formData.mapImage,
          description: formData.description.trim() || null,
          isActive: formData.isActive,
        };
        await coloniesApi.updateColony(colony.id, payload);
      } else {
        const payload: CreateColonyInput = {
          name: formData.name.trim(),
          city: formData.city.trim() || null,
          state: formData.state.trim() || null,
          pincode: formData.pincode.trim() || null,
          address: formData.address.trim() || null,
          country: formData.country.trim() || 'India',
          mapImageUrl: effectiveMapUrl,
          mapImage: formData.mapImage,
          description: formData.description.trim() || null,
        };
        await coloniesApi.createColony(payload);
      }

      onSuccess();
      onOpenChange(false);
    } catch (err: unknown) {
      if (err instanceof ApiClientError) {
        if (err.code === 'COLONY_NAME_CONFLICT' || err.status === 409) {
          setErrors((prev) => ({
            ...prev,
            name: 'A colony with this name already exists in your firm',
          }));
        } else if (err.code === 'COLONY_IN_USE') {
          setGeneralError(
            'Cannot deactivate colony with active plots. Please reassign or deactivate active plots first.'
          );
        } else {
          setGeneralError(err.message || 'Failed to save colony. Please try again.');
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
        <DialogTitle>{isEditing ? 'Edit Colony' : 'Create New Colony'}</DialogTitle>
        <DialogDescription>
          {isEditing
            ? 'Update the development details, address, colony map layout, or active status.'
            : 'Register a new residential colony or sector development with layout blueprint.'}
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
        <div>
          <Input
            id="colony-name"
            label="Colony Name *"
            placeholder="e.g. Green Meadows Phase 1"
            value={formData.name}
            onChange={(e) => {
              setFormData((prev) => ({ ...prev, name: e.target.value }));
              if (errors.name) {
                setErrors((prev) => {
                  const rest = { ...prev };
                  delete rest.name;
                  return rest;
                });
              }
            }}
            error={errors.name}
            maxLength={120}
            required
            autoFocus
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Input
            id="colony-city"
            label="City"
            placeholder="e.g. Pune"
            value={formData.city}
            onChange={(e) => setFormData((prev) => ({ ...prev, city: e.target.value }))}
            error={errors.city}
            maxLength={80}
          />
          <Input
            id="colony-state"
            label="State"
            placeholder="e.g. Maharashtra"
            value={formData.state}
            onChange={(e) => setFormData((prev) => ({ ...prev, state: e.target.value }))}
            error={errors.state}
            maxLength={80}
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Input
            id="colony-pincode"
            label="Pincode"
            placeholder="e.g. 411001"
            value={formData.pincode}
            onChange={(e) => setFormData((prev) => ({ ...prev, pincode: e.target.value }))}
            error={errors.pincode}
            maxLength={20}
          />
          <Input
            id="colony-country"
            label="Country"
            placeholder="India"
            value={formData.country}
            onChange={(e) => setFormData((prev) => ({ ...prev, country: e.target.value }))}
            maxLength={80}
          />
        </div>

        <Input
          id="colony-address"
          label="Address"
          placeholder="Street or location details"
          value={formData.address}
          onChange={(e) => setFormData((prev) => ({ ...prev, address: e.target.value }))}
          error={errors.address}
          maxLength={300}
        />

        {/* ─── Colony Layout Map / Blueprint Upload Section ─── */}
        <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3.5 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <MapPin className="h-4 w-4 text-blue-600" />
              <span className="text-xs font-semibold text-slate-800">
                Colony Layout Map / Blueprint (Naksha)
              </span>
            </div>
            <span className="text-[11px] text-slate-500">Cloudinary Upload</span>
          </div>

          {formData.mapImageUrl ? (
            <div className="space-y-2.5">
              <div className="group relative aspect-16/9 w-full overflow-hidden rounded-lg border border-slate-200 bg-slate-100 shadow-2xs">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={formData.mapImageUrl}
                  alt="Colony Map Preview"
                  className="h-full w-full object-contain bg-slate-900/5 transition-transform duration-200 group-hover:scale-102"
                />
                <button
                  type="button"
                  onClick={handleRemoveMap}
                  className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-full bg-slate-900/80 text-white opacity-0 transition-opacity hover:bg-red-600 group-hover:opacity-100 cursor-pointer"
                  title="Remove map"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>

              <div className="flex items-center justify-between text-xs">
                <span className="flex items-center gap-1.5 text-emerald-600 font-medium">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  Map image uploaded
                </span>
                <button
                  type="button"
                  onClick={handleRemoveMap}
                  className="flex items-center gap-1 text-red-600 hover:underline cursor-pointer"
                >
                  <Trash2 className="h-3 w-3" />
                  Replace / Remove
                </button>
              </div>
            </div>
          ) : (
            <>
              <input
                type="file"
                ref={mapInputRef}
                onChange={handleMapUpload}
                accept="image/*"
                className="hidden"
              />
              <button
                type="button"
                disabled={isUploadingMap}
                onClick={() => mapInputRef.current?.click()}
                className="flex w-full items-center justify-center gap-2 rounded-lg border border-dashed border-slate-300 bg-white py-3 text-xs font-medium text-slate-700 transition hover:border-blue-400 hover:bg-blue-50/40 hover:text-blue-600 disabled:opacity-60 cursor-pointer"
              >
                {isUploadingMap ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin text-blue-600" />
                    <span>Uploading colony layout map to Cloudinary...</span>
                  </>
                ) : (
                  <>
                    <Upload className="h-4 w-4 text-slate-500" />
                    <span>Click or Drag to Upload Colony Map (All Image Formats: JPG, PNG, WEBP, SVG)</span>
                  </>
                )}
              </button>
            </>
          )}
        </div>

        <div className="space-y-1.5">
          <label htmlFor="colony-description" className="block text-xs font-semibold text-slate-700">
            Description
          </label>
          <textarea
            id="colony-description"
            rows={3}
            placeholder="Brief overview of the colony project..."
            value={formData.description}
            onChange={(e) => setFormData((prev) => ({ ...prev, description: e.target.value }))}
            maxLength={2000}
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 transition-colors placeholder:text-slate-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:border-transparent hover:border-slate-400"
          />
          {errors.description && <p className="text-xs text-red-600 font-medium">{errors.description}</p>}
        </div>

        {isEditing && (
          <div className="flex items-center gap-2 pt-1">
            <input
              type="checkbox"
              id="colony-is-active"
              checked={formData.isActive}
              onChange={(e) => setFormData((prev) => ({ ...prev, isActive: e.target.checked }))}
              className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
            />
            <label htmlFor="colony-is-active" className="text-xs font-semibold text-slate-700 cursor-pointer">
              Colony is Active
            </label>
          </div>
        )}

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isSubmitting || isUploadingMap}
          >
            Cancel
          </Button>
          <Button type="submit" isLoading={isSubmitting} disabled={isSubmitting || isUploadingMap}>
            {isEditing ? 'Save Changes' : 'Create Colony'}
          </Button>
        </DialogFooter>
      </form>
    </Dialog>
  );
}
