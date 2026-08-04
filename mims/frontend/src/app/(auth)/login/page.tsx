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
import { Eye, EyeOff } from 'lucide-react';

const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
});

type LoginFormData = z.infer<typeof loginSchema>;

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { setUser } = useAuthStore();
  const errorParam = searchParams?.get('error');
  const hasAuthError =
    errorParam === 'authentication_required' ||
    errorParam === 'session_expired' ||
    errorParam === 'verification_failed';
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [isCheckingAuth, setIsCheckingAuth] = useState(!hasAuthError);
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
      if (hasAuthError) {
        setIsCheckingAuth(false);
        return;
      }

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
    if (errorParam === 'session_expired') {
      setError('Your session has expired. Please login again.');
    } else if (errorParam === 'authentication_required') {
      setError('Please login to access this page.');
    } else if (errorParam === 'verification_failed') {
      setError('Unable to verify your session. Please login again.');
    }
  }, [errorParam]);

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
  if (isCheckingAuth && !hasAuthError) {
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
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden">
      {/* Full Background Image */}
      <div 
        className="absolute inset-0 bg-cover bg-center bg-no-repeat"
        style={{ backgroundImage: 'url(/assets/mims.jpg)' }}
      />
      {/* Dark overlay for better text readability */}
      <div className="absolute inset-0 bg-black/50" />

      {/* Login Form - Centered with glass effect */}
      <div className="relative z-10 w-full max-w-md mx-4">
        <div className="backdrop-blur-md bg-blue-50/95 dark:bg-blue-900/95 p-8 rounded-2xl shadow-2xl border border-blue-200/50">
          <div className="text-center mb-8">
            <h1 className="text-4xl font-bold tracking-tight text-blue-900 dark:text-white mb-2">
              Medicine IMS
            </h1>
            <p className="text-sm text-blue-700 dark:text-blue-300">
              Hospital Medicine Inventory Management System
            </p>
            <p className="mt-4 text-lg font-medium text-blue-800 dark:text-blue-200">
              Welcome Back
            </p>
            <p className="text-sm text-blue-600 dark:text-blue-300">
              Sign in to your account to continue
            </p>
          </div>

          {error && (
            <Alert variant="destructive" className="mb-6">
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
                className="bg-white/80 dark:bg-gray-800/80"
              />
              {errors.email && (
                <p className="text-sm text-destructive">{errors.email.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="••••••••"
                  {...register('password')}
                  disabled={isLoading}
                  className="bg-white/80 dark:bg-gray-800/80 pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  disabled={isLoading}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground disabled:opacity-50"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {errors.password && (
                <p className="text-sm text-destructive">{errors.password.message}</p>
              )}
            </div>

            <Button type="submit" className="w-full" disabled={isLoading} size="lg">
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

          <div className="mt-6 text-center space-y-2">
            <p className="text-xs text-gray-600 dark:text-gray-400">
              Only authorized users can access this system.
            </p>
            <p className="text-xs text-gray-600 dark:text-gray-400">
              Contact your administrator to create an account.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
