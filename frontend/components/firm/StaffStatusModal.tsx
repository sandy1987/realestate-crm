'use client';

import React, { useState } from 'react';
import { Dialog, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/Dialog';
import { Button } from '@/components/ui/Button';
import { UserSummary } from '@/types/user';
import { firmUsersApi } from '@/lib/api/firmUsers';
import { ApiClientError } from '@/lib/api/errors';
import { AlertTriangle, CheckCircle, AlertCircle } from 'lucide-react';

export interface StaffStatusModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  targetUser: UserSummary | null;
  currentUserId: string | null | undefined;
  mode: 'suspend' | 'activate';
  onSuccess: () => void;
}

export function StaffStatusModal({
  open,
  onOpenChange,
  targetUser,
  currentUserId,
  mode,
  onSuccess,
}: StaffStatusModalProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!targetUser) return null;

  const isSuspend = mode === 'suspend';
  const isSelf = Boolean(currentUserId && targetUser.id === currentUserId);

  const handleAction = async () => {
    if (isSelf) {
      setError('Administrators cannot suspend or deactivate their own account.');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      await firmUsersApi.updateStaffStatus(targetUser.id, {
        isSuspended: isSuspend,
        isActive: !isSuspend,
      });
      onSuccess();
      onOpenChange(false);
    } catch (err: unknown) {
      if (err instanceof ApiClientError) {
        if (err.code === 'CANNOT_MODIFY_OWN_STATUS' || err.status === 400) {
          setError('Administrators cannot deactivate or suspend their own account.');
        } else {
          setError(err.message || `Failed to ${mode} user account.`);
        }
      } else if (err instanceof Error) {
        setError(err.message);
      } else {
        setError(`An unexpected error occurred while attempting to ${mode} the user.`);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogHeader>
        <div className={`flex items-center gap-2 mb-1 ${isSuspend ? 'text-amber-600' : 'text-emerald-600'}`}>
          {isSuspend ? <AlertTriangle className="h-5 w-5" /> : <CheckCircle className="h-5 w-5" />}
          <DialogTitle>{isSuspend ? 'Suspend Staff Account' : 'Reactivate Staff Account'}</DialogTitle>
        </div>
        <DialogDescription>
          Confirm status transition for <strong className="text-slate-900">{targetUser.email}</strong>.
        </DialogDescription>
      </DialogHeader>

      {error ? (
        <div className="mb-4 flex items-start gap-2.5 rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-800">
          <AlertCircle className="h-4 w-4 shrink-0 text-red-600 mt-0.5" />
          <span>{error}</span>
        </div>
      ) : isSelf ? (
        <div className="mb-4 flex items-start gap-2.5 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
          <AlertCircle className="h-4 w-4 shrink-0 text-amber-600 mt-0.5" />
          <div>
            <p className="font-semibold">Self-Deactivation Prohibited</p>
            <p className="mt-0.5">
              You are currently logged in as this user. Backend security policies prohibit administrators from
              deactivating or suspending their own account to prevent administrative lockout.
            </p>
          </div>
        </div>
      ) : (
        <div className="rounded-lg bg-slate-50 border border-slate-200 p-3 text-xs text-slate-600 space-y-1.5 my-2">
          {isSuspend ? (
            <>
              <p className="font-semibold text-slate-800">Operational Effect of Suspension:</p>
              <p>
                Suspending this user will immediately revoke all active refresh-token sessions and prevent them from
                signing in or performing any tenant operations.
              </p>
            </>
          ) : (
            <>
              <p className="font-semibold text-slate-800">Operational Effect of Activation:</p>
              <p>
                Reactivating this user restores their ability to log in and exercise their assigned permissions within your firm.
              </p>
            </>
          )}
        </div>
      )}

      <DialogFooter>
        <Button
          type="button"
          variant="outline"
          onClick={() => {
            setError(null);
            onOpenChange(false);
          }}
          disabled={isSubmitting}
        >
          Cancel
        </Button>
        <Button
          type="button"
          variant={isSuspend ? 'destructive' : 'primary'}
          onClick={handleAction}
          isLoading={isSubmitting}
          disabled={isSubmitting || isSelf}
        >
          {isSuspend ? 'Confirm Suspension' : 'Activate Account'}
        </Button>
      </DialogFooter>
    </Dialog>
  );
}
