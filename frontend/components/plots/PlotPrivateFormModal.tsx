/**
 * frontend/components/plots/PlotPrivateFormModal.tsx
 *
 * Form Modal for Creating, Upserting, and Updating Confidential Plot Owner & Source Records.
 *
 * Strict Privacy & Field Enforcement:
 *  - Only includes fields accepted by backend `putPlotPrivateSchema.strict()`:
 *    ownerName (120), ownerPhone (30), ownerEmail (120), ownerAddress (300),
 *    sourceName (120), sourcePhone (30), sourceEmail (120), sourceType (50), notes (5000).
 *  - Sanitizes and validates field lengths and email formats before dispatching requests.
 *  - Zero telemetry/logging: Form inputs are strictly kept in transient memory and never written
 *    to console logs, localStorage, sessionStorage, or URL query parameters.
 *  - Prevents duplicate clicks during submission with loading disabled state.
 */

'use client';

import React, { useState } from 'react';
import { Dialog, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/Dialog';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Plot } from '@/types/plot';
import { PlotPrivate, UpsertPlotPrivateInput } from '@/types/plotPrivate';
import { plotPrivateApi } from '@/lib/api/plotPrivate';
import { ApiClientError } from '@/lib/api/errors';
import { AlertCircle, Lock, User, Share2, FileText } from 'lucide-react';

export interface PlotPrivateFormModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  plot: Plot | null;
  initialData?: PlotPrivate | null;
  onSuccess: (savedRecord: PlotPrivate) => void;
}

interface FormState {
  ownerName: string;
  ownerPhone: string;
  ownerEmail: string;
  ownerAddress: string;
  sourceName: string;
  sourcePhone: string;
  sourceEmail: string;
  sourceType: string;
  notes: string;
}

