'use client';

import React, { useState } from 'react';
import { Dialog, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/Dialog';
import { Button } from '@/components/ui/Button';
import { Plot } from '@/types/plot';
import { plotsApi } from '@/lib/api/plots';
import { ApiClientError } from '@/lib/api/errors';
import { AlertTriangle, AlertCircle } from 'lucide-react';

export interface DeactivatePlotModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  plot: Plot | null;
  onSuccess: () => void;
}

export function DeactivatePlotModal({
  open,
  onOpenChange,
  plot,
  onSuccess,
}: DeactivatePlotModalProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!plot) return null;

  const handleDeactivate = async () => {
    setIsSubmitting(true);
    setError(null);

    try {
      await plotsApi.deactivatePlot(plot.id);
      onSuccess();
      onOpenChange(false);
    } catch (err: unknown) {
      if (err instanceof ApiClientError) {
        setError(err.message || 'Failed to deactivate plot.');
      } else if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('An unexpected error occurred while deactivating the plot.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogHeader>
        <div className="flex items-center gap-2.5 text-amber-600 mb-1">
          <AlertTriangle className="h-5 w-5" />
          <DialogTitle>Deactivate Plot</DialogTitle>
        </div>
        <DialogDescription>
          Are you sure you want to deactivate plot{' '}
          <strong className="text-slate-900">{plot.plotRef || plot.plotId}</strong>?
        </DialogDescription>
      </DialogHeader>

      {error ? (
        <div className="mb-4 flex items-start gap-2.5 rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-800">
          <AlertCircle className="h-4 w-4 shrink-0 text-red-600 mt-0.5" />
          <span>{error}</span>
        </div>
      ) : (
        <div className="rounded-lg bg-slate-50 border border-slate-200 p-3 text-xs text-slate-600 space-y-1 my-2">
          <p>
            Deactivating this plot listing will mark it inactive in your firm&apos;s directory. It will no longer appear
            in standard public plot listings.
          </p>
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
          variant="destructive"
          onClick={handleDeactivate}
          isLoading={isSubmitting}
          disabled={isSubmitting}
        >
          Confirm Deactivation
        </Button>
      </DialogFooter>
    </Dialog>
  );
}
