'use client';

import React from 'react';
import { Dialog, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/Dialog';
import { Button } from '@/components/ui/Button';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { Plot } from '@/types/plot';
import { Colony } from '@/types/colony';
import { formatArea, formatPlotRate, formatDate, formatDateTime } from '@/lib/utils/formatters';
import { useAuth } from '@/lib/context/AuthContext';
import { hasPermission, isSuperAdmin } from '@/lib/utils/permissions';
import { Video, ExternalLink, Calendar, MapPin, Maximize2, Tag, Info, Lock } from 'lucide-react';

export interface PlotDetailsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  plot: Plot | null;
  colonies?: Colony[];
  onViewPrivateClick?: (plot: Plot) => void;
  onShareWhatsAppClick?: (plot: Plot) => void;
}

export function PlotDetailsModal({
  open,
  onOpenChange,
  plot,
  colonies = [],
  onViewPrivateClick,
  onShareWhatsAppClick,
}: PlotDetailsModalProps) {
  const { user } = useAuth();
  const isPlatformAdmin = isSuperAdmin(user);
  const canReadPrivate = !isPlatformAdmin && hasPermission(user, 'private:read');

  if (!plot) return null;

  const colony = plot.colonyId ? colonies.find((c) => c.id === plot.colonyId) : null;
  const videoUrl = plot.videoUrl || plot.video?.url;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogHeader>
        <div className="flex items-center justify-between pr-6">
          <DialogTitle className="text-xl font-bold text-slate-900">
            {plot.plotRef || plot.plotId}
          </DialogTitle>
          <StatusBadge status={plot.status} />
        </div>
        <DialogDescription>
          Public real estate inventory listing specification.
        </DialogDescription>
      </DialogHeader>

      <div className="space-y-4 my-2 text-xs">
        {/* Core Attributes Card */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 p-3.5 bg-slate-50/80 rounded-xl border border-slate-200">
          <div>
            <span className="text-[10px] font-semibold uppercase text-slate-400 block mb-1">
              Colony / Sector
            </span>
            <div className="flex items-center gap-1.5 font-medium text-slate-800">
              <MapPin className="h-3.5 w-3.5 text-slate-400 shrink-0" />
              <span className="truncate">{colony?.name || 'Independent / None'}</span>
            </div>
            {colony?.city && (
              <span className="text-[10px] text-slate-500 block ml-5">
                {[colony.city, colony.state].filter(Boolean).join(', ')}
              </span>
            )}
          </div>

          <div>
            <span className="text-[10px] font-semibold uppercase text-slate-400 block mb-1">
              Plot Size
            </span>
            <div className="flex items-center gap-1.5 font-semibold text-slate-800">
              <Maximize2 className="h-3.5 w-3.5 text-slate-400 shrink-0" />
              <span>{formatArea(plot.size, plot.sizeUnit)}</span>
            </div>
          </div>

          <div>
            <span className="text-[10px] font-semibold uppercase text-slate-400 block mb-1">
              Pricing / Rate
            </span>
            <div className="flex items-center gap-1.5 font-semibold text-slate-800">
              <Tag className="h-3.5 w-3.5 text-slate-400 shrink-0" />
              <span>{formatPlotRate(plot.rate, plot.rateType, plot.sizeUnit, plot.currency)}</span>
            </div>
          </div>

          <div>
            <span className="text-[10px] font-semibold uppercase text-slate-400 block mb-1">
              Plot Date
            </span>
            <div className="flex items-center gap-1.5 text-slate-700">
              <Calendar className="h-3.5 w-3.5 text-slate-400 shrink-0" />
              <span>{formatDate(plot.plotDate)}</span>
            </div>
          </div>

          <div>
            <span className="text-[10px] font-semibold uppercase text-slate-400 block mb-1">
              Listing Status
            </span>
            <span className="text-slate-700">
              {plot.isActive ? 'Active in Directory' : 'Inactive / Soft Deleted'}
            </span>
          </div>

          <div>
            <span className="text-[10px] font-semibold uppercase text-slate-400 block mb-1">
              Registered On
            </span>
            <span className="text-slate-500">{formatDateTime(plot.createdAt)}</span>
          </div>
        </div>

        {/* Video Tour Section (Safe external link) */}
        {videoUrl && (
          <div className="p-3 bg-blue-50/50 rounded-xl border border-blue-200 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-100 text-blue-700">
                <Video className="h-4 w-4" />
              </div>
              <div>
                <p className="font-semibold text-slate-800 text-xs">Video Walkthrough Available</p>
                <p className="text-[10px] text-slate-500">
                  Provider: {plot.videoProvider || 'Verified Provider'}
                </p>
              </div>
            </div>
            <a
              href={videoUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-xs font-semibold text-blue-600 hover:text-blue-800 hover:underline px-2.5 py-1.5 rounded-md hover:bg-blue-100/50 transition-colors"
            >
              <span>Watch Video</span>
              <ExternalLink className="h-3 w-3" />
            </a>
          </div>
        )}

        {/* Public Notes / Description */}
        {plot.description && (
          <div className="space-y-1">
            <span className="text-[10px] font-semibold uppercase text-slate-400 block">
              Public Description
            </span>
            <div className="rounded-lg bg-white border border-slate-200 p-3 text-slate-700 leading-relaxed whitespace-pre-wrap">
              {plot.description}
            </div>
          </div>
        )}

        {/* Confidential Private Data Card */}
        {canReadPrivate && (
          <div className="p-3 bg-amber-50/70 rounded-xl border border-amber-200/80 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-100 text-amber-800">
                <Lock className="h-4 w-4" />
              </div>
              <div>
                <p className="font-semibold text-slate-800 text-xs">Confidential Owner & Source</p>
                <p className="text-[10px] text-slate-500">
                  Protected under tenant access controls
                </p>
              </div>
            </div>
            {onViewPrivateClick && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => onViewPrivateClick(plot)}
                leftIcon={<Lock className="h-3 w-3 text-amber-700" />}
                className="border-amber-300 bg-white hover:bg-amber-100/60 text-amber-900"
              >
                View Private Data
              </Button>
            )}
          </div>
        )}

        {/* Privacy Assurance Notice */}
        <div className="flex items-start gap-2 text-[11px] text-slate-400 pt-1">
          <Info className="h-3.5 w-3.5 shrink-0 mt-0.5 text-slate-400" />
          <span>
            Public view only. Private owner and contact details are protected under tenant access controls.
          </span>
        </div>
      </div>

      <DialogFooter className="flex flex-row items-center justify-between gap-2">
        {onShareWhatsAppClick ? (
          <Button
            type="button"
            size="sm"
            onClick={() => onShareWhatsAppClick(plot)}
            className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold gap-1.5 cursor-pointer shadow-2xs"
          >
            <svg
              className="h-3.5 w-3.5"
              viewBox="0 0 24 24"
              fill="currentColor"
              aria-hidden="true"
            >
              <path d="M12.031 2C6.516 2 2.027 6.488 2.027 12c0 1.93.551 3.734 1.508 5.267L2 22l4.871-1.488A9.92 9.92 0 0 0 12.03 22c5.517 0 10.007-4.488 10.007-10s-4.49-10-10.006-10zm5.859 14.167c-.246.688-1.433 1.328-1.973 1.383-.51.055-1.168.082-3.375-.828-2.656-1.094-4.363-3.797-4.496-3.973-.133-.176-1.082-1.441-1.082-2.742 0-1.305.688-1.945.934-2.211.246-.266.535-.332.715-.332.179 0 .359 0 .515.012.168.012.395-.066.617.473.23.559.789 1.922.859 2.063.07.141.117.309.023.496-.094.188-.141.305-.281.473-.141.168-.297.375-.426.504-.145.145-.297.305-.129.594.168.289.746 1.234 1.602 1.996 1.102.98 2.031 1.285 2.32 1.426.289.141.457.121.625-.07.168-.191.719-.836.91-1.125.191-.289.383-.242.641-.148.258.094 1.637.773 1.918.914.281.141.469.211.539.328.07.117.07.68-.176 1.368z" />
            </svg>
            <span>Share via WhatsApp</span>
          </Button>
        ) : (
          <div />
        )}
        <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
          Close
        </Button>
      </DialogFooter>
    </Dialog>
  );
}
