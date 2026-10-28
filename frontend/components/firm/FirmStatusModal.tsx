'use client';

import React, { useState } from 'react';
import { Dialog, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/Dialog';
import { Button } from '@/components/ui/Button';
import { Firm } from '@/types/firm';
import { platformFirmsApi } from '@/lib/api/platformFirms';
import { ApiClientError } from '@/lib/api/errors';
import { AlertTriangle, CheckCircle, AlertCircle } from 'lucide-react';

export interface FirmStatusModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  firm: Firm | null;
  mode: 'suspend' | 'activate';
  onSuccess: () => void;
}

export function FirmStatusModal({ open, onOpenChange, firm, mode, onSuccess }: FirmStatusModalProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!firm) return null;

  const isSuspend = mode === 'suspend';

  const handleAction = async () => {
    setIsSubmitting(true);
    setError(null);

    try {
      if (isSuspend) {
        await platformFirmsApi.suspendFirm(firm.id);
      } else {
        await platformFirmsApi.activateFirm(firm.id);
      }
      onSuccess();
      onOpenChange(false);
    } catch (err: unknown) {
      if (err instanceof ApiClientError) {
        setError(err.message || `Failed to ${mode} firm.`);
      } else if (err instanceof Error) {
        setError(err.message);
      } else {
        setError(`An unexpected error occurred while attempting to ${mode} the firm.`);
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
          <DialogTitle>{isSuspend ? 'Suspend Firm Tenant' : 'Activate Firm Tenant'}</DialogTitle>
        </div>
        <DialogDescription>
          Confirm status transition for firm <strong className="text-slate-900">{firm.name}</strong> ({firm.slug}).
        </DialogDescription>
      </DialogHeader>

      {error ? (
        <div className="mb-4 flex items-start gap-2.5 rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-800">
          <AlertCircle className="h-4 w-4 shrink-0 text-red-600 mt-0.5" />
          <span>{error}</span>
        </div>
      ) : (
        <div className="rounded-lg bg-slate-50 border border-slate-200 p-3 text-xs text-slate-600 space-y-1.5 my-2">
          {isSuspend ? (
            <>
              <p className="font-semibold text-slate-800">Operational Effect of Suspension:</p>
              <p>
                Suspending this firm marks it inactive on the platform. All tenant members (administrators and staff)
                will be blocked with HTTP 403 <code className="font-mono text-slate-700">FIRM_SUSPENDED</code> upon accessing any tenant resources.
              </p>
              <p className="text-slate-500">
                Only a platform administrator can reactivate a suspended firm.
              </p>
            </>
          ) : (
            <>
              <p className="font-semibold text-slate-800">Operational Effect of Activation:</p>
              <p>
                Reactivating this firm restores tenant access. Authorized firm administrators and staff will once again be able to sign in and manage colonies and plot inventory.
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
          disabled={isSubmitting}
        >
          {isSuspend ? 'Confirm Suspension' : 'Activate Organization'}
        </Button>
      </DialogFooter>
    </Dialog>
  );
}
