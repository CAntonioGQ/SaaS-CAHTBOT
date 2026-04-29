import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { jwtVerify } from 'jose';

const PUBLIC_PATHS = ['/login', '/register', '/'];
const AUTH_SECRET = new TextEncoder().encode(
  process.env.AUTH_SECRET ?? 'fallback-secret',
);

// Next.js middleware runs on the Edge (before the page renders).
// This is the equivalent of Angular's AuthGuard but for all routes.
// It checks for a valid JWT in cookies — if missing, redirects to /login.
export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Allow public routes through without auth check
  if (PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith('/api/'))) {
    return NextResponse.next();
  }

  const token = request.cookies.get('access_token')?.value;

  if (!token) {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('redirect', pathname);
    return NextResponse.redirect(loginUrl);
  }

  try {
    await jwtVerify(token, AUTH_SECRET);
    return NextResponse.next();
  } catch {
    // Token expired or invalid — redirect to login
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('redirect', pathname);
    const response = NextResponse.redirect(loginUrl);
    response.cookies.delete('access_token');
    return response;
  }
}

export const config = {
  // Apply middleware to dashboard routes only
  matcher: ['/dashboard/:path*'],
};
