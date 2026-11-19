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
import { Video, ExternalLink, Calendar, MapPin, Maximize2, Tag, Lock, Sprout, Droplets, Zap, Shield } from 'lucide-react';

export interface AgriDetailsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  plot: Plot | null;
  colonies?: Colony[];
  onViewPrivateClick?: (plot: Plot) => void;
  onShareWhatsAppClick?: (plot: Plot) => void;
}

export function AgriDetailsModal({
  open,
  onOpenChange,
  plot,
  colonies = [],
  onViewPrivateClick,
  onShareWhatsAppClick,
}: AgriDetailsModalProps) {
  const { user } = useAuth();
  const isPlatformAdmin = isSuperAdmin(user);
  const canReadPrivate = !isPlatformAdmin && hasPermission(user, 'private:read');

  if (!plot) return null;

  const colony = plot.colonyId ? colonies.find((c) => c.id === plot.colonyId) : null;
  const videoUrl = plot.videoUrl || plot.video?.url;
  const isLease = plot.listingType === 'rent' || plot.listingType === 'lease';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogHeader>
        <div className="flex items-center justify-between pr-6">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-100 text-amber-900">
              <Sprout className="h-4 w-4" />
            </div>
            <div>
              <DialogTitle className="text-xl font-bold text-slate-900">
                {plot.plotRef || plot.plotId}
              </DialogTitle>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-amber-800 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                  Agricultural Land
                </span>
                <span
                  className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded border ${
                    isLease
                      ? 'bg-blue-50 text-blue-700 border-blue-200'
                      : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                  }`}
                >
                  {isLease ? 'For Rent / Lease' : 'For Sale'}
                </span>
              </div>
            </div>
          </div>
          <StatusBadge status={plot.status} />
        </div>
        <DialogDescription>
          Agricultural land listing, irrigation, road connectivity, and soil characteristics.
        </DialogDescription>
      </DialogHeader>

      <div className="space-y-4 my-2 text-xs">
        {/* Core Attributes Card */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 p-3.5 bg-slate-50/80 rounded-xl border border-slate-200">
          <div>
            <span className="text-[10px] font-semibold uppercase text-slate-400 block mb-1">
              Listing Purpose
            </span>
            <span
              className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold border ${
                isLease ? 'bg-blue-50 text-blue-700 border-blue-200' : 'bg-emerald-50 text-emerald-700 border-emerald-200'
              }`}
            >
              {isLease ? 'For Lease / Rent' : 'For Sale'}
            </span>
          </div>

          <div>
            <span className="text-[10px] font-semibold uppercase text-slate-400 block mb-1">
              Total Land Area
            </span>
            <div className="flex items-center gap-1.5 font-bold text-slate-900">
              <Maximize2 className="h-3.5 w-3.5 text-slate-400 shrink-0" />
              <span>
                {formatArea(plot.size, plot.sizeUnit)}
                {plot.dimensions ? ` (${plot.dimensions})` : ''}
              </span>
            </div>
          </div>

          <div>
            <span className="text-[10px] font-semibold uppercase text-slate-400 block mb-1">
              {isLease ? 'Lease Rate' : 'Price / Rate'}
            </span>
            <div className="flex items-center gap-1.5 font-bold text-slate-900">
              <Tag className="h-3.5 w-3.5 text-slate-400 shrink-0" />
              <span>{formatPlotRate(plot.rate, plot.rateType, plot.sizeUnit, plot.currency)}</span>
            </div>
          </div>

          <div>
            <span className="text-[10px] font-semibold uppercase text-slate-400 block mb-1">
              Water / Irrigation
            </span>
            <div className="flex items-center gap-1 text-slate-800 font-medium">
              <Droplets className="h-3.5 w-3.5 text-blue-500 shrink-0" />
              <span>{plot.waterSource || 'Not Specified'}</span>
            </div>
          </div>

          <div>
            <span className="text-[10px] font-semibold uppercase text-slate-400 block mb-1">
              Road Access
            </span>
            <span className="font-medium text-slate-800">
              {plot.roadAccess || 'Direct Access'}
            </span>
          </div>

          <div>
            <span className="text-[10px] font-semibold uppercase text-slate-400 block mb-1">
              Power & Fencing
            </span>
            <span className="font-medium text-slate-700">
              {[plot.electricity, plot.fencing].filter(Boolean).join(' • ') || 'Standard / Unspecified'}
            </span>
          </div>

          <div>
            <span className="text-[10px] font-semibold uppercase text-slate-400 block mb-1">
              Soil Type
            </span>
            <span className="font-medium text-slate-700">
              {plot.soilType || 'Agricultural Grade'}
            </span>
          </div>

          <div>
            <span className="text-[10px] font-semibold uppercase text-slate-400 block mb-1">
              Colony / Village / Region
            </span>
            <div className="flex items-center gap-1.5 font-medium text-slate-800">
              <MapPin className="h-3.5 w-3.5 text-slate-400 shrink-0" />
              <span className="truncate">{colony?.name || 'Independent Land'}</span>
            </div>
          </div>

          <div>
            <span className="text-[10px] font-semibold uppercase text-slate-400 block mb-1">
              Registered By (Advisor)
            </span>
            {plot.creator ? (
              <div>
                <span className="font-semibold text-slate-800 block">{plot.creator.name}</span>
                <span className="text-[10px] text-slate-500 font-mono block">{plot.creator.email}</span>
              </div>
            ) : (
              <span className="font-medium text-slate-700">Firm Administrator</span>
            )}
          </div>
        </div>

        {/* Video Tour Section */}
        {videoUrl && (
          <div className="p-3 bg-blue-50/50 rounded-xl border border-blue-200 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-100 text-blue-700">
                <Video className="h-4 w-4" />
              </div>
              <div>
                <p className="font-semibold text-slate-800 text-xs">Video Walkthrough Available</p>
                <p className="text-[10px] text-slate-500">Provider: {plot.videoProvider || 'Verified Provider'}</p>
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
              Public Description / Highlights
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
                <p className="font-semibold text-slate-800 text-xs">Confidential Land Owner & Source</p>
                <p className="text-[10px] text-slate-500">Protected under tenant access controls</p>
              </div>
            </div>
            {onViewPrivateClick && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => onViewPrivateClick(plot)}
                className="bg-white hover:bg-amber-100/50 border-amber-300 text-amber-900"
              >
                Access Owner Data
              </Button>
            )}
          </div>
        )}
      </div>

      <DialogFooter>
        <div className="flex w-full items-center justify-between">
          <div>
            {onShareWhatsAppClick && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => onShareWhatsAppClick(plot)}
                className="text-emerald-700 border-emerald-300 hover:bg-emerald-50"
              >
                Share on WhatsApp
              </Button>
            )}
          </div>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </div>
      </DialogFooter>
    </Dialog>
  );
}

