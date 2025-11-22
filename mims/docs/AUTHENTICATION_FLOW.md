# Authentication Flow & Token Validation

## Critical Issue to Prevent: Zero Data Dashboard

**Problem**: In previous projects, when token expires, dashboard still opens but shows zero data because the token is invalid.

**Solution**: Implement robust token validation BEFORE allowing dashboard access.

---

## Authentication Flow

### 1. Login Page Flow

```
User visits /login
  ↓
Check if token exists in localStorage
  ↓
  ├─ Token exists?
  │   ↓
  │   Verify token via POST /auth/verify
  │   ↓
  │   ├─ Valid? → Redirect to dashboard
  │   └─ Invalid/Expired? → Clear localStorage, stay on login
  │
  └─ No token → Show login form
      ↓
      User enters email + password
      ↓
      POST /auth/login
      ↓
      ├─ Success (200)
      │   ↓
      │   ├─ requiresMFA: true?
      │   │   ↓
      │   │   Redirect to /mfa → POST /auth/mfa/verify
      │   │   ↓
      │   │   Success → Store tokens → Redirect to dashboard
      │   │
      │   └─ requiresMFA: false?
      │       ↓
      │       Store tokens in localStorage
      │       ↓
      │       Set user in Zustand store
      │       ↓
      │       Redirect to role-based dashboard
      │
      └─ Error (401/400)
          ↓
          Show error message
          Stay on login page
```

### 2. Token Storage Strategy

```typescript
// localStorage keys
const AUTH_TOKENS = {
  ACCESS_TOKEN: 'mims_access_token',
  REFRESH_TOKEN: 'mims_refresh_token',
  USER_DATA: 'mims_user_data',
  TOKEN_EXPIRY: 'mims_token_expiry',
};

// Store after successful login
function storeAuthTokens(authResponse: AuthResponse) {
  localStorage.setItem(AUTH_TOKENS.ACCESS_TOKEN, authResponse.accessToken);
  localStorage.setItem(AUTH_TOKENS.REFRESH_TOKEN, authResponse.refreshToken);
  localStorage.setItem(AUTH_TOKENS.USER_DATA, JSON.stringify(authResponse.user));
  
  // Decode JWT to get expiry
  const decodedToken = jwtDecode(authResponse.accessToken);
  localStorage.setItem(AUTH_TOKENS.TOKEN_EXPIRY, decodedToken.exp.toString());
}

// Clear on logout or invalid token
function clearAuthTokens() {
  Object.values(AUTH_TOKENS).forEach(key => {
    localStorage.removeItem(key);
  });
}
```

### 3. Token Validation Before Dashboard Access

**Critical**: Every protected route MUST validate token before rendering.

```typescript
// lib/auth.ts
export async function validateToken(): Promise<boolean> {
  const accessToken = localStorage.getItem(AUTH_TOKENS.ACCESS_TOKEN);
  
  // Step 1: Check if token exists
  if (!accessToken) {
    console.error('No access token found');
    return false;
  }
  
  // Step 2: Check if token is expired (client-side check)
  const tokenExpiry = localStorage.getItem(AUTH_TOKENS.TOKEN_EXPIRY);
  if (tokenExpiry) {
    const expiryTime = parseInt(tokenExpiry) * 1000; // Convert to milliseconds
    const now = Date.now();
    
    if (now >= expiryTime) {
      console.error('Token expired (client-side check)');
      clearAuthTokens();
      return false;
    }
  }
  
  // Step 3: Verify token with backend (server-side validation)
  try {
    const response = await fetch('http://localhost:3001/auth/verify', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`,
      },
    });
    
    if (!response.ok) {
      console.error('Token validation failed:', response.status);
      clearAuthTokens();
      return false;
    }
    
    const data = await response.json();
    return data.valid === true;
    
  } catch (error) {
    console.error('Token validation error:', error);
    clearAuthTokens();
    return false;
  }
}
```

### 4. Protected Route Guard (Next.js Middleware)

```typescript
// middleware.ts (Next.js 13+ App Router)
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  
  // Public routes that don't require authentication
  const publicRoutes = ['/login', '/mfa'];
  const isPublicRoute = publicRoutes.some(route => pathname.startsWith(route));
  
  if (isPublicRoute) {
    return NextResponse.next();
  }
  
  // Protected routes - require valid token
  const accessToken = request.cookies.get('access_token')?.value;
  
  if (!accessToken) {
    // No token - redirect to login
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('redirect', pathname);
    return NextResponse.redirect(loginUrl);
  }
  
  // Verify token with backend
  try {
    const verifyResponse = await fetch('http://localhost:3001/auth/verify', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    });
    
    if (!verifyResponse.ok) {
      // Invalid token - redirect to login
      const loginUrl = new URL('/login', request.url);
      loginUrl.searchParams.set('redirect', pathname);
      loginUrl.searchParams.set('error', 'session_expired');
      
      // Clear cookies
      const response = NextResponse.redirect(loginUrl);
      response.cookies.delete('access_token');
      response.cookies.delete('refresh_token');
      
      return response;
    }
    
    // Token valid - allow access
    return NextResponse.next();
    
  } catch (error) {
    console.error('Token verification failed:', error);
    
    // Network error or backend down - redirect to login
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('error', 'verification_failed');
    return NextResponse.redirect(loginUrl);
  }
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder
     */
    '/((?!_next/static|_next/image|favicon.ico|public).*)',
  ],
};
```

### 5. Axios Interceptor for API Calls

**Critical**: Automatically attach token to all API requests and handle 401 errors.

```typescript
// lib/api.ts
import axios from 'axios';
import { clearAuthTokens } from './auth';

