'use client';

import React, { useState, useEffect } from 'react';
import { firmApi } from '@/lib/api/firm';
import { Firm } from '@/types/firm';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { Skeleton } from '@/components/ui/Loading';
import { formatDate } from '@/lib/utils/formatters';
import { Building2, Globe, Mail, Phone, Video } from 'lucide-react';

export function FirmProfileCard() {
  const [firm, setFirm] = useState<Firm | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    firmApi
      .getMyFirm()
      .then((res) => {
        if (isMounted) {
          setFirm(res);
          setIsLoading(false);
        }
      })
      .catch((err: unknown) => {
        if (isMounted) {
          setError(err instanceof Error ? err.message : 'Failed to load firm profile.');
          setIsLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, []);

  if (isLoading) {
    return (
      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-2xs space-y-3">
        <Skeleton className="h-6 w-1/3" />
        <Skeleton className="h-4 w-1/2" />
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </div>
      </div>
    );
  }

  if (error || !firm) {
    return (
      <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-2xs text-xs text-slate-500">
        <p className="font-semibold text-slate-700">Firm Profile</p>
        <p className="text-slate-400 mt-0.5">{error || 'Firm profile information is unavailable.'}</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-2xs">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-900 text-white shadow-2xs shrink-0">
            <Building2 className="h-5 w-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-bold text-slate-900">{firm.name}</h2>
              <StatusBadge status={firm.isActive ? 'active' : 'suspended'} />
            </div>
            <div className="flex items-center gap-1.5 text-xs text-slate-500 font-mono mt-0.5">
              <Globe className="h-3.5 w-3.5 text-slate-400" />
              <span>tenant slug: {firm.slug}</span>
            </div>
          </div>
        </div>
        <div className="text-xs text-slate-500">
          Member organization since {formatDate(firm.createdAt)}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 pt-4 text-xs">
        <div>
          <span className="text-[10px] font-semibold uppercase text-slate-400 block mb-0.5">
            Contact Email
          </span>
          <div className="flex items-center gap-1.5 text-slate-700 font-medium truncate">
            <Mail className="h-3.5 w-3.5 text-slate-400 shrink-0" />
            <span className="truncate">{firm.contactEmail || 'Not specified'}</span>
          </div>
        </div>

        <div>
          <span className="text-[10px] font-semibold uppercase text-slate-400 block mb-0.5">
            Contact Phone
          </span>
          <div className="flex items-center gap-1.5 text-slate-700 font-medium">
            <Phone className="h-3.5 w-3.5 text-slate-400 shrink-0" />
            <span>{firm.contactPhone || 'Not specified'}</span>
          </div>
        </div>

        <div>
          <span className="text-[10px] font-semibold uppercase text-slate-400 block mb-0.5">
            Default Currency
          </span>
          <span className="text-slate-800 font-semibold">{firm.settings?.defaultCurrency || 'INR'}</span>
        </div>

        <div>
          <span className="text-[10px] font-semibold uppercase text-slate-400 block mb-0.5">
            Permitted Video
          </span>
          <div className="flex items-center gap-1 text-slate-700 font-medium">
            <Video className="h-3.5 w-3.5 text-slate-400 shrink-0" />
            <span className="capitalize">
              {(firm.settings?.allowedVideoProviders || ['youtube', 'vimeo']).join(', ')}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
