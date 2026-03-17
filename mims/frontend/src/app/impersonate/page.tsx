'use client';

import { useEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { setImpersonationSession, storeAuthTokens } from '@/lib/auth';
import { useAuthStore } from '@/stores/auth.store';
import { ROLE_DASHBOARDS, UserRole } from '@/lib/constants';

export default function ImpersonatePage() {
  const params = useSearchParams();
  const router = useRouter();
  const { setUser, setToken } = useAuthStore();

  useEffect(() => {
    const accessToken = params.get('accessToken');
    const refreshToken = params.get('refreshToken');
    const userParam = params.get('user');

    if (!accessToken || !refreshToken || !userParam) {
      router.replace('/dashboard');
      return;
    }

    try {
      const decoded = JSON.parse(atob(userParam));
      setImpersonationSession(true);
      storeAuthTokens({
        accessToken,
        refreshToken,
        user: decoded,
      });

      setUser(decoded);
      setToken(accessToken);

      const redirect = ROLE_DASHBOARDS[decoded.role as UserRole] || '/dashboard';
      router.replace(redirect);
    } catch {
      router.replace('/dashboard');
    }
  }, [params, router, setUser, setToken]);

  return (
    <div className="flex h-screen items-center justify-center">
      <p className="text-muted-foreground">Signing you in...</p>
    </div>
  );
}
