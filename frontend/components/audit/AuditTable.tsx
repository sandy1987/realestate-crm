/**
 * frontend/components/audit/AuditTable.tsx
 *
 * Audit logs table component with responsive layout and security-focused styling.
 */

'use client';

import React from 'react';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/Table';
import { Button } from '@/components/ui/Button';
import { AuditLog } from '@/types/audit';
import { formatDateTime } from '@/lib/utils/formatters';
import {
  CheckCircle2,
  XCircle,
  Eye,
  Lock,
  Landmark,
  MapPin,
  User,
  Building2,
  KeyRound,
  Shield,
} from 'lucide-react';

export interface AuditTableProps {
  logs: AuditLog[];
  onSelectLog: (log: AuditLog) => void;
  mode: 'tenant' | 'platform';
}

function getEventBadge(eventType: string) {
  if (eventType.startsWith('plot.private.')) {
    return (
      <span className="inline-flex items-center gap-1 rounded px-2 py-0.5 text-[11px] font-semibold bg-amber-50 text-amber-800 border border-amber-200">
        <Lock className="h-3 w-3 text-amber-600" />
        <span>Private Data</span>
      </span>
    );
  }
  if (eventType.startsWith('plot.')) {
    return (
      <span className="inline-flex items-center gap-1 rounded px-2 py-0.5 text-[11px] font-semibold bg-blue-50 text-blue-700 border border-blue-200">
        <Landmark className="h-3 w-3 text-blue-600" />
        <span>Plot</span>
      </span>
    );
  }
  if (eventType.startsWith('colony.')) {
    return (
      <span className="inline-flex items-center gap-1 rounded px-2 py-0.5 text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
        <MapPin className="h-3 w-3 text-emerald-600" />
        <span>Colony</span>
      </span>
    );
  }
  if (eventType.startsWith('user.')) {
    return (
      <span className="inline-flex items-center gap-1 rounded px-2 py-0.5 text-[11px] font-semibold bg-purple-50 text-purple-700 border border-purple-200">
        <User className="h-3 w-3 text-purple-600" />
        <span>User Mgmt</span>
      </span>
    );
  }
  if (eventType.startsWith('auth.')) {
    return (
      <span className="inline-flex items-center gap-1 rounded px-2 py-0.5 text-[11px] font-semibold bg-slate-100 text-slate-700 border border-slate-200">
        <KeyRound className="h-3 w-3 text-slate-500" />
        <span>Auth</span>
      </span>
    );
  }
  if (eventType.startsWith('platform.')) {
    return (
      <span className="inline-flex items-center gap-1 rounded px-2 py-0.5 text-[11px] font-semibold bg-rose-50 text-rose-700 border border-rose-200">
        <Building2 className="h-3 w-3 text-rose-600" />
        <span>Platform</span>
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1 rounded px-2 py-0.5 text-[11px] font-semibold bg-slate-50 text-slate-600 border border-slate-200">
      <Shield className="h-3 w-3 text-slate-400" />
      <span>General</span>
    </span>
  );
}

export function AuditTable({ logs, onSelectLog, mode }: AuditTableProps) {
  const isPlatform = mode === 'platform';

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Timestamp</TableHead>
            <TableHead>Event Type</TableHead>
            <TableHead>Action</TableHead>
            <TableHead>Outcome</TableHead>
            <TableHead>Actor</TableHead>
            <TableHead>Resource</TableHead>
            {isPlatform && <TableHead>Firm</TableHead>}
            <TableHead className="text-right">Inspect</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {logs.map((log) => {
            const isSuccess = log.outcome === 'success';

            return (
              <TableRow key={log.id}>
                <TableCell className="whitespace-nowrap">
                  <span className="text-xs font-medium text-slate-700">
                    {formatDateTime(log.createdAt)}
                  </span>
                </TableCell>

                <TableCell>
                  <div className="flex items-center gap-1.5">
                    {getEventBadge(log.eventType)}
                    <span className="font-mono text-[11px] text-slate-600 hidden sm:inline">
                      {log.eventType}
                    </span>
                  </div>
                </TableCell>

                <TableCell>
                  <span className="text-xs font-semibold text-slate-800 capitalize">
                    {log.action}
                  </span>
                </TableCell>

                <TableCell>
                  <span
                    className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                      isSuccess
                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                        : 'bg-red-50 text-red-700 border border-red-200'
                    }`}
                  >
                    {isSuccess ? (
                      <>
                        <CheckCircle2 className="h-3 w-3" />
                        <span>Success</span>
                      </>
                    ) : (
                      <>
                        <XCircle className="h-3 w-3" />
                        <span>Failure</span>
                      </>
                    )}
                  </span>
                </TableCell>

                <TableCell>
                  <div className="text-xs">
                    <span className="font-semibold text-slate-800">
                      {log.actorRole || 'System'}
                    </span>
                    {log.actorUserId && (
                      <span className="text-[10px] text-slate-400 block font-mono truncate max-w-[120px]">
                        {log.actorUserId}
                      </span>
                    )}
                  </div>
                </TableCell>

                <TableCell>
                  <div className="text-xs">
                    <span className="capitalize font-medium text-slate-800">
                      {log.resourceType}
                    </span>
                    {log.resourceId && (
                      <span className="text-[10px] text-slate-500 font-mono block truncate max-w-[130px]">
                        {log.resourceId}
                      </span>
                    )}
                  </div>
                </TableCell>

                {isPlatform && (
                  <TableCell>
                    <span className="text-xs font-mono text-slate-600 truncate block max-w-[120px]">
                      {log.firmId || 'Platform'}
                    </span>
                  </TableCell>
                )}

                <TableCell className="text-right">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => onSelectLog(log)}
                    aria-label={`Inspect event ${log.eventType}`}
                    className="h-8 w-8 p-0"
                    title="View details and metadata"
                  >
                    <Eye className="h-3.5 w-3.5 text-slate-600" />
                  </Button>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
