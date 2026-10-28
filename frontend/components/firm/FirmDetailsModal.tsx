'use client';

import React from 'react';
import { Dialog, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/Dialog';
import { Button } from '@/components/ui/Button';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { Firm } from '@/types/firm';
import { formatDate, formatDateTime } from '@/lib/utils/formatters';
import { Building2, Globe, Mail, Phone, Calendar, Video, ShieldCheck } from 'lucide-react';

export interface FirmDetailsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  firm: Firm | null;
}

export function FirmDetailsModal({ open, onOpenChange, firm }: FirmDetailsModalProps) {
  if (!firm) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogHeader>
        <div className="flex items-center justify-between pr-6">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-900 text-white">
              <Building2 className="h-4 w-4" />
            </div>
            <DialogTitle className="text-lg font-bold text-slate-900">{firm.name}</DialogTitle>
          </div>
          <StatusBadge status={firm.isActive ? 'active' : 'suspended'} />
        </div>
        <DialogDescription>
          Platform tenant profile and system configuration.
        </DialogDescription>
      </DialogHeader>

      <div className="space-y-4 my-2 text-xs">
        <div className="grid grid-cols-2 gap-3 p-3.5 bg-slate-50 rounded-xl border border-slate-200">
          <div>
            <span className="text-[10px] font-semibold uppercase text-slate-400 block mb-1">
              Tenant Slug
            </span>
            <div className="flex items-center gap-1.5 font-mono font-medium text-slate-800">
              <Globe className="h-3.5 w-3.5 text-slate-400 shrink-0" />
              <span>{firm.slug}</span>
            </div>
          </div>

          <div>
            <span className="text-[10px] font-semibold uppercase text-slate-400 block mb-1">
              Platform Status
            </span>
            <span className="font-semibold text-slate-800">
              {firm.isActive ? 'Active Tenant' : 'Suspended Organization'}
            </span>
          </div>

          <div>
            <span className="text-[10px] font-semibold uppercase text-slate-400 block mb-1">
              Contact Email
            </span>
            <div className="flex items-center gap-1.5 text-slate-700">
              <Mail className="h-3.5 w-3.5 text-slate-400 shrink-0" />
              <span className="truncate">{firm.contactEmail || '—'}</span>
            </div>
          </div>

          <div>
            <span className="text-[10px] font-semibold uppercase text-slate-400 block mb-1">
              Contact Phone
            </span>
            <div className="flex items-center gap-1.5 text-slate-700">
              <Phone className="h-3.5 w-3.5 text-slate-400 shrink-0" />
              <span>{firm.contactPhone || '—'}</span>
            </div>
          </div>

          <div>
            <span className="text-[10px] font-semibold uppercase text-slate-400 block mb-1">
              Default Currency
            </span>
            <span className="font-medium text-slate-800">
              {firm.settings?.defaultCurrency || 'INR'}
            </span>
          </div>

          <div>
            <span className="text-[10px] font-semibold uppercase text-slate-400 block mb-1">
              Provisioned Date
            </span>
            <div className="flex items-center gap-1.5 text-slate-600">
              <Calendar className="h-3.5 w-3.5 text-slate-400 shrink-0" />
              <span>{formatDate(firm.createdAt)}</span>
            </div>
          </div>
        </div>

        {/* Video Providers Allowed */}
        <div className="p-3 bg-white rounded-xl border border-slate-200">
          <div className="flex items-center gap-2 mb-1.5">
            <Video className="h-3.5 w-3.5 text-slate-500" />
            <span className="font-semibold text-slate-800">Allowed Video Providers:</span>
          </div>
          <div className="flex gap-2">
            {(firm.settings?.allowedVideoProviders || ['youtube', 'vimeo']).map((p) => (
              <span
                key={p}
                className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-blue-50 text-blue-700 border border-blue-200 capitalize"
              >
                {p}
              </span>
            ))}
          </div>
        </div>

        {/* Security & Audit Metadata */}
        <div className="flex items-start gap-2 text-[11px] text-slate-400 pt-1">
          <ShieldCheck className="h-3.5 w-3.5 shrink-0 mt-0.5 text-purple-600" />
          <span>
            Tenant Database ID: <code className="font-mono text-slate-600">{firm.id || firm._id}</code>. Last updated {formatDateTime(firm.updatedAt)}.
          </span>
        </div>
      </div>

      <DialogFooter>
        <Button variant="outline" onClick={() => onOpenChange(false)}>
          Close
        </Button>
      </DialogFooter>
    </Dialog>
  );
}
