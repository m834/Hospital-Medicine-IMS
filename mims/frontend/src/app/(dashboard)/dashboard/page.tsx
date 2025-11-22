/**
 * Dashboard Home - Auto-redirect to role-based dashboard
 * This page redirects users to their appropriate dashboard based on role
 */

'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/stores/auth.store';
import { ROLE_DASHBOARDS, UserRole } from '@/lib/constants';
import { FullPageLoader } from '@/components/ui/loader';

export default function DashboardPage() {
  const router = useRouter();
  const { user } = useAuthStore();

  useEffect(() => {
    if (user) {
      const userRole = user.role as UserRole;
      const dashboardRoute = ROLE_DASHBOARDS[userRole] || '/dashboard/super-admin';
      
      console.log('[Dashboard] Redirecting to role-based dashboard:', dashboardRoute);
      router.push(dashboardRoute);
    }
  }, [user, router]);

  return <FullPageLoader message="Loading your dashboard..." />;
}
