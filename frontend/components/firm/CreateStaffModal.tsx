'use client';

import React, { useState } from 'react';
import { Dialog, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/Dialog';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { CreateStaffInput, ALL_STAFF_PERMISSIONS, UserPermission } from '@/types/user';
import { firmUsersApi } from '@/lib/api/firmUsers';
import { ApiClientError } from '@/lib/api/errors';
import { AlertCircle, Shield } from 'lucide-react';

export interface CreateStaffModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

interface FormState {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  permissions: UserPermission[];
}

const initialFormState: FormState = {
  email: '',
  password: '',
  firstName: '',
  lastName: '',
  permissions: ['plots:read', 'colonies:read'],
};

export function CreateStaffModal({ open, onOpenChange, onSuccess }: CreateStaffModalProps) {
  const [formData, setFormData] = useState<FormState>(initialFormState);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [generalError, setGeneralError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const togglePermission = (perm: UserPermission) => {
    setFormData((prev) => {
      const exists = prev.permissions.includes(perm);
      return {
        ...prev,
        permissions: exists
          ? prev.permissions.filter((p) => p !== perm)
          : [...prev.permissions, perm],
      };
    });
  };

  const validate = (): boolean => {
    const errs: Record<string, string> = {};
    const trimmedEmail = formData.email.trim().toLowerCase();

    if (!trimmedEmail) {
      errs.email = 'Email address is required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      errs.email = 'Invalid email address format';
    } else if (trimmedEmail.length > 120) {
      errs.email = 'Email cannot exceed 120 characters';
    }

    if (!formData.password) {
      errs.password = 'Password is required';
    } else if (formData.password.length < 8) {
      errs.password = 'Password must be at least 8 characters long';
    } else if (formData.password.length > 128) {
      errs.password = 'Password cannot exceed 128 characters';
    }

    if (formData.firstName && formData.firstName.length > 60) {
      errs.firstName = 'First name cannot exceed 60 characters';
    }

    if (formData.lastName && formData.lastName.length > 60) {
      errs.lastName = 'Last name cannot exceed 60 characters';
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
      const payload: CreateStaffInput = {
        email: formData.email.trim().toLowerCase(),
        password: formData.password,
        firstName: formData.firstName.trim() || null,
        lastName: formData.lastName.trim() || null,
        role: 'FIRM_STAFF',
        permissions: formData.permissions,
      };

      await firmUsersApi.createStaff(payload);

      // Secure cleanup: clear password from state
      setFormData(initialFormState);
      onSuccess();
      onOpenChange(false);
    } catch (err: unknown) {
      if (err instanceof ApiClientError) {
        if (err.code === 'EMAIL_ALREADY_EXISTS' || err.status === 409) {
          setErrors((prev) => ({
            ...prev,
            email: 'A user account with this email address already exists',
          }));
        } else {
          setGeneralError(err.message || 'Failed to create staff member.');
        }
      } else if (err instanceof Error) {
        setGeneralError(err.message);
      } else {
        setGeneralError('An unexpected error occurred while creating staff member.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogHeader>
        <DialogTitle>Add Staff Member</DialogTitle>
        <DialogDescription>
          Create a new staff user account with granular CRM permissions within your firm.
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
            id="staff-first-name"
            label="First Name"
            placeholder="Aarav"
            value={formData.firstName}
            onChange={(e) => setFormData((prev) => ({ ...prev, firstName: e.target.value }))}
            error={errors.firstName}
            maxLength={60}
            autoFocus
          />

          <Input
            id="staff-last-name"
            label="Last Name"
            placeholder="Verma"
            value={formData.lastName}
            onChange={(e) => setFormData((prev) => ({ ...prev, lastName: e.target.value }))}
            error={errors.lastName}
            maxLength={60}
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Input
            id="staff-email"
            type="email"
            label="Email Address *"
            placeholder="staff@firm.com"
            value={formData.email}
            onChange={(e) => {
              setFormData((prev) => ({ ...prev, email: e.target.value }));
              if (errors.email) {
                setErrors((prev) => {
                  const rest = { ...prev };
                  delete rest.email;
                  return rest;
                });
              }
            }}
            error={errors.email}
            required
          />

          <Input
            id="staff-password"
            type="password"
            label="Temporary Password *"
            placeholder="••••••••"
            value={formData.password}
            onChange={(e) => setFormData((prev) => ({ ...prev, password: e.target.value }))}
            error={errors.password}
            helperText="Min. 8 characters"
            required
          />
        </div>

        {/* Permissions Selection Checklist */}
        <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3.5 space-y-2.5">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-800">
            <Shield className="h-4 w-4 text-slate-600" />
            <span>Assigned Operational Permissions</span>
          </div>
          <p className="text-[11px] text-slate-500">
            Select the granular capabilities granted to this staff account.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
            {ALL_STAFF_PERMISSIONS.map((perm) => {
              const isChecked = formData.permissions.includes(perm);
              return (
                <label
                  key={perm}
                  className={`flex items-center gap-2 p-2 rounded-lg border text-xs cursor-pointer transition-colors ${
                    isChecked
                      ? 'border-blue-300 bg-blue-50/60 text-slate-900 font-medium'
                      : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={isChecked}
                    onChange={() => togglePermission(perm)}
                    className="h-3.5 w-3.5 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                  />
                  <code className="font-mono text-[11px]">{perm}</code>
                </label>
              );
            })}
          </div>
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
            Create Staff Member
          </Button>
        </DialogFooter>
      </form>
    </Dialog>
  );
}
