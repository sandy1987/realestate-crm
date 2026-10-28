/**
 * frontend/components/audit/AuditDetailModal.tsx
 *
 * Inspector modal for an individual immutable audit record.
 *
 * Confidentiality & Data Minimization:
 *  - Safely renders non-sensitive metadata key-value pairs.
 *  - Explicitly suppresses forbidden keys (passwords, tokens, private owner details).
 *  - Formats timestamps and identifiers cleanly.
 */

'use client';

import React from 'react';
import { Dialog, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/Dialog';
import { Button } from '@/components/ui/Button';
import { AuditLog } from '@/types/audit';
import { formatDateTime } from '@/lib/utils/formatters';
import {
  ShieldCheck,
  CheckCircle2,
  XCircle,
  User,
  Calendar,
  Globe,
  Monitor,
  Hash,
  Database,
  Tag,
} from 'lucide-react';

export interface AuditDetailModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  log: AuditLog | null;
}

// Strictly forbidden keys that must never be rendered in audit UI
const FORBIDDEN_METADATA_KEYS = new Set([
  'password',
  'passwordhash',
  'token',
  'refreshtoken',
  'tokenhash',
  'owner',
  'source',
  'notes',
  'ownerphone',
  'owneremail',
  'owneraddress',
  'sourcephone',
  'sourceemail',
  'sourcetype',
  'nationalid',
  'aadhaar',
  'ssn',
  'authorization',
  'cookie',
]);

export function AuditDetailModal({ open, onOpenChange, log }: AuditDetailModalProps) {
  if (!log) return null;

  const isSuccess = log.outcome === 'success';

  // Filter metadata safely
  const safeMetadataEntries = Object.entries(log.metadata || {}).filter(
    ([key]) => !FORBIDDEN_METADATA_KEYS.has(key.toLowerCase())
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogHeader>
        <div className="flex items-center justify-between pr-6">
          <div className="flex items-center gap-2.5">
            <div
              className={`flex h-9 w-9 items-center justify-center rounded-lg ${
                isSuccess ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'
              }`}
            >
              <ShieldCheck className="h-5 w-5" />
            </div>
            <div>
              <DialogTitle className="text-base font-bold text-slate-900 font-mono">
                {log.eventType}
              </DialogTitle>
              <span className="text-[11px] text-slate-500 font-normal">
                Action: <strong className="text-slate-700 capitalize">{log.action}</strong>
              </span>
            </div>
          </div>
          <span
            className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold ${
              isSuccess
                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                : 'bg-red-50 text-red-700 border border-red-200'
            }`}
          >
            {isSuccess ? (
              <>
                <CheckCircle2 className="h-3.5 w-3.5" />
                <span>Success</span>
              </>
            ) : (
              <>
                <XCircle className="h-3.5 w-3.5" />
                <span>Failure</span>
              </>
            )}
          </span>
        </div>
        <DialogDescription className="text-xs text-slate-500 mt-1">
          Immutable event record details and operational context.
        </DialogDescription>
      </DialogHeader>

      <div className="my-3 space-y-3.5 text-xs">
        {/* Core Attributes Card */}
        <div className="grid grid-cols-2 gap-3 p-3.5 bg-slate-50 rounded-xl border border-slate-200">
          <div>
            <span className="text-[10px] font-semibold uppercase text-slate-400 block mb-0.5">
              Event Timestamp
            </span>
            <div className="flex items-center gap-1.5 font-medium text-slate-800">
              <Calendar className="h-3.5 w-3.5 text-slate-400" />
              <span>{formatDateTime(log.createdAt)}</span>
            </div>
          </div>

          <div>
            <span className="text-[10px] font-semibold uppercase text-slate-400 block mb-0.5">
              Actor Role & User ID
            </span>
            <div className="flex items-center gap-1.5 font-medium text-slate-800 truncate">
              <User className="h-3.5 w-3.5 text-slate-400 shrink-0" />
              <span className="truncate">
                {log.actorRole || 'System'} {log.actorUserId ? `(${log.actorUserId})` : ''}
              </span>
            </div>
          </div>

          <div>
            <span className="text-[10px] font-semibold uppercase text-slate-400 block mb-0.5">
              Target Resource
            </span>
            <div className="flex items-center gap-1.5 font-medium text-slate-800">
              <Database className="h-3.5 w-3.5 text-slate-400" />
              <span className="capitalize">{log.resourceType}</span>
              {log.resourceId && (
                <span className="text-[11px] font-mono text-slate-500">[{log.resourceId}]</span>
              )}
            </div>
          </div>

          <div>
            <span className="text-[10px] font-semibold uppercase text-slate-400 block mb-0.5">
              Firm Scope
            </span>
            <div className="flex items-center gap-1.5 font-medium text-slate-800 truncate font-mono text-[11px]">
              <Tag className="h-3.5 w-3.5 text-slate-400 shrink-0" />
              <span className="truncate">{log.firmId || 'Platform Scope (Global)'}</span>
            </div>
          </div>
        </div>

        {/* Network & Tracing Card */}
        <div className="grid grid-cols-2 gap-3 p-3 bg-white rounded-xl border border-slate-200">
          <div>
            <span className="text-[10px] font-semibold uppercase text-slate-400 block mb-0.5">
              Request Correlation ID
            </span>
            <div className="flex items-center gap-1.5 text-slate-700 font-mono text-[11px] truncate">
              <Hash className="h-3.5 w-3.5 text-slate-400 shrink-0" />
              <span className="truncate">{log.requestId || '—'}</span>
            </div>
          </div>

          <div>
            <span className="text-[10px] font-semibold uppercase text-slate-400 block mb-0.5">
              Client IP Address
            </span>
            <div className="flex items-center gap-1.5 text-slate-700 font-mono text-[11px]">
              <Globe className="h-3.5 w-3.5 text-slate-400 shrink-0" />
              <span>{log.ipAddress || '—'}</span>
            </div>
          </div>

          {log.userAgent && (
            <div className="col-span-2">
              <span className="text-[10px] font-semibold uppercase text-slate-400 block mb-0.5">
                User Agent
              </span>
              <div className="flex items-start gap-1.5 text-slate-600 text-[11px] leading-tight">
                <Monitor className="h-3.5 w-3.5 text-slate-400 shrink-0 mt-0.5" />
                <span className="break-all">{log.userAgent}</span>
              </div>
            </div>
          )}
        </div>

        {/* Metadata Details Card */}
        <div className="rounded-xl border border-slate-200 bg-white p-3.5 space-y-2">
          <span className="text-[10px] font-semibold uppercase text-slate-400 block">
            Sanitized Operational Metadata
          </span>
          {safeMetadataEntries.length > 0 ? (
            <div className="space-y-1.5 max-h-48 overflow-y-auto">
              {safeMetadataEntries.map(([key, val]) => (
                <div
                  key={key}
                  className="flex items-start justify-between py-1 border-b border-slate-100 last:border-b-0 text-xs"
                >
                  <span className="font-mono text-slate-500 font-medium">{key}:</span>
                  <span className="font-semibold text-slate-900 text-right max-w-xs break-all">
                    {typeof val === 'object' && val !== null
                      ? JSON.stringify(val)
                      : String(val ?? '—')}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-slate-400 italic text-[11px]">No additional metadata recorded.</p>
          )}
        </div>
      </div>

      <DialogFooter>
        <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
          Close
        </Button>
      </DialogFooter>
    </Dialog>
  );
}
