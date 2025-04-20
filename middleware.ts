// middleware.ts
import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';

const isPublicRoute = createRouteMatcher([
  '/',
  '/sign-in(.*)',
  '/sign-up(.*)',
  '/mmc-go(.*)',              
  '/api/webhooks(.*)',
  '/f1-fantasy-panel(.*)',    
  '/jugar-y-gana(.*)',
]);

const isProtectedRoute = createRouteMatcher(['/dashboard(.*)', '/api/entries(.*)']);

export default clerkMiddleware(async (auth, req) => {
  const authResult = await auth(); // auth() returns a promise, resolve it
  const { userId } = authResult;

  // Allow public routes to proceed
  if (isPublicRoute(req)) {
    return NextResponse.next();
  }

  // Protect routes: redirect to sign-in with redirect_url preserved
  if (!userId && isProtectedRoute(req)) {
    const signInUrl = new URL('/sign-in', req.url);
    const redirectUrl = req.nextUrl.pathname + req.nextUrl.search;
    console.log('Middleware redirecting to sign-in with redirect_url:', redirectUrl); // Debug log
    signInUrl.searchParams.set('redirect_url', redirectUrl);
    return NextResponse.redirect(signInUrl);
  }

  // Proceed with authenticated requests
  return NextResponse.next();
});

export const config = {
  matcher: ['/((?!.*\\..*|_next).*)', '/', '/(api|trpc)(.*)'],
};