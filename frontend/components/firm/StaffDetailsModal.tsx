'use client';

import React from 'react';
import { Dialog, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/Dialog';
import { Button } from '@/components/ui/Button';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { UserSummary } from '@/types/user';
import { formatDate, formatDateTime } from '@/lib/utils/formatters';
import { User, Mail, Calendar, Clock, ShieldCheck, Key } from 'lucide-react';

export interface StaffDetailsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user: UserSummary | null;
}

export function StaffDetailsModal({ open, onOpenChange, user }: StaffDetailsModalProps) {
  if (!user) return null;

  const isFirmAdmin = user.role === 'FIRM_ADMIN';
  const fullName = [user.firstName, user.lastName].filter(Boolean).join(' ') || '—';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogHeader>
        <div className="flex items-center justify-between pr-6">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-900 text-white">
              <User className="h-4 w-4" />
            </div>
            <div>
              <DialogTitle className="text-lg font-bold text-slate-900">{fullName}</DialogTitle>
              <p className="text-xs text-slate-500">{user.email}</p>
            </div>
          </div>
          <StatusBadge status={!user.isSuspended && user.isActive ? 'active' : 'suspended'} />
        </div>
        <DialogDescription>
          Firm account details, role specification, and granted capabilities.
        </DialogDescription>
      </DialogHeader>

      <div className="space-y-4 my-2 text-xs">
        <div className="grid grid-cols-2 gap-3 p-3.5 bg-slate-50 rounded-xl border border-slate-200">
          <div>
            <span className="text-[10px] font-semibold uppercase text-slate-400 block mb-1">
              Account Role
            </span>
            <span
              className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold border ${
                isFirmAdmin
                  ? 'bg-blue-50 text-blue-700 border-blue-200'
                  : 'bg-slate-100 text-slate-700 border-slate-200'
              }`}
            >
              {user.role}
            </span>
          </div>

          <div>
            <span className="text-[10px] font-semibold uppercase text-slate-400 block mb-1">
              Account Status
            </span>
            <span className="font-semibold text-slate-800">
              {user.isSuspended ? 'Suspended' : user.isActive ? 'Active' : 'Inactive'}
            </span>
          </div>

          <div>
            <span className="text-[10px] font-semibold uppercase text-slate-400 block mb-1">
              Email Address
            </span>
            <div className="flex items-center gap-1.5 text-slate-700 font-medium">
              <Mail className="h-3.5 w-3.5 text-slate-400 shrink-0" />
              <span className="truncate">{user.email}</span>
            </div>
          </div>

          <div>
            <span className="text-[10px] font-semibold uppercase text-slate-400 block mb-1">
              Last Login
            </span>
            <div className="flex items-center gap-1.5 text-slate-600">
              <Clock className="h-3.5 w-3.5 text-slate-400 shrink-0" />
              <span>{formatDateTime(user.lastLoginAt)}</span>
            </div>
          </div>

          <div>
            <span className="text-[10px] font-semibold uppercase text-slate-400 block mb-1">
              Registered Date
            </span>
            <div className="flex items-center gap-1.5 text-slate-600">
              <Calendar className="h-3.5 w-3.5 text-slate-400 shrink-0" />
              <span>{formatDate(user.createdAt)}</span>
            </div>
          </div>

          <div>
            <span className="text-[10px] font-semibold uppercase text-slate-400 block mb-1">
              User ID
            </span>
            <span className="font-mono text-slate-600">{user.id || user._id}</span>
          </div>
        </div>

        {/* Assigned Permissions */}
        <div className="p-3.5 bg-white rounded-xl border border-slate-200 space-y-2">
          <div className="flex items-center gap-2">
            <Key className="h-3.5 w-3.5 text-slate-600" />
            <span className="font-semibold text-slate-800">
              {isFirmAdmin ? 'Implicit Capabilities' : 'Granted Capabilities'}
            </span>
          </div>

          {isFirmAdmin ? (
            <p className="text-slate-600">
              As a Firm Administrator, this user implicitly holds full permissions across all firm resources.
            </p>
          ) : user.permissions && user.permissions.length > 0 ? (
            <div className="flex flex-wrap gap-1.5 pt-1">
              {user.permissions.map((perm) => (
                <span
                  key={perm}
                  className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-mono bg-slate-100 text-slate-700 border border-slate-200"
                >
                  {perm}
                </span>
              ))}
            </div>
          ) : (
            <p className="text-slate-400 italic">No specific permissions granted yet.</p>
          )}
        </div>

        {/* Privacy & Security Note */}
        <div className="flex items-start gap-2 text-[11px] text-slate-400 pt-1">
          <ShieldCheck className="h-3.5 w-3.5 shrink-0 mt-0.5 text-blue-600" />
          <span>
            Passwords and private cryptographic credentials are encrypted with Argon2id on the backend and are never
            stored or retrievable.
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
