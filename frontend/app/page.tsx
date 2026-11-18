'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/context/AuthContext';
import { plotsApi } from '@/lib/api/plots';
import { coloniesApi } from '@/lib/api/colonies';
import { auditApi } from '@/lib/api/audit';
import { Plot } from '@/types/plot';
import { Colony } from '@/types/colony';
import { AuditLog } from '@/types/audit';
import { MetricCard } from '@/components/shared/MetricCard';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from '@/components/ui/Table';
import { Badge } from '@/components/ui/Badge';
import { EmptyState } from '@/components/ui/EmptyState';
import { Skeleton } from '@/components/ui/Loading';
import { formatCurrency, formatArea, formatDate } from '@/lib/utils/formatters';
import {
  Landmark,
  MapPin,
  CheckCircle2,
  Clock,
  PlusCircle,
  ShieldCheck,
  Building,
  ExternalLink,
  Activity,
} from 'lucide-react';

function formatEventTitle(eventType: string): string {
  const titles: Record<string, string> = {
    'platform.firm.provisioned': 'Tenant Firm Created',
    'platform.firm.updated': 'Tenant Firm Updated',
    'platform.firm.suspended': 'Firm Suspended',
    'platform.firm.activated': 'Firm Activated',
    'auth.login.success': 'User Signed In',
    'auth.login.failure': 'Failed Login Attempt',
    'auth.logout': 'User Signed Out',
    'auth.password.changed': 'Password Changed',
    'user.created': 'User Account Created',
    'user.updated': 'User Account Updated',
    'colony.created': 'New Colony Created',
    'colony.updated': 'Colony Updated',
    'colony.deleted': 'Colony Deleted',
    'plot.created': 'New Plot Created',
    'plot.updated': 'Plot Details Updated',
    'plot.deleted': 'Plot Deactivated',
    'plot.exported': 'Plots Exported',
    'plot.private.read': 'Confidential Data Accessed',
    'plot.private.upsert': 'Owner Record Saved',
    'plot.private.deleted': 'Owner Record Removed',
  };
  return (
    titles[eventType] ||
    eventType
      .replace(/\./g, ' ')
      .replace(/\b\w/g, (c) => c.toUpperCase())
  );
}

