'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/lib/context/AuthContext';
import { UserPermission } from '@/types/user';
import { cn } from '@/lib/utils/cn';
import {
  LayoutDashboard,
  MapPin,
  Landmark,
  Building2,
  ShieldCheck,
  Settings,
  X,
  Compass,
  LogOut,
  UserCheck,
} from 'lucide-react';

interface NavItem {
  name: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  roleRequirement?: 'ALL' | 'TENANT_ONLY' | 'FIRM_ADMIN_ONLY' | 'PLATFORM_ONLY' | 'ADMINS_ONLY';
  permissionRequirement?: string;
}

const allNavItems: NavItem[] = [
  { name: 'Dashboard', href: '/', icon: LayoutDashboard, roleRequirement: 'ALL' },
  {
    name: 'Colonies',
    href: '/colonies',
    icon: MapPin,
    roleRequirement: 'TENANT_ONLY',
    permissionRequirement: 'colonies:read',
  },
  {
    name: 'Plots',
    href: '/plots',
    icon: Landmark,
    roleRequirement: 'TENANT_ONLY',
    permissionRequirement: 'plots:read',
  },
  {
    name: 'Firm Management',
    href: '/firm',
    icon: Building2,
    roleRequirement: 'ADMINS_ONLY',
  },
  {
    name: 'Audit Trail',
    href: '/audit',
    icon: ShieldCheck,
    roleRequirement: 'ALL',
    permissionRequirement: 'audit:read',
  },
  { name: 'Settings', href: '/settings', icon: Settings, roleRequirement: 'ALL' },
];

export interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

export function Sidebar({ isOpen, onClose }: SidebarProps) {
  const pathname = usePathname();
  const { user, logout } = useAuth();

  const userRole = user?.role;
  const isSuperAdmin = userRole === 'SUPER_ADMIN';
  const isFirmAdmin = userRole === 'FIRM_ADMIN';
  const isFirmStaff = userRole === 'FIRM_STAFF';

  // Filter navigation items strictly according to authenticated user's role & permissions
  const visibleNavItems = allNavItems.filter((item) => {
    // Platform Administrator routes
    if (isSuperAdmin) {
      if (item.roleRequirement === 'TENANT_ONLY' || item.roleRequirement === 'FIRM_ADMIN_ONLY') {
        return false; // SUPER_ADMIN cannot access tenant colonies, plots, or tenant staff
      }
      return true; // Can access Dashboard, Settings, Audit, and ADMINS_ONLY (/firm for platform firm directory)
    }

    // Firm Administrator: has all tenant permissions implicitly
    if (isFirmAdmin) {
      if (item.roleRequirement === 'PLATFORM_ONLY') return false;
      return true;
    }

    // Firm Staff: filter by explicit permissions
    if (isFirmStaff) {
      if (
        item.roleRequirement === 'PLATFORM_ONLY' ||
        item.roleRequirement === 'FIRM_ADMIN_ONLY' ||
        item.roleRequirement === 'ADMINS_ONLY'
      ) {
        return false;
      }
      if (item.permissionRequirement) {
        return user?.permissions?.includes(item.permissionRequirement as UserPermission);
      }
      return true;
    }

    // Unknown or missing role: restricted fallback
    return item.href === '/' || item.href === '/settings';
  });

  const sidebarContent = (
    <div className="flex h-full flex-col bg-white border-r border-slate-200">
      {/* Brand Header */}
      <div className="flex h-16 items-center justify-between px-6 border-b border-slate-100">
        <Link href="/" className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-900 text-white shadow-xs">
            <Compass className="h-5 w-5" />
          </div>
          <div>
            <span className="text-sm font-bold tracking-tight text-slate-900 block leading-tight">
              AGENT-Broker
            </span>
            <span className="text-[10px] font-semibold text-slate-400 tracking-wider uppercase block">
              {isSuperAdmin ? 'Platform Admin' : 'Real Estate CRM'}
            </span>
          </div>
        </Link>
        <button
          onClick={onClose}
          className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100 md:hidden cursor-pointer"
          aria-label="Close sidebar"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      {/* Role & Tenant Context Card */}
      <div className="px-4 py-3 border-b border-slate-100 bg-slate-50/70">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
            {isSuperAdmin ? 'Platform Scope' : 'Tenant Workspace'}
          </span>
          <span
            className={cn(
              'inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold border',
              isSuperAdmin
                ? 'bg-purple-50 text-purple-700 border-purple-200'
                : isFirmAdmin
                ? 'bg-blue-50 text-blue-700 border-blue-200'
                : 'bg-slate-100 text-slate-700 border-slate-200'
            )}
          >
            {userRole || 'UNKNOWN_ROLE'}
          </span>
        </div>
        <p className="text-xs font-semibold text-slate-800 truncate mt-1">
          {isSuperAdmin
            ? 'Platform Management'
            : user?.firmId
            ? `Firm: ${user.firmId.slice(-6)}`
            : 'Active Firm Workspace'}
        </p>
      </div>

      {/* Navigation Links */}
      <div className="flex-1 overflow-y-auto px-3 py-4">
        <nav className="space-y-1">
          {visibleNavItems.map((item) => {
            const Icon = item.icon;
            const isActive =
              item.href === '/' ? pathname === '/' : pathname.startsWith(item.href);

            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => {
                  if (window.innerWidth < 768) {
                    onClose();
                  }
                }}
                className={cn(
                  'flex items-center gap-3 rounded-lg px-3 py-2 text-xs font-semibold transition-colors',
                  isActive
                    ? 'bg-slate-900 text-white shadow-2xs'
                    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                )}
              >
                <Icon className={cn('h-4 w-4 shrink-0', isActive ? 'text-white' : 'text-slate-400')} />
                {item.href === '/firm'
                  ? isSuperAdmin
                    ? 'Platform Firms'
                    : 'Firm & Staff'
                  : item.href === '/audit'
                  ? isSuperAdmin
                    ? 'Platform Audit'
                    : 'Audit Trail'
                  : item.name}
              </Link>
            );
          })}
        </nav>
      </div>

      {/* Authenticated User Profile & Logout */}
      <div className="p-4 border-t border-slate-100 bg-slate-50/50">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2 truncate">
            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-slate-200 text-slate-700 shrink-0">
              <UserCheck className="h-4 w-4" />
            </div>
            <div className="truncate">
              <p className="text-xs font-semibold text-slate-800 truncate">
                {user?.firstName && user?.lastName
                  ? `${user.firstName} ${user.lastName}`
                  : user?.email || 'Authenticated User'}
              </p>
              <p className="text-[10px] text-slate-400 truncate">{user?.email}</p>
            </div>
          </div>
        </div>
        <button
          onClick={() => logout()}
          className="flex w-full items-center justify-center gap-2 rounded-md border border-slate-200 bg-white py-1.5 text-xs font-medium text-slate-700 shadow-2xs hover:bg-red-50 hover:text-red-600 hover:border-red-200 transition-colors cursor-pointer"
        >
          <LogOut className="h-3.5 w-3.5" />
          <span>Sign Out</span>
        </button>
      </div>
    </div>
  );

  return (
    <>
      <aside className="hidden md:flex md:w-64 md:flex-col md:fixed md:inset-y-0 z-30">
        {sidebarContent}
      </aside>

      {isOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div
            className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs transition-opacity"
            onClick={onClose}
            aria-hidden="true"
          />
          <div className="fixed inset-y-0 left-0 w-64 max-w-xs shadow-xl animate-in slide-in-from-left duration-200">
            {sidebarContent}
          </div>
        </div>
      )}
    </>
  );
}
