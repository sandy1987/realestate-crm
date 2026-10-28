'use client';

import React from 'react';
import Link from 'next/link';
import { useAuth } from '@/lib/context/AuthContext';
import { MetricCard } from '@/components/shared/MetricCard';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from '@/components/ui/Table';
import { Badge } from '@/components/ui/Badge';
import { formatCurrency, formatArea, formatDate } from '@/lib/utils/formatters';
import {
  Landmark,
  MapPin,
  CheckCircle2,
  Clock,
  PlusCircle,
  Users,
  ShieldCheck,
  Building,
  ExternalLink,
} from 'lucide-react';

export default function DashboardPage() {
  const { user } = useAuth();
  // Sample data clearly labeled as development preview
  const samplePlots = [
    {
      id: 'PLT-101',
      colony: 'Green Meadows Phase 2',
      size: 250,
      sizeUnit: 'sqyd',
      price: 3750000,
      status: 'available',
      updatedAt: '2026-10-25T10:00:00.000Z',
    },
    {
      id: 'PLT-102',
      colony: 'Green Meadows Phase 2',
      size: 300,
      sizeUnit: 'sqyd',
      price: 4500000,
      status: 'booked',
      updatedAt: '2026-10-24T14:30:00.000Z',
    },
    {
      id: 'PLT-204',
      colony: 'Royal Palms Enclave',
      size: 500,
      sizeUnit: 'sqyd',
      price: 9000000,
      status: 'sold',
      updatedAt: '2026-10-22T09:15:00.000Z',
    },
    {
      id: 'PLT-309',
      colony: 'Silver Oaks Residency',
      size: 180,
      sizeUnit: 'sqyd',
      price: 2700000,
      status: 'blocked',
      updatedAt: '2026-10-20T16:45:00.000Z',
    },
  ];

  const sampleActivities = [
    {
      title: 'Colony Created',
      desc: 'Royal Palms Enclave added to inventory by Admin',
      time: '2 hours ago',
      icon: MapPin,
    },
    {
      title: 'Plot Status Updated',
      desc: 'Plot PLT-102 marked as Booked',
      time: 'Yesterday at 4:30 PM',
      icon: Landmark,
    },
    {
      title: 'User Access Granted',
      desc: 'Staff account created for sales executive',
      time: '3 days ago',
      icon: Users,
    },
  ];

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
          value="148"
          subtitle="Across 6 active colonies"
          icon={<Landmark className="h-5 w-5" />}
          trend={{ value: 12, isPositive: true }}
          isSampleData
        />
        <MetricCard
          title="Active Colonies"
          value="6"
          subtitle="Residential & Mixed Use"
          icon={<MapPin className="h-5 w-5" />}
          isSampleData
        />
        <MetricCard
          title="Available Inventory"
          value="82"
          subtitle="55% of total inventory"
          icon={<CheckCircle2 className="h-5 w-5" />}
          trend={{ value: 4, isPositive: true }}
          isSampleData
        />
        <MetricCard
          title="Booked & Sold"
          value="66"
          subtitle="44% turnover rate"
          icon={<Clock className="h-5 w-5" />}
          trend={{ value: 8, isPositive: true }}
          isSampleData
        />
      </div>

      {/* Two Column Section: Recent Plots Table + Quick Actions & Activity */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Recent Plots Preview Table (2 cols) */}
        <div className="lg:col-span-2 space-y-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-4">
              <div>
                <div className="flex items-center gap-2">
                  <CardTitle>Recent Plot Inventory</CardTitle>
                  <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-amber-50 text-amber-700 border border-amber-200">
                    Sample Data
                  </span>
                </div>
                <CardDescription>
                  Demonstration of table layout, status badges, and localized currency formatting.
                </CardDescription>
              </div>
              <Link href="/plots">
                <Button variant="ghost" size="sm" rightIcon={<ExternalLink className="h-3.5 w-3.5" />}>
                  View All
                </Button>
              </Link>
            </CardHeader>
            <CardContent>
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
                  {samplePlots.map((plot) => (
                    <TableRow key={plot.id}>
                      <TableCell className="font-semibold text-slate-900">{plot.id}</TableCell>
                      <TableCell className="text-slate-600">{plot.colony}</TableCell>
                      <TableCell>{formatArea(plot.size, plot.sizeUnit)}</TableCell>
                      <TableCell className="font-medium text-slate-900">
                        {formatCurrency(plot.price)}
                      </TableCell>
                      <TableCell>
                        <StatusBadge status={plot.status} />
                      </TableCell>
                      <TableCell className="text-xs text-slate-500">
                        {formatDate(plot.updatedAt)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
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
                  Firm Profile & Staff
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
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm">Audit Trail Activity</CardTitle>
                <span className="text-[10px] font-semibold text-amber-700 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded">
                  Sample
                </span>
              </div>
              <CardDescription>Logged operational events</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {sampleActivities.map((act, i) => {
                const Icon = act.icon;
                return (
                  <div key={i} className="flex items-start gap-3 text-xs">
                    <div className="flex h-7 w-7 items-center justify-center rounded-full bg-slate-100 text-slate-600 shrink-0 mt-0.5">
                      <Icon className="h-3.5 w-3.5" />
                    </div>
                    <div className="flex-1">
                      <p className="font-semibold text-slate-800">{act.title}</p>
                      <p className="text-slate-500 text-[11px] mt-0.5">{act.desc}</p>
                      <span className="text-[10px] text-slate-400 block mt-1">{act.time}</span>
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