export default function DashboardPage() {
  const router = useRouter();
  const { user } = useAuth();

  const [plots, setPlots] = useState<Plot[]>([]);
  const [colonies, setColonies] = useState<Colony[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Aggregate stats
  const [totalPlots, setTotalPlots] = useState(0);
  const [activeColoniesCount, setActiveColoniesCount] = useState(0);
  const [availableCount, setAvailableCount] = useState(0);
  const [bookedSoldCount, setBookedSoldCount] = useState(0);

  const loadDashboardData = useCallback(async () => {
    setIsLoading(true);
    try {
      // 1. Fetch plots & colonies in parallel
      const [plotsRes, coloniesRes] = await Promise.allSettled([
        plotsApi.listPlots({ limit: 100, sortBy: 'updatedAt', sortOrder: 'desc' }),
        coloniesApi.listColonies({ limit: 100 }),
      ]);

      let fetchedPlots: Plot[] = [];
      let fetchedColonies: Colony[] = [];

      if (plotsRes.status === 'fulfilled') {
        fetchedPlots = plotsRes.value.data || [];
        setPlots(fetchedPlots.slice(0, 5)); // 5 most recent for the table

        const total = plotsRes.value.meta?.total ?? fetchedPlots.length;
        setTotalPlots(total);

        const available = fetchedPlots.filter((p) => p.status === 'available').length;
        const bookedSold = fetchedPlots.filter(
          (p) => p.status === 'sold' || p.status === 'reserved' || p.status === 'on_hold'
        ).length;

        setAvailableCount(available);
        setBookedSoldCount(bookedSold);
      }

      if (coloniesRes.status === 'fulfilled') {
        fetchedColonies = coloniesRes.value.data || [];
        setColonies(fetchedColonies);
        const active = fetchedColonies.filter((c) => c.isActive !== false).length;
        setActiveColoniesCount(active);
      }

      // 2. Fetch recent audit logs safely
      try {
        const auditRes =
          user?.role === 'SUPER_ADMIN'
            ? await auditApi.listPlatformAuditLogs({ limit: 4 })
            : await auditApi.listFirmAuditLogs({ limit: 4 });

        if (auditRes?.data) {
          setAuditLogs(auditRes.data);
        }
      } catch {
        // Safe fallback if audit read permission is not assigned to current role
        setAuditLogs([]);
      }
    } catch {
      // Keep graceful empty dashboard on unexpected errors
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  useEffect(() => {
    loadDashboardData();
  }, [loadDashboardData]);

  return (
    <div className="space-y-8">
      {/* Welcome Banner */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">
              Firm Operations Dashboard
            </h1>
            <Badge variant="success" size="sm">
              Workspace Active
            </Badge>
          </div>
          <p className="mt-1 text-sm text-slate-500">
            Real Estate inventory and operational management overview for{' '}
            <span className="font-semibold text-slate-700">
              {user?.firmId
                ? `Firm ${user.firmId.slice(-6)}`
                : user?.role === 'SUPER_ADMIN'
                ? 'Platform Global Workspace'
                : 'Corporate Workspace'}
            </span>
            . Logged in as <span className="font-mono text-xs">{user?.email}</span>.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Link href="/plots">
            <Button size="sm" variant="outline" leftIcon={<Landmark className="h-4 w-4" />}>
              Browse Plots
            </Button>
          </Link>
          <Link href="/colonies">
            <Button size="sm" variant="primary" leftIcon={<PlusCircle className="h-4 w-4" />}>
              Add Colony
            </Button>
          </Link>
        </div>
      </div>

      {/* Workspace Status Banner */}
      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-2xs">
        <div className="flex items-start gap-3">
          <ShieldCheck className="h-5 w-5 text-emerald-600 mt-0.5 shrink-0" />
          <div className="flex-1 text-xs leading-relaxed text-slate-700">
            <span className="font-semibold text-slate-900">
              AGENT-Broker Secure Workspace:
            </span>{' '}
            All tenant isolation fences, role-based access controls, and confidential owner data barriers are active.
            Use the navigation sidebar to manage colonies, plot inventory, staff accounts, and the compliance audit trail.
          </div>
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          title="Total Plots"
          value={isLoading ? '—' : totalPlots}
          subtitle={`Across ${activeColoniesCount} active colonies`}
          icon={<Landmark className="h-5 w-5" />}
        />
        <MetricCard
          title="Active Colonies"
          value={isLoading ? '—' : activeColoniesCount}
          subtitle="Residential & Commercial"
          icon={<MapPin className="h-5 w-5" />}
        />
        <MetricCard
          title="Available Inventory"
          value={isLoading ? '—' : availableCount}
          subtitle={
            totalPlots > 0
              ? `${Math.round((availableCount / totalPlots) * 100)}% of total inventory`
              : 'Ready for allocation'
          }
          icon={<CheckCircle2 className="h-5 w-5" />}
        />
        <MetricCard
          title="Booked & Sold"
          value={isLoading ? '—' : bookedSoldCount}
          subtitle={
            totalPlots > 0
              ? `${Math.round((bookedSoldCount / totalPlots) * 100)}% allocated`
              : 'Inventory turnover'
          }
          icon={<Clock className="h-5 w-5" />}
        />
      </div>

      {/* Two Column Section: Recent Plots Table + Quick Actions & Activity */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Recent Plots Preview Table (2 cols) */}
        <div className="lg:col-span-2 space-y-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-4">
              <div>
                <CardTitle>Recent Plot Inventory</CardTitle>
                <CardDescription>
                  Overview of your firm&apos;s most recently updated plots.
                </CardDescription>
              </div>
              <Link href="/plots">
                <Button variant="ghost" size="sm" rightIcon={<ExternalLink className="h-3.5 w-3.5" />}>
                  View All
                </Button>
              </Link>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="space-y-3 py-2">
                  <Skeleton className="h-10 w-full" />
                  <Skeleton className="h-10 w-full" />
                  <Skeleton className="h-10 w-full" />
                </div>
              ) : plots.length === 0 ? (
                <EmptyState
                  icon={<Landmark className="h-6 w-6 text-slate-400" />}
                  title="No plots in inventory"
                  description="Get started by creating your first colony and registering plots into your firm's inventory."
                  actionLabel="Add First Plot"
                  onAction={() => router.push('/plots')}
                  className="my-4"
                />
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Plot Ref</TableHead>
                      <TableHead>Colony</TableHead>
                      <TableHead>Size</TableHead>
                      <TableHead>Total Price</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Updated</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {plots.map((plot) => {
                      const colony = plot.colonyId
                        ? colonies.find((c) => c.id === plot.colonyId || c._id === plot.colonyId)
                        : null;

                      const calculatedTotal =
                        plot.totalPrice ??
                        (plot.rateType === 'per_unit' && typeof plot.rate === 'number'
                          ? plot.rate * plot.size
                          : plot.rate);
                      const displayPrice = formatCurrency(calculatedTotal, plot.currency);

                      return (
                        <TableRow key={plot.id || plot._id || plot.plotRef}>
                          <TableCell className="font-semibold text-slate-900">
                            {plot.plotRef || plot.plotId}
                          </TableCell>
                          <TableCell className="text-slate-600">
                            {colony?.name || '—'}
                          </TableCell>
                          <TableCell>
                            <div>{formatArea(plot.size, plot.sizeUnit)}</div>
                            {plot.dimensions && (
                              <div className="text-[10px] text-slate-500 font-mono">
                                {plot.dimensions}
                              </div>
                            )}
                          </TableCell>
                          <TableCell className="font-medium text-slate-900">
                            {displayPrice}
                          </TableCell>
                          <TableCell>
                            <StatusBadge status={plot.status} />
                          </TableCell>
                          <TableCell className="text-xs text-slate-500">
                            {formatDate(plot.updatedAt)}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Quick Actions & Activity Column (1 col) */}
        <div className="space-y-6">
          {/* Quick Actions Card */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Quick Actions</CardTitle>
              <CardDescription>Direct navigation to CRM workflows</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              <Link href="/plots" className="block">
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full justify-start text-xs"
                  leftIcon={<Landmark className="h-4 w-4 text-slate-500" />}
                >
                  Manage Plots Inventory
                </Button>
              </Link>
              <Link href="/colonies" className="block">
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full justify-start text-xs"
                  leftIcon={<MapPin className="h-4 w-4 text-slate-500" />}
                >
                  Colony Registry
                </Button>
              </Link>
              <Link href="/firm" className="block">
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full justify-start text-xs"
                  leftIcon={<Building className="h-4 w-4 text-slate-500" />}
                >
                  Firm Profile & Advisors
                </Button>
              </Link>
              <Link href="/audit" className="block">
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full justify-start text-xs"
                  leftIcon={<ShieldCheck className="h-4 w-4 text-slate-500" />}
                >
                  Security Audit Trail
                </Button>
              </Link>
            </CardContent>
          </Card>

          {/* Recent Activity Card */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Audit Trail Activity</CardTitle>
              <CardDescription>Recently logged operational events</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {isLoading ? (
                <div className="space-y-2 py-2">
                  <Skeleton className="h-9 w-full" />
                  <Skeleton className="h-9 w-full" />
                </div>
              ) : auditLogs.length === 0 ? (
                <div className="py-6 text-center text-xs text-slate-400">
                  <Activity className="h-5 w-5 mx-auto mb-1 text-slate-300" />
                  No audit trail activity recorded yet.
                </div>
              ) : (
                auditLogs.map((log) => (
                  <div key={log.id} className="flex items-start gap-3 text-xs">
                    <div className="flex h-7 w-7 items-center justify-center rounded-full bg-slate-100 text-slate-600 shrink-0 mt-0.5">
                      <Activity className="h-3.5 w-3.5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-slate-800 truncate">
                        {formatEventTitle(log.eventType)}
                      </p>
                      <p className="text-slate-500 text-[11px] mt-0.5 truncate">
                        {log.actorRole ? `${log.actorRole} • ` : ''}
                        {log.outcome === 'success' ? 'Completed successfully' : 'Failed attempt'}
                      </p>
                      <span className="text-[10px] text-slate-400 block mt-1">
                        {formatDate(log.createdAt)}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
