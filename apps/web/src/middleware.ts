import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// Routes that require authentication
const protectedRoutes = ['/', '/chat', '/history'];

// Routes that should redirect to home if already authenticated
const authRoutes = ['/login', '/register'];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Check for auth token in cookies or localStorage
  // Note: We check a simple flag since actual token validation should happen server-side
  // For client-side apps, the auth store handles the actual token validation
  const authStorage = request.cookies.get('nova-auth-storage');

  let isAuthenticated = false;

  if (authStorage?.value) {
    try {
      const parsed = JSON.parse(authStorage.value);
      isAuthenticated = parsed.state?.isAuthenticated === true && !!parsed.state?.accessToken;
    } catch {
      isAuthenticated = false;
    }
  }

  // Check if the current path is a protected route
  const isProtectedRoute = protectedRoutes.some(
    (route) => pathname === route || pathname.startsWith(route + '/')
  );

  // Check if the current path is an auth route (login/register)
  const isAuthRoute = authRoutes.some(
    (route) => pathname === route || pathname.startsWith(route + '/')
  );

  // Allow auth callback and forgot/reset password routes without auth
  const isPublicAuthRoute =
    pathname.startsWith('/auth/callback') ||
    pathname.startsWith('/forgot-password') ||
    pathname.startsWith('/reset-password');

  if (isPublicAuthRoute) {
    return NextResponse.next();
  }

  // Redirect to login if trying to access protected route without auth
  if (isProtectedRoute && !isAuthenticated) {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('redirect', pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Redirect to home if trying to access auth routes while authenticated
  if (isAuthRoute && isAuthenticated) {
    return NextResponse.redirect(new URL('/', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - api routes
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public files (public folder)
     */
    '/((?!api|_next/static|_next/image|favicon.ico|.*\\.png$|.*\\.svg$|.*\\.ico$).*)',
  ],
};
