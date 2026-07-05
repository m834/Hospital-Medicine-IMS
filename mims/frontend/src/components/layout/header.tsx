/**
 * Dashboard Header Component
 * Top navigation bar with user info, notifications, and logout
 */

'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Bell, ChevronDown, LogOut, User, Menu, X, Send, CheckCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuthStore } from '@/stores/auth.store';
import { useNotificationStore } from '@/stores/notification.store';
import { clearAuthTokens } from '@/lib/auth';
import { cn } from '@/lib/utils';
import api from '@/lib/api';
import { HospitalSelector } from './hospital-selector';
import { UserRole } from '@/lib/constants';

// Compact relative time, e.g. "just now", "5m", "3h", "2d".
function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  return `${Math.floor(h / 24)}d`;
}

interface HospitalUser {
  id: string;
  fullName: string;
  role: string;
}

interface HeaderProps {
  onToggleSidebar?: () => void;
  isSidebarCollapsed?: boolean;
}

export function Header({ onToggleSidebar, isSidebarCollapsed }: HeaderProps) {
  const router = useRouter();
  const { user, clearUser } = useAuthStore();
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);

  const { items, unreadCount, init, teardown, markRead, markAllRead, sendDirect } =
    useNotificationStore();

  // Compose-a-direct-notification state.
  const [showCompose, setShowCompose] = useState(false);
  const [hospitalUsers, setHospitalUsers] = useState<HospitalUser[]>([]);
  const [recipientId, setRecipientId] = useState('');
  const [composeTitle, setComposeTitle] = useState('');
  const [composeMessage, setComposeMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [composeError, setComposeError] = useState<string | null>(null);

  // Connect the realtime notification channel while the user is signed in.
  useEffect(() => {
    if (!user) return;
    void init();
    return () => teardown();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  const openCompose = async () => {
    setShowCompose(true);
    setComposeError(null);
    if (hospitalUsers.length > 0) return;
    try {
      // Open to any authenticated hospital user (unlike the admin-only users list).
      const res = await api.get('/notifications/recipients');
      setHospitalUsers(res.data || []);
    } catch {
      setHospitalUsers([]);
    }
  };

  const handleSend = async () => {
    if (!recipientId || !composeTitle.trim() || !composeMessage.trim()) {
      setComposeError('Pick a recipient and enter a title and message.');
      return;
    }
    setSending(true);
    setComposeError(null);
    try {
      await sendDirect({ recipientId, title: composeTitle.trim(), message: composeMessage.trim() });
      setShowCompose(false);
      setRecipientId('');
      setComposeTitle('');
      setComposeMessage('');
    } catch (err: any) {
      setComposeError(err.response?.data?.message || 'Failed to send notification');
    } finally {
      setSending(false);
    }
  };

  const handleNotificationClick = (id: string, link?: string | null) => {
    void markRead(id);
    setShowNotifications(false);
    if (link) router.push(link);
  };

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
            {unreadCount > 0 && (
              <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-semibold text-white">
                {unreadCount > 99 ? '99+' : unreadCount}
              </span>
            )}
          </button>

          {/* Notifications Dropdown */}
          {showNotifications && (
            <div className="absolute right-0 mt-2 w-96 max-w-[92vw] rounded-lg border border-gray-200 bg-white shadow-lg">
              <div className="flex items-center justify-between border-b border-gray-200 p-3">
                <h3 className="font-semibold text-gray-900">
                  Notifications{unreadCount > 0 ? ` (${unreadCount})` : ''}
                </h3>
                <div className="flex items-center gap-1">
                  <button
                    onClick={openCompose}
                    className="flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-indigo-600 hover:bg-indigo-50"
                    title="Send a notification"
                  >
                    <Send className="h-3.5 w-3.5" /> Send
                  </button>
                  {unreadCount > 0 && (
                    <button
                      onClick={() => markAllRead()}
                      className="flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-gray-600 hover:bg-gray-100"
                      title="Mark all as read"
                    >
                      <CheckCheck className="h-3.5 w-3.5" /> Mark all
                    </button>
                  )}
                </div>
              </div>

              {/* Compose form */}
              {showCompose && (
                <div className="space-y-2 border-b border-gray-200 bg-gray-50 p-3">
                  {composeError && <p className="text-xs text-red-600">{composeError}</p>}
                  <select
                    value={recipientId}
                    onChange={(e) => setRecipientId(e.target.value)}
                    className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm"
                  >
                    <option value="">Select recipient…</option>
                    {hospitalUsers.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.fullName} · {formatRoleName(u.role)}
                      </option>
                    ))}
                  </select>
                  <input
                    value={composeTitle}
                    onChange={(e) => setComposeTitle(e.target.value)}
                    placeholder="Title"
                    className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm"
                  />
                  <textarea
                    value={composeMessage}
                    onChange={(e) => setComposeMessage(e.target.value)}
                    placeholder="Message"
                    rows={2}
                    className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm"
                  />
                  <div className="flex justify-end gap-2">
                    <button
                      onClick={() => setShowCompose(false)}
                      className="rounded-md px-3 py-1 text-xs text-gray-600 hover:bg-gray-100"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleSend}
                      disabled={sending}
                      className="rounded-md bg-indigo-600 px-3 py-1 text-xs font-medium text-white hover:bg-indigo-700 disabled:bg-indigo-300"
                    >
                      {sending ? 'Sending…' : 'Send'}
                    </button>
                  </div>
                </div>
              )}

              <div className="max-h-96 overflow-y-auto">
                {items.length === 0 ? (
                  <div className="p-8 text-center">
                    <Bell className="mx-auto h-12 w-12 text-gray-300" />
                    <p className="mt-2 text-sm text-gray-500">No notifications</p>
                  </div>
                ) : (
                  <ul className="divide-y divide-gray-100">
                    {items.map((n) => (
                      <li key={n.id}>
                        <button
                          onClick={() => handleNotificationClick(n.id, n.link)}
                          className={cn(
                            'flex w-full gap-2 px-3 py-2.5 text-left hover:bg-gray-50',
                            !n.isRead && 'bg-indigo-50/60',
                          )}
                        >
                          <span
                            className={cn(
                              'mt-1.5 h-2 w-2 shrink-0 rounded-full',
                              n.isRead ? 'bg-transparent' : 'bg-indigo-500',
                            )}
                          />
                          <span className="min-w-0 flex-1">
                            <span className="flex items-center justify-between gap-2">
                              <span className="truncate text-sm font-medium text-gray-800">{n.title}</span>
                              <span className="shrink-0 text-[11px] text-gray-400">{timeAgo(n.createdAt)}</span>
                            </span>
                            <span className="mt-0.5 block text-xs text-gray-600 line-clamp-2">{n.message}</span>
                            {n.sender?.fullName && (
                              <span className="mt-0.5 block text-[11px] text-gray-400">from {n.sender.fullName}</span>
                            )}
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
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
