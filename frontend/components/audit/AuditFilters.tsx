/**
 * frontend/components/audit/AuditFilters.tsx
 *
 * Query filters component for Audit Trail.
 * Strictly adheres to backend query parameters defined in src/schemas/audit.schema.js.
 */

'use client';

import React from 'react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { AuditQueryParams, AUDIT_EVENT_TYPES, AuditOutcome } from '@/types/audit';
import { Filter, RotateCw, X } from 'lucide-react';

export interface AuditFiltersProps {
  filters: AuditQueryParams;
  onFilterChange: (newFilters: Partial<AuditQueryParams>) => void;
  onReset: () => void;
  onRefresh: () => void;
  isLoading: boolean;
  mode: 'tenant' | 'platform';
}

const RESOURCE_TYPES = ['plot', 'colony', 'user', 'firm', 'plotPrivate', 'auth'];

export function AuditFilters({
  filters,
  onFilterChange,
  onReset,
  onRefresh,
  isLoading,
  mode,
}: AuditFiltersProps) {
  const isPlatform = mode === 'platform';

  const hasActiveFilters = Boolean(
    filters.eventType ||
      filters.outcome ||
      filters.resourceType ||
      filters.dateFrom ||
      filters.dateTo ||
      filters.firmId ||
      filters.platformOnly
  );

  return (
    <div className="space-y-3 bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs">
      {/* Top Controls Row */}
      <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
        <div className="flex flex-wrap items-center gap-2">
          {/* Event Type Filter */}
          <select
            value={filters.eventType || ''}
            onChange={(e) => onFilterChange({ eventType: e.target.value || undefined, page: 1 })}
            className="h-9 rounded-lg border border-slate-300 bg-white px-2.5 py-1 text-xs text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
          >
            <option value="">All Event Types</option>
            {AUDIT_EVENT_TYPES.map((type) => (
              <option key={type} value={type}>
                {type}
              </option>
            ))}
          </select>

          {/* Outcome Filter */}
          <select
            value={filters.outcome || ''}
            onChange={(e) =>
              onFilterChange({
                outcome: (e.target.value as AuditOutcome) || undefined,
                page: 1,
              })
            }
            className="h-9 rounded-lg border border-slate-300 bg-white px-2.5 py-1 text-xs text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
          >
            <option value="">All Outcomes</option>
            <option value="success">Success Only</option>
            <option value="failure">Failure Only</option>
          </select>

          {/* Resource Type Filter */}
          <select
            value={filters.resourceType || ''}
            onChange={(e) =>
              onFilterChange({ resourceType: e.target.value || undefined, page: 1 })
            }
            className="h-9 rounded-lg border border-slate-300 bg-white px-2.5 py-1 text-xs text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
          >
            <option value="">All Resource Types</option>
            {RESOURCE_TYPES.map((res) => (
              <option key={res} value={res}>
                {res}
              </option>
            ))}
          </select>

          {/* Platform Mode Scope Filters */}
          {isPlatform && (
            <>
              <select
                value={
                  filters.platformOnly === 'true'
                    ? 'platform_only'
                    : filters.platformOnly === 'false'
                    ? 'all'
                    : 'all'
                }
                onChange={(e) => {
                  const val = e.target.value;
                  onFilterChange({
                    platformOnly: val === 'platform_only' ? 'true' : undefined,
                    page: 1,
                  });
                }}
                className="h-9 rounded-lg border border-slate-300 bg-white px-2.5 py-1 text-xs text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
              >
                <option value="all">Platform & Tenant Events</option>
                <option value="platform_only">Platform Events Only</option>
              </select>

              <div className="w-36">
                <Input
                  placeholder="Filter by Firm ID..."
                  value={filters.firmId || ''}
                  onChange={(e) =>
                    onFilterChange({ firmId: e.target.value.trim() || undefined, page: 1 })
                  }
                  className="h-9 text-xs"
                />
              </div>
            </>
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2 self-end sm:self-auto">
          {hasActiveFilters && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onReset}
              leftIcon={<X className="h-3.5 w-3.5" />}
              className="text-slate-500 hover:text-slate-700"
            >
              Reset Filters
            </Button>
          )}

          <Button
            variant="outline"
            size="sm"
            onClick={onRefresh}
            leftIcon={<RotateCw className={`h-3.5 w-3.5 ${isLoading ? 'animate-spin' : ''}`} />}
            disabled={isLoading}
          >
            Refresh
          </Button>
        </div>
      </div>

      {/* Date Range Row */}
      <div className="flex flex-wrap items-center gap-3 pt-2 text-xs border-t border-slate-100 text-slate-600">
        <div className="flex items-center gap-1.5 font-medium text-slate-500">
          <Filter className="h-3.5 w-3.5" />
          <span>Date Range:</span>
        </div>

        <div className="flex items-center gap-2">
          <label className="text-[11px] text-slate-500">From:</label>
          <input
            type="date"
            value={filters.dateFrom ? filters.dateFrom.split('T')[0] : ''}
            onChange={(e) =>
              onFilterChange({
                dateFrom: e.target.value ? new Date(e.target.value).toISOString() : undefined,
                page: 1,
              })
            }
            className="h-8 rounded-lg border border-slate-300 bg-white px-2 py-0.5 text-xs text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
          />
        </div>

        <div className="flex items-center gap-2">
          <label className="text-[11px] text-slate-500">To:</label>
          <input
            type="date"
            value={filters.dateTo ? filters.dateTo.split('T')[0] : ''}
            onChange={(e) =>
              onFilterChange({
                dateTo: e.target.value
                  ? new Date(new Date(e.target.value).setHours(23, 59, 59, 999)).toISOString()
                  : undefined,
                page: 1,
              })
            }
            className="h-8 rounded-lg border border-slate-300 bg-white px-2 py-0.5 text-xs text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
          />
        </div>

        <div className="ml-auto text-[11px] text-slate-400">
          Logs are immutable and append-only
        </div>
      </div>
    </div>
  );
}