const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001',
  timeout: 30000,
});

// Request interceptor: Attach token to every request
api.interceptors.request.use(
  (config) => {
    const accessToken = localStorage.getItem('mims_access_token');
    
    if (accessToken) {
      config.headers.Authorization = `Bearer ${accessToken}`;
    }
    
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor: Handle 401 and auto-logout
api.interceptors.response.use(
  (response) => {
    return response;
  },
  async (error) => {
    const originalRequest = error.config;
    
    // Handle 401 Unauthorized
    if (error.response?.status === 401) {
      console.error('401 Unauthorized - Token invalid or expired');
      
      // Try to refresh token (if not already retrying)
      if (!originalRequest._retry) {
        originalRequest._retry = true;
        
        try {
          const refreshToken = localStorage.getItem('mims_refresh_token');
          
          if (refreshToken) {
            const response = await axios.post(
              `${process.env.NEXT_PUBLIC_API_URL}/auth/refresh`,
              { refreshToken }
            );
            
            const { accessToken } = response.data;
            localStorage.setItem('mims_access_token', accessToken);
            
            // Retry original request with new token
            originalRequest.headers.Authorization = `Bearer ${accessToken}`;
            return api(originalRequest);
          }
        } catch (refreshError) {
          console.error('Token refresh failed:', refreshError);
        }
      }
      
      // Refresh failed or no refresh token - logout user
      clearAuthTokens();
      
      // Redirect to login
      if (typeof window !== 'undefined') {
        window.location.href = '/login?error=session_expired';
      }
      
      return Promise.reject(error);
    }
    
    // Handle 403 Forbidden (insufficient permissions)
    if (error.response?.status === 403) {
      console.error('403 Forbidden - Insufficient permissions');
      
      if (typeof window !== 'undefined') {
        window.location.href = '/unauthorized';
      }
    }
    
    return Promise.reject(error);
  }
);

export default api;
```

### 6. Dashboard Layout with Token Check

```typescript
// app/(dashboard)/layout.tsx
'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { validateToken } from '@/lib/auth';
import { useAuthStore } from '@/stores/auth.store';
import Sidebar from '@/components/layout/sidebar';
import Header from '@/components/layout/header';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const { user, setUser, clearUser } = useAuthStore();
  const [isValidating, setIsValidating] = useState(true);
  
  useEffect(() => {
    async function checkAuth() {
      setIsValidating(true);
      
      // Validate token before rendering dashboard
      const isValid = await validateToken();
      
      if (!isValid) {
        console.error('Token validation failed - redirecting to login');
        clearUser();
        router.push('/login?error=session_expired');
        return;
      }
      
      // Load user data from localStorage if not in store
      if (!user) {
        const userData = localStorage.getItem('mims_user_data');
        if (userData) {
          setUser(JSON.parse(userData));
        }
      }
      
      setIsValidating(false);
    }
    
    checkAuth();
    
    // Re-validate token every 5 minutes
    const interval = setInterval(checkAuth, 5 * 60 * 1000);
    
    return () => clearInterval(interval);
  }, [user, setUser, clearUser, router]);
  
  // Show loading state while validating
  if (isValidating) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-muted-foreground">Validating session...</p>
        </div>
      </div>
    );
  }
  
  // Render dashboard only after successful validation
  return (
    <div className="flex min-h-screen">
      <Sidebar userRole={user?.role} />
      <div className="flex-1 flex flex-col">
        <Header user={user} />
        <main className="flex-1 p-6 bg-background">
          {children}
        </main>
      </div>
    </div>
  );
}
```

### 7. Login Page Implementation

```typescript
// app/(auth)/login/page.tsx
'use client';

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { storeAuthTokens, validateToken } from '@/lib/auth';
import { useAuthStore } from '@/stores/auth.store';
import api from '@/lib/api';

