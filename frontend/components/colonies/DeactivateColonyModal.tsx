'use client';

import React, { useState } from 'react';
import { Dialog, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/Dialog';
import { Button } from '@/components/ui/Button';
import { Colony } from '@/types/colony';
import { coloniesApi } from '@/lib/api/colonies';
import { ApiClientError } from '@/lib/api/errors';
import { AlertTriangle, AlertCircle } from 'lucide-react';

export interface DeactivateColonyModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  colony: Colony | null;
  onSuccess: () => void;
}

export function DeactivateColonyModal({
  open,
  onOpenChange,
  colony,
  onSuccess,
}: DeactivateColonyModalProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!colony) return null;

  const handleDeactivate = async () => {
    setIsSubmitting(true);
    setError(null);

    try {
      await coloniesApi.deactivateColony(colony.id);
      onSuccess();
      onOpenChange(false);
    } catch (err: unknown) {
      if (err instanceof ApiClientError) {
        if (err.code === 'COLONY_IN_USE' || err.status === 400) {
          setError(
            'Cannot deactivate this colony because active plots are currently associated with it. Please reassign or deactivate dependent plots before deactivating the colony.'
          );
        } else {
          setError(err.message || 'Failed to deactivate colony. Please try again.');
        }
      } else if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('An unexpected error occurred while deactivating the colony.');
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
          <DialogTitle>Deactivate Colony</DialogTitle>
        </div>
        <DialogDescription>
          Are you sure you want to deactivate <strong className="text-slate-900">{colony.name}</strong>?
        </DialogDescription>
      </DialogHeader>

      {error ? (
        <div className="mb-4 flex items-start gap-2.5 rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-800">
          <AlertCircle className="h-4 w-4 shrink-0 text-red-600 mt-0.5" />
          <div>
            <p className="font-semibold mb-0.5">Deactivation Restricted</p>
            <p>{error}</p>
          </div>
        </div>
      ) : (
        <div className="rounded-lg bg-slate-50 border border-slate-200 p-3 text-xs text-slate-600 space-y-1 my-2">
          <p>
            Deactivating a colony marks it inactive in your firm. Deactivated colonies cannot have new plots added to them.
          </p>
          <p className="text-slate-500">
            Note: Deactivation will be rejected if any active plots remain assigned to this colony.
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
