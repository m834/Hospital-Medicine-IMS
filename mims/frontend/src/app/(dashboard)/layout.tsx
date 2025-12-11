/**
 * Dashboard Layout
 * Protected layout wrapper with sidebar and header
 * Validates token before rendering dashboard content
 */

'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Sidebar } from '@/components/layout/sidebar';
import { Header } from '@/components/layout/header';
import { StockAlertTicker } from '@/components/dashboard/stock-alert-ticker';
import { FullPageLoader } from '@/components/ui/loader';
import { useAuthStore } from '@/stores/auth.store';
import { validateToken, getStoredUser } from '@/lib/auth';
import { UserRole } from '@/lib/constants';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { user, setUser, setLoading, isLoading } = useAuthStore();
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isValidating, setIsValidating] = useState(true);

  // CRITICAL: Validate token before rendering dashboard
  useEffect(() => {
    async function checkAuth() {
      console.log('[Dashboard] Validating authentication...');
      setLoading(true);
      setIsValidating(true);

      const isValid = await validateToken();

      if (!isValid) {
        console.warn('[Dashboard] Invalid token - redirecting to login');
        router.push('/login?error=authentication_required');
        return;
      }

      // Load user data from localStorage
      const storedUser = getStoredUser();
      if (storedUser) {
        setUser(storedUser);
        console.log('[Dashboard] User authenticated:', storedUser.email);
      } else {
        console.error('[Dashboard] No user data found - redirecting to login');
        router.push('/login?error=authentication_required');
        return;
      }

      setIsValidating(false);
      setLoading(false);
    }

    checkAuth();

    // Re-validate token every 5 minutes to prevent zero-data dashboard
    const intervalId = setInterval(async () => {
      console.log('[Dashboard] Periodic token validation...');
      const isValid = await validateToken();
      if (!isValid) {
        console.warn('[Dashboard] Token expired during session - redirecting to login');
        router.push('/login?error=session_expired');
      }
    }, 5 * 60 * 1000); // 5 minutes

    return () => clearInterval(intervalId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Run only once on mount - router/setUser/setLoading are stable

  // Show loading state while validating
  if (isValidating || isLoading || !user) {
    return <FullPageLoader message="Verifying authentication..." />;
  }

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Sidebar */}
      <Sidebar 
        userRole={user.role as UserRole} 
        isCollapsed={isSidebarCollapsed}
        onToggle={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
      />

      {/* Main Content */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Header */}
        <Header
          onToggleSidebar={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
          isSidebarCollapsed={isSidebarCollapsed}
        />

        {/* Stock Alert Ticker - Below Navbar */}
        <StockAlertTicker />

        {/* Page Content */}
        <main className="flex-1 overflow-y-auto p-6 bg-background">
          {children}
        </main>
      </div>
    </div>
  );
}