const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  hospitalId: z.string().uuid('Invalid hospital ID').optional(),
});

type LoginFormData = z.infer<typeof loginSchema>;

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { setUser } = useAuthStore();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
  });
  
  // Check for existing valid token on mount
  useEffect(() => {
    async function checkExistingToken() {
      const isValid = await validateToken();
      
      if (isValid) {
        // Already logged in with valid token - redirect to dashboard
        const redirect = searchParams.get('redirect') || '/dashboard';
        router.push(redirect);
      }
    }
    
    checkExistingToken();
  }, [router, searchParams]);
  
  // Show session expired error if present
  useEffect(() => {
    const errorParam = searchParams.get('error');
    if (errorParam === 'session_expired') {
      setError('Your session has expired. Please login again.');
    }
  }, [searchParams]);
  
  const onSubmit = async (data: LoginFormData) => {
    setIsLoading(true);
    setError(null);
    
    try {
      const response = await api.post('/auth/login', {
        email: data.email,
        password: data.password,
        hospitalId: data.hospitalId,
      });
      
      const authResponse = response.data;
      
      // Check if MFA is required
      if (authResponse.requiresMFA) {
        // Store partial auth data and redirect to MFA
        sessionStorage.setItem('mfa_user_id', authResponse.userId);
        router.push('/mfa');
        return;
      }
      
      // Store tokens in localStorage
      storeAuthTokens(authResponse);
      
      // Set user in Zustand store
      setUser(authResponse.user);
      
      // Redirect to intended page or dashboard
      const redirect = searchParams.get('redirect') || '/dashboard';
      router.push(redirect);
      
    } catch (err: any) {
      console.error('Login error:', err);
      
      if (err.response?.status === 401) {
        setError('Invalid email or password');
      } else if (err.response?.status === 403) {
        setError('Account is suspended. Please contact your administrator.');
      } else {
        setError('Login failed. Please try again.');
      }
    } finally {
      setIsLoading(false);
    }
  };
  
  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="w-full max-w-md space-y-8 p-8">
        <div className="text-center">
          <h1 className="text-3xl font-bold">Medicine IMS</h1>
          <p className="mt-2 text-muted-foreground">
            Sign in to your account
          </p>
        </div>
        
        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          <div>
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              {...register('email')}
              placeholder="user@example.com"
              disabled={isLoading}
            />
            {errors.email && (
              <p className="mt-1 text-sm text-destructive">
                {errors.email.message}
              </p>
            )}
          </div>
          
          <div>
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              {...register('password')}
              placeholder="••••••••"
              disabled={isLoading}
            />
            {errors.password && (
              <p className="mt-1 text-sm text-destructive">
                {errors.password.message}
              </p>
            )}
          </div>
          
          <Button
            type="submit"
            className="w-full"
            disabled={isLoading}
          >
            {isLoading ? 'Signing in...' : 'Sign in'}
          </Button>
        </form>
        
        <p className="text-center text-sm text-muted-foreground">
          Only authorized users can access this system.
          <br />
          Contact your administrator to create an account.
        </p>
      </div>
    </div>
  );
}
```

---

## Role-Based Dashboard Routing

### User Roles & Dashboard Access

```typescript
// types/user.ts
export enum UserRole {
  SUPER_ADMIN = 'super_admin',
  HOSPITAL_ADMIN = 'hospital_admin',
  MAIN_PHARMACY_MANAGER = 'main_pharmacy_manager',
  SUB_PHARMACY_MANAGER = 'sub_pharmacy_manager',
  DOCTOR = 'doctor',
  DOCTOR_ASSISTANT = 'doctor_assistant',
  REGISTRATION_STAFF = 'registration_staff',
  PHARMACY_STAFF = 'pharmacy_staff',
  AUDITOR = 'auditor',
}

