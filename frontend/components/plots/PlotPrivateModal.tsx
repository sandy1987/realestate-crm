/**
 * frontend/components/plots/PlotPrivateModal.tsx
 *
 * Confidential Plot Owner & Source Details Viewer.
 *
 * Security & Privacy Architecture:
 *  - Strict RBAC: Requires authenticated FIRM_ADMIN or FIRM_STAFF with `private:read`.
 *  - On-Demand Fetching: Never pre-fetches confidential records until the modal is opened.
 *  - Confidential State Hygiene: Immediately purges private values from component state upon close or plot switch.
 *  - Safe Error Handling: Distinguishes empty records (null) from network failures and unauthorized access (403).
 *  - No Browser Persistence: Never commits confidential fields to localStorage, sessionStorage, or URL query parameters.
 */

'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Dialog, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/Dialog';
import { Button } from '@/components/ui/Button';
import { Skeleton } from '@/components/ui/Loading';
import { useAuth } from '@/lib/context/AuthContext';
import { hasPermission, isSuperAdmin } from '@/lib/utils/permissions';
import { plotPrivateApi } from '@/lib/api/plotPrivate';
import { Plot } from '@/types/plot';
import { PlotPrivate } from '@/types/plotPrivate';
import { ApiClientError } from '@/lib/api/errors';
import { formatDate } from '@/lib/utils/formatters';
import {
  Lock,
  ShieldAlert,
  User,
  Phone,
  Mail,
  MapPin,
  Share2,
  FileText,
  Edit2,
  Trash2,
  Plus,
  RotateCw,
  AlertCircle,
} from 'lucide-react';

export interface PlotPrivateModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  plot: Plot | null;
  onEditClick: (existingData: PlotPrivate | null) => void;
  onDeleteClick: (existingData: PlotPrivate) => void;
}