function getInitialFormState(initialData?: PlotPrivate | null): FormState {
  if (initialData) {
    return {
      ownerName: initialData.ownerName || initialData.owner?.name || '',
      ownerPhone: initialData.ownerPhone || initialData.owner?.phone || '',
      ownerEmail: initialData.ownerEmail || initialData.owner?.email || '',
      ownerAddress: initialData.ownerAddress || initialData.owner?.address || '',
      sourceName: initialData.sourceName || initialData.source?.name || '',
      sourcePhone: initialData.sourcePhone || initialData.source?.phone || '',
      sourceEmail: initialData.sourceEmail || initialData.source?.email || '',
      sourceType: initialData.sourceType || initialData.source?.type || '',
      notes: initialData.notes || '',
    };
  }
  return {
    ownerName: '',
    ownerPhone: '',
    ownerEmail: '',
    ownerAddress: '',
    sourceName: '',
    sourcePhone: '',
    sourceEmail: '',
    sourceType: '',
    notes: '',
  };
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function PlotPrivateFormModal({
  open,
  onOpenChange,
  plot,
  initialData,
  onSuccess,
}: PlotPrivateFormModalProps) {
  const isEditing = Boolean(initialData);

  const [formData, setFormData] = useState<FormState>(() => getInitialFormState(initialData));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [generalError, setGeneralError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleInputChange = (field: keyof FormState, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next[field];
        return next;
      });
    }
    if (generalError) {
      setGeneralError(null);
    }
  };

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};

    // Validate Owner constraints
    if (formData.ownerName.trim().length > 120) {
      newErrors.ownerName = 'Owner name cannot exceed 120 characters';
    }

    if (formData.ownerPhone.trim().length > 30) {
      newErrors.ownerPhone = 'Owner phone cannot exceed 30 characters';
    }

    if (formData.ownerEmail.trim()) {
      if (formData.ownerEmail.trim().length > 120) {
        newErrors.ownerEmail = 'Owner email cannot exceed 120 characters';
      } else if (!EMAIL_REGEX.test(formData.ownerEmail.trim())) {
        newErrors.ownerEmail = 'Invalid email address format';
      }
    }

    if (formData.ownerAddress.trim().length > 300) {
      newErrors.ownerAddress = 'Owner address cannot exceed 300 characters';
    }

    // Validate Source constraints
    if (formData.sourceName.trim().length > 120) {
      newErrors.sourceName = 'Source name cannot exceed 120 characters';
    }

    if (formData.sourcePhone.trim().length > 30) {
      newErrors.sourcePhone = 'Source phone cannot exceed 30 characters';
    }

    if (formData.sourceEmail.trim()) {
      if (formData.sourceEmail.trim().length > 120) {
        newErrors.sourceEmail = 'Source email cannot exceed 120 characters';
      } else if (!EMAIL_REGEX.test(formData.sourceEmail.trim())) {
        newErrors.sourceEmail = 'Invalid email address format';
      }
    }

    if (formData.sourceType.trim().length > 50) {
      newErrors.sourceType = 'Source type cannot exceed 50 characters';
    }

    // Validate Notes constraints
    if (formData.notes.trim().length > 5000) {
      newErrors.notes = 'Notes cannot exceed 5000 characters';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!plot) return;

    if (!validate()) {
      return;
    }

    setIsSubmitting(true);
    setGeneralError(null);

    // Prepare strictly authorized schema payload
    const payload: UpsertPlotPrivateInput = {
      ownerName: formData.ownerName.trim() || null,
      ownerPhone: formData.ownerPhone.trim() || null,
      ownerEmail: formData.ownerEmail.trim() || null,
      ownerAddress: formData.ownerAddress.trim() || null,
      sourceName: formData.sourceName.trim() || null,
      sourcePhone: formData.sourcePhone.trim() || null,
      sourceEmail: formData.sourceEmail.trim() || null,
      sourceType: formData.sourceType.trim() || null,
      notes: formData.notes.trim() || null,
    };

    try {
      // Use backend PUT upsert endpoint
      const result = await plotPrivateApi.upsertPlotPrivate(plot.id, payload);

      // Reset state safely
      setFormData(getInitialFormState(null));
      onSuccess(result);
      onOpenChange(false);
    } catch (err: unknown) {
      if (err instanceof ApiClientError) {
        if (err.status === 403) {
          setGeneralError('You do not have permission to modify confidential plot data.');
        } else if (err.code === 'VALIDATION_ERROR' && Array.isArray(err.details)) {
          const fieldErrs: Record<string, string> = {};
          err.details.forEach((d) => {
            const key = d.path || d.field;
            if (key) fieldErrs[key] = d.message;
          });
          setErrors(fieldErrs);
          setGeneralError('Please correct the validation errors below.');
        } else {
          setGeneralError(err.message || 'Failed to save confidential details.');
        }
      } else {
        setGeneralError('An unexpected network error occurred while saving.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!plot) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogHeader>
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-100 text-amber-800">
            <Lock className="h-4 w-4" />
          </div>
          <div>
            <DialogTitle className="text-base font-bold text-slate-900">
              {isEditing ? 'Edit Confidential Details' : 'Record Confidential Details'}
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500">
              Plot Ref: <strong className="text-slate-800">{plot.plotRef || plot.plotId}</strong>
            </DialogDescription>
          </div>
        </div>
      </DialogHeader>

      <form onSubmit={handleSubmit} className="space-y-4 my-2 text-xs">
        {generalError && (
          <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-red-800 flex items-start gap-2">
            <AlertCircle className="h-4 w-4 shrink-0 mt-0.5 text-red-600" />
            <span className="text-xs">{generalError}</span>
          </div>
        )}

        {/* Section 1: Confidential Owner Details */}
        <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-3 space-y-3">
          <div className="flex items-center gap-1.5 font-semibold text-slate-800 text-xs border-b border-slate-200 pb-1.5">
            <User className="h-3.5 w-3.5 text-blue-600" />
            <span>Owner Information</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Input
              label="Owner Full Name"
              placeholder="e.g. Robert Vance"
              value={formData.ownerName}
              onChange={(e) => handleInputChange('ownerName', e.target.value)}
              error={errors.ownerName}
              disabled={isSubmitting}
              maxLength={120}
            />

            <Input
              label="Owner Phone Number"
              placeholder="e.g. +1 555-0192"
              value={formData.ownerPhone}
              onChange={(e) => handleInputChange('ownerPhone', e.target.value)}
              error={errors.ownerPhone}
              disabled={isSubmitting}
              maxLength={30}
            />
          </div>

          <Input
            label="Owner Email Address"
            type="email"
            placeholder="e.g. owner@example.com"
            value={formData.ownerEmail}
            onChange={(e) => handleInputChange('ownerEmail', e.target.value)}
            error={errors.ownerEmail}
            disabled={isSubmitting}
            maxLength={120}
          />

          <div className="space-y-1">
            <label className="block text-xs font-medium text-slate-700">
              Residential Address (Max 300 chars)
            </label>
            <textarea
              rows={2}
              placeholder="Full postal address of the legal owner..."
              value={formData.ownerAddress}
              onChange={(e) => handleInputChange('ownerAddress', e.target.value)}
              disabled={isSubmitting}
              maxLength={300}
              className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 disabled:bg-slate-100"
            />
            {errors.ownerAddress && (
              <p className="text-[11px] text-red-600">{errors.ownerAddress}</p>
            )}
          </div>
        </div>

        {/* Section 2: Source / Referrer Details */}
        <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-3 space-y-3">
          <div className="flex items-center gap-1.5 font-semibold text-slate-800 text-xs border-b border-slate-200 pb-1.5">
            <Share2 className="h-3.5 w-3.5 text-emerald-600" />
            <span>Source & Referrer Attribution</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Input
              label="Source / Referrer Name"
              placeholder="e.g. Global Brokerage Corp"
              value={formData.sourceName}
              onChange={(e) => handleInputChange('sourceName', e.target.value)}
              error={errors.sourceName}
              disabled={isSubmitting}
              maxLength={120}
            />

            <div className="space-y-1">
              <label className="block text-xs font-medium text-slate-700">Source Type</label>
              <select
                value={formData.sourceType}
                onChange={(e) => handleInputChange('sourceType', e.target.value)}
                disabled={isSubmitting}
                className="w-full h-9 rounded-xl border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 disabled:bg-slate-100"
              >
                <option value="">Unspecified</option>
                <option value="direct">Direct (Walk-in / Owner Direct)</option>
                <option value="broker">External Broker</option>
                <option value="referral">Personal Referral</option>
                <option value="builder">Developer / Builder</option>
                <option value="marketing">Digital Marketing / Portal</option>
              </select>
              {errors.sourceType && <p className="text-[11px] text-red-600">{errors.sourceType}</p>}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Input
              label="Source Phone Number"
              placeholder="e.g. +1 555-0814"
              value={formData.sourcePhone}
              onChange={(e) => handleInputChange('sourcePhone', e.target.value)}
              error={errors.sourcePhone}
              disabled={isSubmitting}
              maxLength={30}
            />

            <Input
              label="Source Email Address"
              type="email"
              placeholder="e.g. broker@agency.com"
              value={formData.sourceEmail}
              onChange={(e) => handleInputChange('sourceEmail', e.target.value)}
              error={errors.sourceEmail}
              disabled={isSubmitting}
              maxLength={120}
            />
          </div>
        </div>

        {/* Section 3: Confidential Notes */}
        <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-3 space-y-2">
          <div className="flex items-center gap-1.5 font-semibold text-slate-800 text-xs border-b border-slate-200 pb-1.5">
            <FileText className="h-3.5 w-3.5 text-purple-600" />
            <span>Internal Notes (Confidential)</span>
          </div>

          <textarea
            rows={3}
            placeholder="Confidential negotiation details, seller commission arrangements, or access instructions..."
            value={formData.notes}
            onChange={(e) => handleInputChange('notes', e.target.value)}
            disabled={isSubmitting}
            maxLength={5000}
            className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 disabled:bg-slate-100"
          />
          <div className="flex items-center justify-between text-[10px] text-slate-400">
            <span>Only authorized staff with private permissions can view these notes.</span>
            <span>{formData.notes.length} / 5000</span>
          </div>
          {errors.notes && <p className="text-[11px] text-red-600">{errors.notes}</p>}
        </div>

        <DialogFooter className="pt-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isSubmitting}
          >
            Cancel
          </Button>
          <Button type="submit" isLoading={isSubmitting} disabled={isSubmitting}>
            {isSubmitting ? 'Saving Details...' : isEditing ? 'Save Changes' : 'Record Details'}
          </Button>
        </DialogFooter>
      </form>
    </Dialog>
  );
}