// Dashboard routes by role
export const ROLE_DASHBOARDS: Record<UserRole, string> = {
  [UserRole.SUPER_ADMIN]: '/dashboard/super-admin',
  [UserRole.HOSPITAL_ADMIN]: '/dashboard/hospital-admin',
  [UserRole.MAIN_PHARMACY_MANAGER]: '/dashboard/main-pharmacy',
  [UserRole.SUB_PHARMACY_MANAGER]: '/dashboard/sub-pharmacy',
  [UserRole.DOCTOR]: '/dashboard/doctor',
  [UserRole.DOCTOR_ASSISTANT]: '/dashboard/doctor-assistant',
  [UserRole.REGISTRATION_STAFF]: '/dashboard/registration',
  [UserRole.PHARMACY_STAFF]: '/dashboard/pharmacy',
  [UserRole.AUDITOR]: '/dashboard/auditor',
};
```

### Dashboard Redirect After Login

```typescript
// In login page after successful authentication:
const redirect = ROLE_DASHBOARDS[authResponse.user.role] || '/dashboard';
router.push(redirect);
```

---

## Sidebar Menu by Role

### Menu Configuration

```typescript
// config/menu.ts
import { UserRole } from '@/types/user';
import {
  LayoutDashboard,
  Users,
  Pill,
  Package,
  FileText,
  ClipboardList,
  TrendingUp,
  Settings,
  AlertCircle,
  ArrowLeftRight,
} from 'lucide-react';

interface MenuItem {
  label: string;
  icon: any;
  href: string;
  roles: UserRole[];
  submenu?: MenuItem[];
}

