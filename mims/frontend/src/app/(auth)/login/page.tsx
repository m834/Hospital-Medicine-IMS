'use client';

/**
 * Login Page
 * CRITICAL: Implements THREE-STEP token validation before login
 */

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { storeAuthTokens, validateToken, clearAuthTokens } from '@/lib/auth';
import { useAuthStore } from '@/stores/auth.store';
import { ROLE_DASHBOARDS } from '@/lib/constants';
import api, { getErrorMessage } from '@/lib/api';
import { UserRole } from '@/lib/constants';

const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
});

type LoginFormData = z.infer<typeof loginSchema>;

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { setUser } = useAuthStore();
  const [isLoading, setIsLoading] = useState(false);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
  });

  // CRITICAL: Check for existing valid token on mount
  useEffect(() => {
    async function checkExistingToken() {
      setIsCheckingAuth(true);
      console.log('[Login] Checking for existing authentication...');

      try {
        // Add timeout to prevent hanging
        const timeoutPromise = new Promise<boolean>((resolve) => {
          setTimeout(() => {
            console.warn('[Login] Token validation timed out');
            resolve(false);
          }, 3000); // 3 second timeout
        });

        const validationPromise = validateToken();
        const isValid = await Promise.race([validationPromise, timeoutPromise]);

        if (isValid) {
          // Already logged in with valid token - redirect to dashboard
          console.log('[Login] Valid token found - redirecting to dashboard');
          const redirect = searchParams?.get('redirect') || '/dashboard';
          router.push(redirect);
        } else {
          console.log('[Login] No valid token - showing login form');
          setIsCheckingAuth(false);
        }
      } catch (error) {
        console.error('[Login] Error checking authentication:', error);
        setIsCheckingAuth(false);
      }
    }

    checkExistingToken();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Run only once on mount

  // Show error messages from URL params
  useEffect(() => {
    const errorParam = searchParams?.get('error');
    if (errorParam === 'session_expired') {
      setError('Your session has expired. Please login again.');
    } else if (errorParam === 'authentication_required') {
      setError('Please login to access this page.');
    } else if (errorParam === 'verification_failed') {
      setError('Unable to verify your session. Please login again.');
    }
  }, [searchParams]);

  const onSubmit = async (data: LoginFormData) => {
    setIsLoading(true);
    setError(null);

    try {
      console.log('[Login] Attempting login with email:', data.email);
      
      const response = await api.post('/auth/login', {
        email: data.email,
        password: data.password,
      });

      const authResponse = response.data;
      console.log('[Login] Login successful, response:', authResponse);

      // Check if MFA is required
      if (authResponse.requiresMFA) {
        // Store partial auth data and redirect to MFA
        sessionStorage.setItem('mfa_user_id', authResponse.userId);
        router.push('/mfa');
        return;
      }

      // Store tokens in localStorage
      console.log('[Login] Storing auth tokens...');
      storeAuthTokens(authResponse);

      // Set user in Zustand store
      setUser(authResponse.user);
      console.log('[Login] User set in store:', authResponse.user);

      // Store access token in cookie for middleware
      document.cookie = `access_token=${authResponse.accessToken}; path=/; max-age=1800; SameSite=Strict`;
      console.log('[Login] Cookie set');

      // Redirect to role-based dashboard
      const userRole = authResponse.user.role as UserRole;
      const dashboardRoute = ROLE_DASHBOARDS[userRole] || '/dashboard';
      
      // Get redirect parameter, but ignore root URL to prevent loop
      const redirectParam = searchParams?.get('redirect');
      const redirect = (redirectParam && redirectParam !== '/') ? redirectParam : dashboardRoute;
      
      console.log('[Login] User role:', userRole);
      console.log('[Login] Dashboard route:', dashboardRoute);
      console.log('[Login] Redirect param:', redirectParam);
      console.log('[Login] Final redirect:', redirect);
      
      router.push(redirect);
    } catch (err: unknown) {
      console.error('Login error:', err);

      const errorMessage = getErrorMessage(err);

      if (errorMessage.includes('Invalid email or password')) {
        setError('Invalid email or password');
      } else if (errorMessage.includes('deactivated') || errorMessage.includes('suspended')) {
        setError('Account is suspended. Please contact your administrator.');
      } else {
        setError('Login failed. Please try again.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  // Show loading state while checking authentication
  if (isCheckingAuth) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-muted-foreground">Checking authentication...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="w-full max-w-md space-y-8 p-8">
        <div className="text-center">
          <h1 className="text-3xl font-bold tracking-tight">Medicine IMS</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Hospital Medicine Inventory Management System
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            Sign in to your account
          </p>
        </div>

        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              placeholder="user@example.com"
              {...register('email')}
              disabled={isLoading}
            />
            {errors.email && (
              <p className="text-sm text-destructive">{errors.email.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              placeholder="••••••••"
              {...register('password')}
              disabled={isLoading}
            />
            {errors.password && (
              <p className="text-sm text-destructive">{errors.password.message}</p>
            )}
          </div>

          <Button type="submit" className="w-full" disabled={isLoading}>
            {isLoading ? (
              <>
                <div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-background border-t-transparent"></div>
                Signing in...
              </>
            ) : (
              'Sign in'
            )}
          </Button>
        </form>

        <div className="text-center space-y-2">
          <p className="text-sm text-muted-foreground">
            Only authorized users can access this system.
          </p>
          <p className="text-sm text-muted-foreground">
            Contact your administrator to create an account.
          </p>
        </div>
      </div>
    </div>
  );
}
