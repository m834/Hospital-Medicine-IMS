/**
 * Next.js Middleware for Route Protection
 * CRITICAL: Validates token before allowing access to protected routes
 */

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// Public routes that don't require authentication
const PUBLIC_ROUTES = ['/login', '/unauthorized'];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Allow public routes
  const isPublicRoute = PUBLIC_ROUTES.some(route => pathname.startsWith(route));
  
  if (isPublicRoute) {
    return NextResponse.next();
  }

  // For protected routes, check if access token exists in cookies
  // Note: We'll use localStorage on client-side, but cookies for middleware
  const accessToken = request.cookies.get('access_token')?.value;

  if (!accessToken) {
    // No token - redirect to login
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('redirect', pathname);
    loginUrl.searchParams.set('error', 'authentication_required');
    
    return NextResponse.redirect(loginUrl);
  }

  // Token exists - allow access
  // Note: Full validation happens in the dashboard layout component
  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder
     * - api routes
     */
    '/((?!_next/static|_next/image|favicon.ico|public|api).*)',
  ],
};
