'use client';

import React, { useState } from 'react';
import { Dialog, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/Dialog';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { UserSummary, UpdateStaffInput, ALL_STAFF_PERMISSIONS, UserPermission } from '@/types/user';
import { firmUsersApi } from '@/lib/api/firmUsers';
import { ApiClientError } from '@/lib/api/errors';
import { AlertCircle, Shield } from 'lucide-react';

export interface EditStaffModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user: UserSummary | null;
  onSuccess: () => void;
}

interface FormState {
  firstName: string;
  lastName: string;
  permissions: UserPermission[];
}

function getInitialState(user: UserSummary | null): FormState {
  if (user) {
    return {
      firstName: user.firstName || '',
      lastName: user.lastName || '',
      permissions: user.permissions || [],
    };
  }
  return {
    firstName: '',
    lastName: '',
    permissions: [],
  };
}

export function EditStaffModal({ open, onOpenChange, user, onSuccess }: EditStaffModalProps) {
  const [formData, setFormData] = useState<FormState>(() => getInitialState(user));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [generalError, setGeneralError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!user) return null;

  const isFirmAdmin = user.role === 'FIRM_ADMIN';

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
      const payload: UpdateStaffInput = {
        firstName: formData.firstName.trim() || null,
        lastName: formData.lastName.trim() || null,
        // Only update permissions if not a firm admin (admin has all implicit permissions)
        permissions: isFirmAdmin ? undefined : formData.permissions,
      };

      await firmUsersApi.updateStaff(user.id, payload);
      onSuccess();
      onOpenChange(false);
    } catch (err: unknown) {
      if (err instanceof ApiClientError) {
        setGeneralError(err.message || 'Failed to update user profile.');
      } else if (err instanceof Error) {
        setGeneralError(err.message);
      } else {
        setGeneralError('An unexpected error occurred while updating the user.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogHeader>
        <DialogTitle>Edit User Profile</DialogTitle>
        <DialogDescription>
          Update profile details and permission grants for <strong className="text-slate-900">{user.email}</strong>.
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
            id="edit-staff-first-name"
            label="First Name"
            placeholder="First name"
            value={formData.firstName}
            onChange={(e) => setFormData((prev) => ({ ...prev, firstName: e.target.value }))}
            error={errors.firstName}
            maxLength={60}
            autoFocus
          />

          <Input
            id="edit-staff-last-name"
            label="Last Name"
            placeholder="Last name"
            value={formData.lastName}
            onChange={(e) => setFormData((prev) => ({ ...prev, lastName: e.target.value }))}
            error={errors.lastName}
            maxLength={60}
          />
        </div>

        {/* Permissions Section */}
        {isFirmAdmin ? (
          <div className="rounded-xl border border-blue-200 bg-blue-50/70 p-3.5 text-xs text-blue-900">
            <div className="flex items-center gap-2 font-semibold">
              <Shield className="h-4 w-4 text-blue-700" />
              <span>Firm Administrator Account</span>
            </div>
            <p className="text-[11px] text-blue-700 mt-1">
              Firm administrators implicitly possess all tenant permissions. Explicit permission assignments apply
              only to staff accounts.
            </p>
          </div>
        ) : (
          <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3.5 space-y-2.5">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-800">
              <Shield className="h-4 w-4 text-slate-600" />
              <span>Assigned Operational Permissions</span>
            </div>
            <p className="text-[11px] text-slate-500">
              Toggle the granular capabilities granted to this staff account.
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
        )}

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
            Save Changes
          </Button>
        </DialogFooter>
      </form>
    </Dialog>
  );
}
