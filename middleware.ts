import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';

const isPublicRoute = createRouteMatcher([
  '/',
  '/sign-in(.*)',
  '/sign-up(.*)',
  '/mmc-go(.*)',
  '/api/webhooks/bold(.*)',
  '/api/webhooks(.*)',
  '/fantasy-vip(.*)', // Temporarily public to fix redirect loop
  '/fantasy(.*)',
  '/api/vip/collect-email',
  '/api/vip/verify-access',
  '/api/vip/check-access',
  '/vip-email-only(.*)',
  '/vip-direct-access(.*)',
  '/pricing(.*)',
  '/investigacion-rn365(.*)',
  '/plataforma-viral(.*)',
]);

const isProtectedRoute = createRouteMatcher([
  '/dashboard(.*)', 
  '/api/entries(.*)',
  '/f1-fantasy-panel(.*)' // Move f1-fantasy-panel to protected instead
]);

export default clerkMiddleware(async (auth, req) => {
  console.log('Middleware processing:', req.url);

  // Allow public routes
  if (isPublicRoute(req)) {
    console.log('Public route matched:', req.nextUrl.pathname);
    return NextResponse.next();
  }

  const authResult = await auth();
  const { userId } = authResult;

  // Handle protected routes
  if (!userId && isProtectedRoute(req)) {
    const signInUrl = new URL('/sign-in', req.url);
    const redirectUrl = req.nextUrl.pathname + req.nextUrl.search;
    console.log('Redirecting to sign-in with redirect_url:', redirectUrl);
    signInUrl.searchParams.set('redirect_url', redirectUrl);
    return NextResponse.redirect(signInUrl);
  }

  console.log('Authenticated request proceeding:', req.nextUrl.pathname);
  return NextResponse.next();
});

export const config = {
  matcher: [
    '/((?!.*\\..*|_next).*)',
    '/',
    '/(api|trpc)(.*)',
  ],
};