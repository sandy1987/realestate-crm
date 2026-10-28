/**
 * frontend/components/plots/DeletePlotPrivateModal.tsx
 *
 * Confirmation Dialog for Removing Confidential Plot Owner & Source Records.
 *
 * Privacy Security Compliance:
 *  - The confirmation dialog explicitly avoids rendering confidential details
 *    (such as owner name, phone number, address, or confidential notes) in the prompt.
 *  - Only the public plot reference is used to identify the target plot.
 *  - Prevents duplicate clicks during deletion.
 */

'use client';

import React, { useState } from 'react';
import { Dialog, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/Dialog';
import { Button } from '@/components/ui/Button';
import { Plot } from '@/types/plot';
import { plotPrivateApi } from '@/lib/api/plotPrivate';
import { ApiClientError } from '@/lib/api/errors';
import { AlertTriangle } from 'lucide-react';

export interface DeletePlotPrivateModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  plot: Plot | null;
  onSuccess: () => void;
}

export function DeletePlotPrivateModal({
  open,
  onOpenChange,
  plot,
  onSuccess,
}: DeletePlotPrivateModalProps) {
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!plot) return null;

  const handleDelete = async () => {
    setIsDeleting(true);
    setError(null);

    try {
      await plotPrivateApi.deletePlotPrivate(plot.id);
      onSuccess();
      onOpenChange(false);
    } catch (err: unknown) {
      if (err instanceof ApiClientError) {
        if (err.status === 403) {
          setError('You do not have permission to delete confidential plot data.');
        } else if (err.code === 'PRIVATE_RECORD_NOT_FOUND') {
          // Already deleted
          onSuccess();
          onOpenChange(false);
          return;
        } else {
          setError(err.message || 'Failed to delete confidential details.');
        }
      } else {
        setError('An unexpected network error occurred while deleting.');
      }
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogHeader>
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-red-100 text-red-600 shrink-0">
            <AlertTriangle className="h-5 w-5" />
          </div>
          <div>
            <DialogTitle className="text-base font-bold text-slate-900">
              Delete Confidential Records?
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500 mt-0.5">
              Target Plot: <strong className="text-slate-800">{plot.plotRef || plot.plotId}</strong>
            </DialogDescription>
          </div>
        </div>
      </DialogHeader>

      <div className="my-3 space-y-3 text-xs">
        {error && (
          <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-red-800">
            {error}
          </div>
        )}

        <div className="rounded-xl bg-amber-50/70 border border-amber-200 p-3 text-amber-900 leading-relaxed">
          <p className="font-semibold mb-1">Permanent Confidential Data Removal</p>
          <p className="text-[11px] text-amber-800">
            This will permanently remove the private owner identity, phone numbers, contact address,
            source attribution, and confidential notes attached to this plot.
            The public plot inventory listing will remain active.
          </p>
        </div>
      </div>

      <DialogFooter>
        <Button
          type="button"
          variant="outline"
          onClick={() => onOpenChange(false)}
          disabled={isDeleting}
        >
          Cancel
        </Button>
        <Button
          type="button"
          onClick={handleDelete}
          isLoading={isDeleting}
          disabled={isDeleting}
          className="bg-red-600 hover:bg-red-700 text-white border-transparent"
        >
          {isDeleting ? 'Deleting...' : 'Confirm Deletion'}
        </Button>
      </DialogFooter>
    </Dialog>
  );
}
