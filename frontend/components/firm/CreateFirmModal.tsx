'use client';

import React, { useState } from 'react';
import { Dialog, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/Dialog';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { CreateFirmInput, ProvisionFirmResult } from '@/types/firm';
import { platformFirmsApi } from '@/lib/api/platformFirms';
import { ApiClientError } from '@/lib/api/errors';
import { AlertCircle, UserCheck } from 'lucide-react';

export interface CreateFirmModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: (result: ProvisionFirmResult) => void;
}

interface FormState {
  name: string;
  slug: string;
  contactEmail: string;
  contactPhone: string;
  defaultCurrency: string;
  provisionAdmin: boolean;
  adminEmail: string;
  adminPassword: string;
  adminFirstName: string;
  adminLastName: string;
}

const initialFormState: FormState = {
  name: '',
  slug: '',
  contactEmail: '',
  contactPhone: '',
  defaultCurrency: 'INR',
  provisionAdmin: false,
  adminEmail: '',
  adminPassword: '',
  adminFirstName: '',
  adminLastName: '',
};

const slugRegex = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function CreateFirmModal({ open, onOpenChange, onSuccess }: CreateFirmModalProps) {
  const [formData, setFormData] = useState<FormState>(initialFormState);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [generalError, setGeneralError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Auto-generate slug from name if slug not yet manually modified
  const handleNameChange = (nameVal: string) => {
    setFormData((prev) => {
      const autoSlug = nameVal
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 80);

      return {
        ...prev,
        name: nameVal,
        slug: prev.slug === '' || prev.slug === prev.name.toLowerCase().replace(/[^a-z0-9]+/g, '-') ? autoSlug : prev.slug,
      };
    });
  };

  const validate = (): boolean => {
    const errs: Record<string, string> = {};
    const trimmedName = formData.name.trim();
    const trimmedSlug = formData.slug.trim().toLowerCase();

    if (!trimmedName) {
      errs.name = 'Firm name is required';
    } else if (trimmedName.length > 120) {
      errs.name = 'Firm name cannot exceed 120 characters';
    }

    if (!trimmedSlug) {
      errs.slug = 'Firm slug is required';
    } else if (trimmedSlug.length < 2) {
      errs.slug = 'Slug must be at least 2 characters long';
    } else if (trimmedSlug.length > 80) {
      errs.slug = 'Slug cannot exceed 80 characters';
    } else if (!slugRegex.test(trimmedSlug)) {
      errs.slug = 'Slug must consist of lowercase alphanumeric characters separated by single hyphens';
    }

    if (formData.contactEmail.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.contactEmail.trim())) {
      errs.contactEmail = 'Invalid contact email format';
    }

    if (formData.contactPhone.trim() && formData.contactPhone.trim().length > 30) {
      errs.contactPhone = 'Contact phone cannot exceed 30 characters';
    }

    if (formData.provisionAdmin) {
      const trimmedAdminEmail = formData.adminEmail.trim().toLowerCase();
      if (!trimmedAdminEmail) {
        errs.adminEmail = 'Administrator email is required';
      } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedAdminEmail)) {
        errs.adminEmail = 'Invalid administrator email format';
      }

      if (!formData.adminPassword) {
        errs.adminPassword = 'Administrator password is required';
      } else if (formData.adminPassword.length < 8) {
        errs.adminPassword = 'Password must be at least 8 characters long';
      }
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
      const payload: CreateFirmInput = {
        name: formData.name.trim(),
        slug: formData.slug.trim().toLowerCase(),
        contactEmail: formData.contactEmail.trim() || null,
        contactPhone: formData.contactPhone.trim() || null,
        settings: {
          defaultCurrency: formData.defaultCurrency.trim() || 'INR',
          allowedVideoProviders: ['youtube', 'vimeo'],
        },
      };

      if (formData.provisionAdmin) {
        payload.adminEmail = formData.adminEmail.trim().toLowerCase();
        payload.adminPassword = formData.adminPassword;
        payload.adminFirstName = formData.adminFirstName.trim() || undefined;
        payload.adminLastName = formData.adminLastName.trim() || undefined;
      }

      const result = await platformFirmsApi.createFirm(payload);
      onSuccess(result);
      onOpenChange(false);
    } catch (err: unknown) {
      if (err instanceof ApiClientError) {
        if (err.status === 409 || err.code === 'CONFLICT') {
          if (err.message.includes('slug')) {
            setErrors((prev) => ({ ...prev, slug: 'A firm with this slug already exists' }));
          } else if (err.message.includes('email')) {
            setErrors((prev) => ({ ...prev, adminEmail: 'A user with this administrator email already exists' }));
          } else {
            setGeneralError(err.message);
          }
        } else {
          setGeneralError(err.message || 'Failed to provision firm organization.');
        }
      } else if (err instanceof Error) {
        setGeneralError(err.message);
      } else {
        setGeneralError('An unexpected error occurred while creating the firm.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogHeader>
        <DialogTitle>Provision New Firm Tenant</DialogTitle>
        <DialogDescription>
          Register a new real estate organization with isolated tenant boundaries on the AGENT-Broker platform.
        </DialogDescription>
      </DialogHeader>

      {generalError && (
        <div className="mb-4 flex items-start gap-2.5 rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-800">
          <AlertCircle className="h-4 w-4 shrink-0 text-red-600 mt-0.5" />
          <span>{generalError}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Input
            id="firm-name"
            label="Organization Name *"
            placeholder="e.g. Skyline Realty Group"
            value={formData.name}
            onChange={(e) => handleNameChange(e.target.value)}
            error={errors.name}
            maxLength={120}
            required
            autoFocus
          />

          <Input
            id="firm-slug"
            label="Tenant Identifier (Slug) *"
            placeholder="skyline-realty"
            value={formData.slug}
            onChange={(e) => setFormData((prev) => ({ ...prev, slug: e.target.value.toLowerCase() }))}
            error={errors.slug}
            helperText="Lowercase alphanumeric with hyphens"
            maxLength={80}
            required
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Input
            id="firm-contact-email"
            type="email"
            label="Contact Email"
            placeholder="contact@skylinerealty.com"
            value={formData.contactEmail}
            onChange={(e) => setFormData((prev) => ({ ...prev, contactEmail: e.target.value }))}
            error={errors.contactEmail}
          />

          <Input
            id="firm-contact-phone"
            type="tel"
            label="Contact Phone"
            placeholder="+91 98765 43210"
            value={formData.contactPhone}
            onChange={(e) => setFormData((prev) => ({ ...prev, contactPhone: e.target.value }))}
            error={errors.contactPhone}
            maxLength={30}
          />
        </div>

        {/* Initial Administrator Provisioning Accordion/Toggle */}
        <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3.5 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <UserCheck className="h-4 w-4 text-slate-600" />
              <label htmlFor="provision-admin" className="text-xs font-semibold text-slate-800 cursor-pointer">
                Provision Initial Firm Administrator
              </label>
            </div>
            <input
              type="checkbox"
              id="provision-admin"
              checked={formData.provisionAdmin}
              onChange={(e) => setFormData((prev) => ({ ...prev, provisionAdmin: e.target.checked }))}
              className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
            />
          </div>

          {formData.provisionAdmin && (
            <div className="pt-2 space-y-3 border-t border-slate-200/80 animate-in fade-in duration-150">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Input
                  id="admin-first-name"
                  label="Admin First Name"
                  placeholder="Rahul"
                  value={formData.adminFirstName}
                  onChange={(e) => setFormData((prev) => ({ ...prev, adminFirstName: e.target.value }))}
                  maxLength={60}
                />
                <Input
                  id="admin-last-name"
                  label="Admin Last Name"
                  placeholder="Sharma"
                  value={formData.adminLastName}
                  onChange={(e) => setFormData((prev) => ({ ...prev, adminLastName: e.target.value }))}
                  maxLength={60}
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Input
                  id="admin-email"
                  type="email"
                  label="Admin Login Email *"
                  placeholder="admin@skylinerealty.com"
                  value={formData.adminEmail}
                  onChange={(e) => setFormData((prev) => ({ ...prev, adminEmail: e.target.value }))}
                  error={errors.adminEmail}
                  required={formData.provisionAdmin}
                />

                <Input
                  id="admin-password"
                  type="password"
                  label="Admin Password *"
                  placeholder="••••••••"
                  value={formData.adminPassword}
                  onChange={(e) => setFormData((prev) => ({ ...prev, adminPassword: e.target.value }))}
                  error={errors.adminPassword}
                  helperText="Min. 8 characters"
                  required={formData.provisionAdmin}
                />
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isSubmitting}
          >
            Cancel
          </Button>
          <Button type="submit" isLoading={isSubmitting} disabled={isSubmitting}>
            Provision Firm
          </Button>
        </DialogFooter>
      </form>
    </Dialog>
  );
}
