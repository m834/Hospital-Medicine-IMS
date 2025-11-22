/**
 * Dashboard Header Component
 * Top navigation bar with user info, notifications, and logout
 */

'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Bell, ChevronDown, LogOut, User, Menu, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuthStore } from '@/stores/auth.store';
import { clearAuthTokens } from '@/lib/auth';
import { cn } from '@/lib/utils';
import { HospitalSelector } from './hospital-selector';
import { UserRole } from '@/lib/constants';

interface HeaderProps {
  onToggleSidebar?: () => void;
  isSidebarCollapsed?: boolean;
}

export function Header({ onToggleSidebar, isSidebarCollapsed }: HeaderProps) {
  const router = useRouter();
  const { user, clearUser } = useAuthStore();
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);

  const handleLogout = () => {
    // Clear auth tokens and user data
    clearAuthTokens();
    clearUser();
    
    // Clear cookie
    document.cookie = 'access_token=; path=/; max-age=0';
    
    // Redirect to login
    router.push('/login');
  };

  const getRoleBadgeColor = (role: string) => {
    const colors: Record<string, string> = {
      SUPER_ADMIN: 'bg-purple-100 text-purple-800',
      HOSPITAL_ADMIN: 'bg-blue-100 text-blue-800',
      MAIN_PHARMACY_MANAGER: 'bg-green-100 text-green-800',
      SUB_PHARMACY_MANAGER: 'bg-yellow-100 text-yellow-800',
      DOCTOR: 'bg-pink-100 text-pink-800',
      DOCTOR_ASSISTANT: 'bg-orange-100 text-orange-800',
      REGISTRATION_STAFF: 'bg-indigo-100 text-indigo-800',
      PHARMACY_STAFF: 'bg-teal-100 text-teal-800',
      AUDITOR: 'bg-red-100 text-red-800',
    };
    return colors[role] || 'bg-gray-100 text-gray-800';
  };

  const formatRoleName = (role: string) => {
    return role.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase());
  };

  return (
    <header className="sticky top-0 z-40 flex h-16 items-center justify-between border-b border-border bg-card px-6 shadow-sm">
      {/* Left Section */}
      <div className="flex items-center gap-4">
        {/* Sidebar Toggle - Mobile */}
        <button
          onClick={onToggleSidebar}
          className="rounded-lg p-2 text-muted-foreground hover:bg-accent lg:hidden"
          aria-label="Toggle sidebar"
        >
          {isSidebarCollapsed ? <Menu className="h-5 w-5" /> : <X className="h-5 w-5" />}
        </button>

        {/* Hospital Selector - Only for Super Admin */}
        {user?.role === UserRole.SUPER_ADMIN && (
          <HospitalSelector />
        )}
      </div>

      {/* Right Section */}
      <div className="flex items-center gap-4">
        {/* Notifications */}
        <div className="relative">
          <button
            onClick={() => setShowNotifications(!showNotifications)}
            className="relative rounded-lg p-2 text-gray-600 hover:bg-gray-100"
            aria-label="Notifications"
          >
            <Bell className="h-5 w-5" />
            {/* Notification Badge */}
            <span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-red-500"></span>
          </button>

          {/* Notifications Dropdown */}
          {showNotifications && (
            <div className="absolute right-0 mt-2 w-80 rounded-lg border border-gray-200 bg-white shadow-lg">
              <div className="border-b border-gray-200 p-4">
                <h3 className="font-semibold text-gray-900">Notifications</h3>
              </div>
              <div className="max-h-96 overflow-y-auto">
                {/* Empty State */}
                <div className="p-8 text-center">
                  <Bell className="mx-auto h-12 w-12 text-gray-400" />
                  <p className="mt-2 text-sm text-gray-500">No new notifications</p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* User Menu */}
        <div className="relative">
          <button
            onClick={() => setShowUserMenu(!showUserMenu)}
            className="flex items-center gap-3 rounded-lg px-3 py-2 hover:bg-gray-100"
          >
            {/* User Avatar */}
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-600 text-sm font-semibold text-white">
              {user?.fullName?.charAt(0).toUpperCase() || 'U'}
            </div>

            {/* User Info */}
            <div className="hidden text-left md:block">
              <p className="text-sm font-medium text-gray-900">{user?.fullName || 'User'}</p>
              <p className={cn('text-xs font-medium px-2 py-0.5 rounded-full inline-block', getRoleBadgeColor(user?.role || ''))}>
                {formatRoleName(user?.role || '')}
              </p>
            </div>

            <ChevronDown className="h-4 w-4 text-gray-600" />
          </button>

          {/* User Dropdown Menu */}
          {showUserMenu && (
            <div className="absolute right-0 mt-2 w-64 rounded-lg border border-gray-200 bg-white shadow-lg">
              <div className="border-b border-gray-200 p-4">
                <p className="font-semibold text-gray-900">{user?.fullName}</p>
                <p className="text-sm text-gray-500">{user?.email}</p>
                <span className={cn('mt-2 inline-block rounded-full px-2 py-1 text-xs font-medium', getRoleBadgeColor(user?.role || ''))}>
                  {formatRoleName(user?.role || '')}
                </span>
              </div>

              <div className="p-2">
                <button
                  onClick={() => {
                    setShowUserMenu(false);
                    router.push('/profile');
                  }}
                  className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-gray-700 hover:bg-gray-100"
                >
                  <User className="h-4 w-4" />
                  <span>View Profile</span>
                </button>

                <button
                  onClick={handleLogout}
                  className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-red-600 hover:bg-red-50"
                >
                  <LogOut className="h-4 w-4" />
                  <span>Logout</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
