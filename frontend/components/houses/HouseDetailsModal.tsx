'use client';

import React from 'react';
import { Dialog, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/Dialog';
import { Button } from '@/components/ui/Button';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { Plot } from '@/types/plot';
import { Colony } from '@/types/colony';
import { formatPlotRate, formatDate, formatDateTime } from '@/lib/utils/formatters';
import { useAuth } from '@/lib/context/AuthContext';
import { hasPermission, isSuperAdmin } from '@/lib/utils/permissions';
import {
  Video,
  ExternalLink,
  MapPin,
  Lock,
  Home,
  Shield,
  Building,
  Compass,
  Car,
  Layers,
} from 'lucide-react';

export interface HouseDetailsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  plot: Plot | null;
  colonies?: Colony[];
  onViewPrivateClick?: (plot: Plot) => void;
  onShareWhatsAppClick?: (plot: Plot) => void;
}

// WhatsApp Icon SVG
function WhatsAppIcon({ className = 'h-3.5 w-3.5' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M12.031 2C6.516 2 2.027 6.488 2.027 12c0 1.93.551 3.734 1.508 5.267L2 22l4.871-1.488A9.92 9.92 0 0 0 12.03 22c5.517 0 10.007-4.488 10.007-10s-4.49-10-10.006-10zm5.859 14.167c-.246.688-1.433 1.328-1.973 1.383-.51.055-1.168.082-3.375-.828-2.656-1.094-4.363-3.797-4.496-3.973-.133-.176-1.082-1.441-1.082-2.742 0-1.305.688-1.945.934-2.211.246-.266.535-.332.715-.332.179 0 .359 0 .515.012.168.012.395-.066.617.473.23.559.789 1.922.859 2.063.07.141.117.309.023.496-.094.188-.141.305-.281.473-.141.168-.297.375-.426.504-.145.145-.297.305-.129.594.168.289.746 1.234 1.602 1.996 1.102.98 2.031 1.285 2.32 1.426.289.141.457.121.625-.07.168-.191.719-.836.91-1.125.191-.289.383-.242.641-.148.258.094 1.637.773 1.918.914.281.141.469.211.539.328.07.117.07.68-.176 1.368z" />
    </svg>
  );
}

const furnishingLabels: Record<string, string> = {
  unfurnished: 'Unfurnished',
  semi_furnished: 'Semi-Furnished',
  fully_furnished: 'Fully Furnished',
};

