import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';

const isPublicRoute = createRouteMatcher([
  '/',
  '/sign-in(.*)',
  '/sign-up(.*)',
  '/mmc-go(.*)',              // 👈 Añade tu ruta especial
  '/api/webhooks(.*)',
  '/f1-fantasy-panel(.*)',    // (opcional: otras rutas que no quieras proteger)
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

  // Protect routes: redirect to sign-in if no userId
  if (!userId && isProtectedRoute(req)) {
    return NextResponse.redirect(new URL('/sign-in', req.url));
  }

  // Proceed with authenticated requests
  return NextResponse.next();
});

export const config = {
  matcher: ['/((?!.*\\..*|_next).*)', '/', '/(api|trpc)(.*)'],
};