export function PlotPrivateModal({
  open,
  onOpenChange,
  plot,
  onEditClick,
  onDeleteClick,
}: PlotPrivateModalProps) {
  const { user } = useAuth();

  const isPlatformAdmin = isSuperAdmin(user);
  const canRead = hasPermission(user, 'private:read');
  const canWrite = hasPermission(user, 'private:write');

  const [privateData, setPrivateData] = useState<PlotPrivate | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isUnauthorized, setIsUnauthorized] = useState(false);

  // Guard against out-of-order asynchronous responses when rapidly toggling plots
  const activeFetchIdRef = useRef(0);

  const fetchPrivateDetails = useCallback(async (plotId: string) => {
    const currentFetchId = ++activeFetchIdRef.current;
    setIsLoading(true);
    setError(null);
    setIsUnauthorized(false);

    try {
      const data = await plotPrivateApi.getPlotPrivate(plotId);
      if (currentFetchId === activeFetchIdRef.current) {
        setPrivateData(data);
      }
    } catch (err: unknown) {
      if (currentFetchId === activeFetchIdRef.current) {
        if (err instanceof ApiClientError && err.status === 403) {
          setIsUnauthorized(true);
        } else if (err instanceof ApiClientError && err.code === 'PLOT_NOT_FOUND') {
          setError('Plot record could not be found or does not belong to your firm.');
        } else {
          setError(err instanceof Error ? err.message : 'Failed to retrieve confidential details.');
        }
      }
    } finally {
      if (currentFetchId === activeFetchIdRef.current) {
        setIsLoading(false);
      }
    }
  }, []);

  // Fetch strictly on demand when modal opens; immediately purge confidential data on close
  useEffect(() => {
    let isMounted = true;

    async function handleOpen() {
      // Yield to next microtask to satisfy React effect lifecycle
      await Promise.resolve();
      if (!isMounted) return;

      if (open && plot?.id) {
        if (isPlatformAdmin || !canRead) {
          setIsUnauthorized(true);
          setPrivateData(null);
          setIsLoading(false);
        } else {
          void fetchPrivateDetails(plot.id);
        }
      } else {
        // Purge confidential state immediately upon modal closure or plot deselection
        setPrivateData(null);
        setError(null);
        setIsUnauthorized(false);
        setIsLoading(false);
      }
    }

    void handleOpen();

    return () => {
      isMounted = false;
    };
  }, [open, plot?.id, isPlatformAdmin, canRead, fetchPrivateDetails]);

  if (!plot) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogHeader>
        <div className="flex items-center justify-between pr-6">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-100 text-amber-800">
              <Lock className="h-4 w-4" />
            </div>
            <div>
              <DialogTitle className="text-base font-bold text-slate-900">
                Confidential Plot Data
              </DialogTitle>
              <span className="text-[11px] font-medium text-slate-500">
                Plot Ref: <strong className="text-slate-800">{plot.plotRef || plot.plotId}</strong>
              </span>
            </div>
          </div>
          <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-0.5 text-[11px] font-semibold text-amber-800 border border-amber-200">
            Private Access
          </span>
        </div>
        <DialogDescription className="text-xs text-slate-500 mt-1">
          Internal owner identity and marketing source records. Strictly restricted to authorized staff.
        </DialogDescription>
      </DialogHeader>

      <div className="my-3 space-y-4 text-xs">
        {/* Loading State */}
        {isLoading && (
          <div className="space-y-3 p-2">
            <Skeleton className="h-20 w-full rounded-xl" />
            <Skeleton className="h-20 w-full rounded-xl" />
            <Skeleton className="h-16 w-full rounded-xl" />
          </div>
        )}

        {/* Unauthorized State */}
        {!isLoading && (isUnauthorized || isPlatformAdmin || !canRead) && (
          <div className="rounded-xl border border-amber-200 bg-amber-50/70 p-5 text-center">
            <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-amber-100 text-amber-800 mb-2">
              <ShieldAlert className="h-5 w-5" />
            </div>
            <h4 className="text-xs font-bold text-amber-900">Access Restricted</h4>
            <p className="text-[11px] text-amber-800 mt-1 max-w-sm mx-auto">
              You do not have permission to view confidential owner and source details for this plot.
              Contact your firm administrator if you require <code className="font-mono bg-amber-100 px-1 py-0.5 rounded">private:read</code> access.
            </p>
          </div>
        )}

        {/* Error State */}
        {!isLoading && !isUnauthorized && error && (
          <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-red-800 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertCircle className="h-4 w-4 shrink-0 text-red-600" />
              <span className="text-xs">{error}</span>
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={() => plot?.id && fetchPrivateDetails(plot.id)}
              leftIcon={<RotateCw className="h-3 w-3" />}
            >
              Retry
            </Button>
          </div>
        )}

        {/* Empty State (Valid plot without private details yet) */}
        {!isLoading && !isUnauthorized && !error && !privateData && (
          <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50/60 p-6 text-center">
            <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-slate-500 mb-2">
              <FileText className="h-5 w-5" />
            </div>
            <h4 className="text-xs font-semibold text-slate-800">No Private Record Found</h4>
            <p className="text-[11px] text-slate-500 mt-1 max-w-xs mx-auto">
              No private owner or referrer information has been recorded for this plot yet.
            </p>
            {canWrite && (
              <div className="mt-4">
                <Button
                  size="sm"
                  onClick={() => onEditClick(null)}
                  leftIcon={<Plus className="h-3.5 w-3.5" />}
                >
                  Add Private Information
                </Button>
              </div>
            )}
          </div>
        )}

        {/* Populated Data View */}
        {!isLoading && !isUnauthorized && !error && privateData && (
          <div className="space-y-3.5">
            {/* Section 1: Confidential Owner Details */}
            <div className="rounded-xl border border-slate-200 bg-white p-3.5 shadow-2xs">
              <div className="flex items-center gap-2 mb-2.5 pb-2 border-b border-slate-100 text-slate-800 font-semibold text-xs">
                <User className="h-4 w-4 text-blue-600" />
                <span>Confidential Owner Details</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <span className="text-[10px] font-medium text-slate-400 block uppercase">
                    Owner Full Name
                  </span>
                  <p className="font-semibold text-slate-900 mt-0.5">
                    {privateData.ownerName || privateData.owner?.name || (
                      <span className="text-slate-400 font-normal italic">Not recorded</span>
                    )}
                  </p>
                </div>

                <div>
                  <span className="text-[10px] font-medium text-slate-400 block uppercase">
                    Phone Number
                  </span>
                  <div className="flex items-center gap-1.5 mt-0.5 text-slate-800">
                    <Phone className="h-3.5 w-3.5 text-slate-400" />
                    <span>
                      {privateData.ownerPhone || privateData.owner?.phone || (
                        <span className="text-slate-400 font-normal italic">Not recorded</span>
                      )}
                    </span>
                  </div>
                </div>

                <div>
                  <span className="text-[10px] font-medium text-slate-400 block uppercase">
                    Email Address
                  </span>
                  <div className="flex items-center gap-1.5 mt-0.5 text-slate-800">
                    <Mail className="h-3.5 w-3.5 text-slate-400" />
                    <span className="truncate">
                      {privateData.ownerEmail || privateData.owner?.email || (
                        <span className="text-slate-400 font-normal italic">Not recorded</span>
                      )}
                    </span>
                  </div>
                </div>

                <div>
                  <span className="text-[10px] font-medium text-slate-400 block uppercase">
                    Residential Address
                  </span>
                  <div className="flex items-start gap-1.5 mt-0.5 text-slate-800">
                    <MapPin className="h-3.5 w-3.5 text-slate-400 shrink-0 mt-0.5" />
                    <span className="leading-tight">
                      {privateData.ownerAddress || privateData.owner?.address || (
                        <span className="text-slate-400 font-normal italic">Not recorded</span>
                      )}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Section 2: Source / Referrer Details */}
            <div className="rounded-xl border border-slate-200 bg-white p-3.5 shadow-2xs">
              <div className="flex items-center gap-2 mb-2.5 pb-2 border-b border-slate-100 text-slate-800 font-semibold text-xs">
                <Share2 className="h-4 w-4 text-emerald-600" />
                <span>Source & Referrer Attribution</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <span className="text-[10px] font-medium text-slate-400 block uppercase">
                    Source / Referrer Name
                  </span>
                  <p className="font-semibold text-slate-900 mt-0.5">
                    {privateData.sourceName || privateData.source?.name || (
                      <span className="text-slate-400 font-normal italic">Direct / None</span>
                    )}
                  </p>
                </div>

                <div>
                  <span className="text-[10px] font-medium text-slate-400 block uppercase">
                    Source Type
                  </span>
                  <p className="font-medium text-slate-800 mt-0.5 capitalize">
                    {privateData.sourceType || privateData.source?.type || (
                      <span className="text-slate-400 font-normal italic">Unspecified</span>
                    )}
                  </p>
                </div>

                <div>
                  <span className="text-[10px] font-medium text-slate-400 block uppercase">
                    Source Phone
                  </span>
                  <div className="flex items-center gap-1.5 mt-0.5 text-slate-800">
                    <Phone className="h-3.5 w-3.5 text-slate-400" />
                    <span>
                      {privateData.sourcePhone || privateData.source?.phone || (
                        <span className="text-slate-400 font-normal italic">Not recorded</span>
                      )}
                    </span>
                  </div>
                </div>

                <div>
                  <span className="text-[10px] font-medium text-slate-400 block uppercase">
                    Source Email
                  </span>
                  <div className="flex items-center gap-1.5 mt-0.5 text-slate-800">
                    <Mail className="h-3.5 w-3.5 text-slate-400" />
                    <span className="truncate">
                      {privateData.sourceEmail || privateData.source?.email || (
                        <span className="text-slate-400 font-normal italic">Not recorded</span>
                      )}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Section 3: Confidential Internal Notes */}
            <div className="rounded-xl border border-slate-200 bg-white p-3.5 shadow-2xs">
              <div className="flex items-center gap-2 mb-2 pb-2 border-b border-slate-100 text-slate-800 font-semibold text-xs">
                <FileText className="h-4 w-4 text-purple-600" />
                <span>Internal Confidential Notes</span>
              </div>
              {privateData.notes ? (
                <div className="rounded-lg bg-slate-50 border border-slate-200 p-2.5 text-slate-700 leading-relaxed whitespace-pre-wrap">
                  {privateData.notes}
                </div>
              ) : (
                <p className="text-slate-400 italic text-[11px]">No confidential notes recorded.</p>
              )}
            </div>

            {/* Metadata Footer */}
            <div className="text-[10px] text-slate-400 px-1 flex items-center justify-between">
              <span>Last Updated: {formatDate(privateData.updatedAt)}</span>
              <span>Tenant Scope: Authoritative</span>
            </div>
          </div>
        )}
      </div>

      <DialogFooter className="flex flex-row items-center justify-between gap-2">
        <div>
          {privateData && canWrite && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => onDeleteClick(privateData)}
              className="text-red-600 hover:bg-red-50 hover:text-red-700 border-red-200"
              leftIcon={<Trash2 className="h-3.5 w-3.5 text-red-500" />}
            >
              Delete Record
            </Button>
          )}
        </div>

        <div className="flex items-center gap-2">
          {privateData && canWrite && (
            <Button
              variant="primary"
              size="sm"
              onClick={() => onEditClick(privateData)}
              leftIcon={<Edit2 className="h-3.5 w-3.5" />}
            >
              Edit Private Info
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </div>
      </DialogFooter>
    </Dialog>
  );
}