export function HouseDetailsModal({
  open,
  onOpenChange,
  plot,
  colonies = [],
  onViewPrivateClick,
  onShareWhatsAppClick,
}: HouseDetailsModalProps) {
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
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-100 text-blue-800">
              <Home className="h-5 w-5" />
            </div>
            <div>
              <DialogTitle className="text-xl font-bold text-slate-900">
                {plot.plotRef || plot.plotId}
              </DialogTitle>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                  {plot.houseType || 'House / Flat'}
                </span>
                {plot.bhk && (
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-200">
                    {plot.bhk}
                  </span>
                )}
              </div>
            </div>
          </div>
          <StatusBadge status={plot.status} />
        </div>
        <DialogDescription>
          Residential house / flat specifications, architectural layout, and sale pricing.
        </DialogDescription>
      </DialogHeader>

      <div className="space-y-4 my-2 text-xs">
        {/* Top Key Specs Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 p-3.5 bg-slate-50 rounded-xl border border-slate-200">
          <div>
            <span className="text-[10px] font-semibold uppercase text-slate-400 block mb-1">
              Colony / Location
            </span>
            <div className="flex items-center gap-1.5 font-medium text-slate-800">
              <MapPin className="h-3.5 w-3.5 text-slate-400 shrink-0" />
              <span>{colony ? colony.name : 'Independent Location'}</span>
            </div>
          </div>

          <div>
            <span className="text-[10px] font-semibold uppercase text-slate-400 block mb-1">
              Society / Project
            </span>
            <div className="flex items-center gap-1.5 font-medium text-slate-800">
              <Building className="h-3.5 w-3.5 text-slate-400 shrink-0" />
              <span>{plot.societyName || '—'}</span>
            </div>
          </div>

          <div>
            <span className="text-[10px] font-semibold uppercase text-slate-400 block mb-1">
              Floor / Storey
            </span>
            <div className="flex items-center gap-1.5 font-medium text-slate-800">
              <Layers className="h-3.5 w-3.5 text-slate-400 shrink-0" />
              <span>
                {plot.floorNo || '—'}
                {plot.totalFloors ? ` (Total ${plot.totalFloors} Floors)` : ''}
              </span>
            </div>
          </div>

          <div>
            <span className="text-[10px] font-semibold uppercase text-slate-400 block mb-1">
              Built-up Area
            </span>
            <span className="font-semibold text-slate-900 text-sm">
              {plot.size ? `${Number(plot.size).toLocaleString('en-IN')} ${plot.sizeUnit || 'sqft'}` : '—'}
            </span>
            {plot.plotArea && (
              <span className="text-[10px] text-slate-500 block">
                Plot: {Number(plot.plotArea).toLocaleString('en-IN')} sq.yd
              </span>
            )}
          </div>

          <div>
            <span className="text-[10px] font-semibold uppercase text-slate-400 block mb-1">
              Total Sale Price
            </span>
            <span className="font-semibold text-slate-800 text-sm">
              {formatPlotRate(plot.rate, 'total', plot.sizeUnit, plot.currency)}
            </span>
          </div>

          <div>
            <span className="text-[10px] font-semibold uppercase text-slate-400 block mb-1">
              Furnishing
            </span>
            <span className="font-medium text-slate-800 capitalize">
              {plot.furnishing ? furnishingLabels[plot.furnishing] || plot.furnishing : '—'}
            </span>
          </div>

          <div>
            <span className="text-[10px] font-semibold uppercase text-slate-400 block mb-1">
              Bathrooms & Balconies
            </span>
            <span className="font-medium text-slate-800">
              {plot.bathrooms !== null && plot.bathrooms !== undefined ? `${plot.bathrooms} Baths` : '—'}
              {plot.balconies !== null && plot.balconies !== undefined ? ` • ${plot.balconies} Balconies` : ''}
            </span>
          </div>

          <div>
            <span className="text-[10px] font-semibold uppercase text-slate-400 block mb-1">
              Parking Facility
            </span>
            <div className="flex items-center gap-1.5 font-medium text-slate-800">
              <Car className="h-3.5 w-3.5 text-slate-400 shrink-0" />
              <span>{plot.parking || '—'}</span>
            </div>
          </div>

          <div>
            <span className="text-[10px] font-semibold uppercase text-slate-400 block mb-1">
              Lift & Facing
            </span>
            <div className="flex items-center gap-1.5 font-medium text-slate-800">
              <Compass className="h-3.5 w-3.5 text-slate-400 shrink-0" />
              <span>
                {plot.facing ? plot.facing.split(' ')[0] : '—'}
                {plot.lift !== null && plot.lift !== undefined
                  ? ` • Lift: ${plot.lift ? 'Yes' : 'No'}`
                  : ''}
              </span>
            </div>
          </div>
        </div>

        {/* Construction Status & Dates */}
        <div className="grid grid-cols-2 gap-3 p-3 bg-white rounded-xl border border-slate-200">
          <div>
            <span className="text-[10px] font-semibold uppercase text-slate-400 block mb-1">
              Construction Readiness
            </span>
            <span className="font-semibold text-slate-800">
              {plot.constructionStatus || 'Ready to Move'}
            </span>
          </div>

          <div>
            <span className="text-[10px] font-semibold uppercase text-slate-400 block mb-1">
              Listing Advisor
            </span>
            <span className="font-semibold text-slate-800">
              {plot.creator?.name || 'Firm Staff / Admin'}
            </span>
          </div>
        </div>

        {/* Marketing Highlights */}
        {plot.description && (
          <div className="p-3 bg-white rounded-xl border border-slate-200">
            <span className="text-[10px] font-semibold uppercase text-slate-400 block mb-1">
              Marketing Highlights & Features
            </span>
            <p className="text-slate-700 whitespace-pre-line leading-relaxed">{plot.description}</p>
          </div>
        )}

        {/* Video Tour Walkthrough */}
        {videoUrl && (
          <div className="p-3 bg-white rounded-xl border border-slate-200 space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-slate-800 font-semibold">
                <Video className="h-4 w-4 text-purple-600" />
                <span>Video Tour / Walkthrough</span>
              </div>
              <a
                href={videoUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-[11px] text-purple-600 hover:text-purple-700 font-medium"
              >
                <span>Open in New Tab</span>
                <ExternalLink className="h-3 w-3" />
              </a>
            </div>

            {videoUrl.includes('cloudinary') ? (
              <video src={videoUrl} controls className="w-full rounded-lg max-h-56 bg-black" />
            ) : videoUrl.includes('youtube.com') || videoUrl.includes('youtu.be') ? (
              <div className="relative pt-[56.25%] rounded-lg overflow-hidden bg-black">
                <iframe
                  src={
                    videoUrl.includes('watch?v=')
                      ? videoUrl.replace('watch?v=', 'embed/')
                      : videoUrl.replace('youtu.be/', 'www.youtube.com/embed/')
                  }
                  className="absolute inset-0 w-full h-full"
                  allowFullScreen
                  title="YouTube walkthrough"
                />
              </div>
            ) : (
              <div className="p-3 bg-purple-50 rounded-lg text-purple-800 text-[11px] flex items-center justify-between">
                <span>External Video Tour Link Available</span>
                <a href={videoUrl} target="_blank" rel="noopener noreferrer" className="underline font-semibold">
                  Watch Video Walkthrough
                </a>
              </div>
            )}
          </div>
        )}

        {/* Property Photos Gallery */}
        {plot.images && plot.images.length > 0 && (
          <div className="p-3 bg-white rounded-xl border border-slate-200 space-y-2">
            <span className="text-[10px] font-semibold uppercase text-slate-400 block mb-1">
              Property Photos ({plot.images.length})
            </span>
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
              {plot.images.map((img, idx) => (
                <a
                  key={idx}
                  href={img.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="aspect-square rounded-lg overflow-hidden border border-slate-200 block hover:opacity-90 transition-opacity bg-slate-100"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={img.url} alt={`Photo ${idx + 1}`} className="w-full h-full object-cover" />
                </a>
              ))}
            </div>
          </div>
        )}

        {/* Security & Audit Metadata */}
        <div className="flex items-start gap-2 text-[11px] text-slate-400 pt-1">
          <Shield className="h-3.5 w-3.5 shrink-0 mt-0.5 text-blue-600" />
          <span>
            Database ID: <code className="font-mono text-slate-600">{plot.id}</code>. Registered{' '}
            {formatDate(plot.createdAt)}. Last updated {formatDateTime(plot.updatedAt)}.
          </span>
        </div>
      </div>

      <DialogFooter className="flex flex-row items-center justify-between border-t border-slate-100 pt-3">
        <div className="flex items-center gap-2">
          {onShareWhatsAppClick && (
            <Button
              type="button"
              size="sm"
              onClick={() => onShareWhatsAppClick(plot)}
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-medium gap-1.5 text-xs shadow-2xs"
            >
              <WhatsAppIcon className="h-3.5 w-3.5" />
              <span>Share WhatsApp</span>
            </Button>
          )}

          {canReadPrivate && onViewPrivateClick && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onViewPrivateClick(plot)}
              className="text-amber-700 border-amber-300 hover:bg-amber-50 gap-1.5 text-xs"
            >
              <Lock className="h-3.5 w-3.5" />
              <span>Owner Details</span>
            </Button>
          )}
        </div>

        <Button variant="outline" onClick={() => onOpenChange(false)}>
          Close
        </Button>
      </DialogFooter>
    </Dialog>
  );
}