export const MENU_ITEMS: MenuItem[] = [
  {
    label: 'Dashboard',
    icon: LayoutDashboard,
    href: '/dashboard',
    roles: Object.values(UserRole), // All roles
  },
  {
    label: 'Patients',
    icon: Users,
    href: '/patients',
    roles: [
      UserRole.HOSPITAL_ADMIN,
      UserRole.REGISTRATION_STAFF,
      UserRole.DOCTOR,
      UserRole.DOCTOR_ASSISTANT,
      UserRole.PHARMACY_STAFF,
      UserRole.MAIN_PHARMACY_MANAGER,
      UserRole.SUB_PHARMACY_MANAGER,
    ],
    submenu: [
      {
        label: 'Register Patient',
        icon: Users,
        href: '/patients/register',
        roles: [UserRole.REGISTRATION_STAFF],
      },
      {
        label: 'Search Patients',
        icon: Users,
        href: '/patients/search',
        roles: [
          UserRole.HOSPITAL_ADMIN,
          UserRole.REGISTRATION_STAFF,
          UserRole.DOCTOR,
          UserRole.PHARMACY_STAFF,
        ],
      },
    ],
  },
  {
    label: 'Prescriptions',
    icon: FileText,
    href: '/prescriptions',
    roles: [
      UserRole.DOCTOR,
      UserRole.DOCTOR_ASSISTANT,
      UserRole.PHARMACY_STAFF,
      UserRole.MAIN_PHARMACY_MANAGER,
      UserRole.SUB_PHARMACY_MANAGER,
    ],
  },
  {
    label: 'Medicine Issuance',
    icon: Pill,
    href: '/issuance',
    roles: [
      UserRole.PHARMACY_STAFF,
      UserRole.MAIN_PHARMACY_MANAGER,
      UserRole.SUB_PHARMACY_MANAGER,
    ],
  },
  {
    label: 'Inventory',
    icon: Package,
    href: '/inventory',
    roles: [
      UserRole.HOSPITAL_ADMIN,
      UserRole.MAIN_PHARMACY_MANAGER,
      UserRole.SUB_PHARMACY_MANAGER,
      UserRole.PHARMACY_STAFF,
    ],
  },
  {
    label: 'Transfers',
    icon: ArrowLeftRight,
    href: '/transfers',
    roles: [
      UserRole.HOSPITAL_ADMIN,
      UserRole.MAIN_PHARMACY_MANAGER,
      UserRole.SUB_PHARMACY_MANAGER,
    ],
  },
  {
    label: 'Alerts',
    icon: AlertCircle,
    href: '/alerts',
    roles: [
      UserRole.HOSPITAL_ADMIN,
      UserRole.MAIN_PHARMACY_MANAGER,
      UserRole.SUB_PHARMACY_MANAGER,
    ],
  },
  {
    label: 'Reports',
    icon: TrendingUp,
    href: '/reports',
    roles: [
      UserRole.SUPER_ADMIN,
      UserRole.HOSPITAL_ADMIN,
      UserRole.MAIN_PHARMACY_MANAGER,
      UserRole.AUDITOR,
    ],
    submenu: [
      {
        label: 'Daily Reports',
        icon: TrendingUp,
        href: '/reports/daily',
        roles: [
          UserRole.HOSPITAL_ADMIN,
          UserRole.MAIN_PHARMACY_MANAGER,
          UserRole.SUB_PHARMACY_MANAGER,
        ],
      },
      {
        label: '15-Day Reports',
        icon: TrendingUp,
        href: '/reports/15-day',
        roles: [
          UserRole.HOSPITAL_ADMIN,
          UserRole.MAIN_PHARMACY_MANAGER,
        ],
      },
      {
        label: 'Monthly Reports',
        icon: TrendingUp,
        href: '/reports/monthly',
        roles: [
          UserRole.HOSPITAL_ADMIN,
          UserRole.MAIN_PHARMACY_MANAGER,
        ],
      },
      {
        label: 'Yearly Reports',
        icon: TrendingUp,
        href: '/reports/yearly',
        roles: [UserRole.HOSPITAL_ADMIN],
      },
    ],
  },
  {
    label: 'Settings',
    icon: Settings,
    href: '/settings',
    roles: [
      UserRole.SUPER_ADMIN,
      UserRole.HOSPITAL_ADMIN,
      UserRole.MAIN_PHARMACY_MANAGER,
    ],
  },
];

// Filter menu items by user role
export function getMenuForRole(role: UserRole): MenuItem[] {
  return MENU_ITEMS.filter(item => item.roles.includes(role))
    .map(item => ({
      ...item,
      submenu: item.submenu?.filter(sub => sub.roles.includes(role)),
    }));
}
```

---

## Summary: Token Validation Checklist

✅ **Step 1**: Check if token exists in localStorage
✅ **Step 2**: Check if token is expired (client-side check via JWT decode)
✅ **Step 3**: Verify token with backend (POST /auth/verify)
✅ **Step 4**: If any check fails → Clear localStorage → Redirect to /login
✅ **Step 5**: Axios interceptor automatically attaches token to all requests
✅ **Step 6**: Axios interceptor handles 401 errors → Auto-logout → Redirect to /login
✅ **Step 7**: Dashboard layout validates token before rendering
✅ **Step 8**: Token re-validation every 5 minutes while on dashboard
✅ **Step 9**: Role-based sidebar menu filtering
✅ **Step 10**: Role-based dashboard routing

---

## Next Steps

1. **Backend**: Implement `/auth/verify` endpoint in auth.controller.ts
2. **Backend**: Implement token refresh endpoint `/auth/refresh`
3. **Frontend**: Create auth utilities (validateToken, storeAuthTokens, clearAuthTokens)
4. **Frontend**: Create Axios interceptor with token attachment and 401 handling
5. **Frontend**: Create protected route middleware
6. **Frontend**: Create login page with token validation
7. **Frontend**: Create dashboard layout with token check
8. **Frontend**: Create role-based sidebar component
9. **Testing**: Test token expiry scenario (manually expire token and verify redirect)
10. **Testing**: Test role-based access (try accessing routes not allowed for role)
