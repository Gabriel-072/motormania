import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';

const isPublicRoute = createRouteMatcher([
  '/',
  '/sign-in(.*)',
  '/sign-up(.*)',
  '/mmc-go(.*)',
  '/api/webhooks/bold(.*)', // Específico para el webhook de Bold
  '/api/webhooks(.*)', // Mantiene compatibilidad con otros webhooks
  '/f1-fantasy-panel(.*)',
  '/jugar-y-gana(.*)',
]);

const isProtectedRoute = createRouteMatcher(['/dashboard(.*)', '/api/entries(.*)']);

export default clerkMiddleware(async (auth, req) => {
  // Log para depurar qué rutas llegan al middleware
  console.log('Middleware processing:', req.url);

  // Permitir rutas públicas sin autenticación
  if (isPublicRoute(req)) {
    console.log('Public route matched:', req.nextUrl.pathname);
    return NextResponse.next();
  }

  const authResult = await auth();
  const { userId } = authResult;

  // Proteger rutas privadas
  if (!userId && isProtectedRoute(req)) {
    const signInUrl = new URL('/sign-in', req.url);
    const redirectUrl = req.nextUrl.pathname + req.nextUrl.search;
    console.log('Redirecting to sign-in with redirect_url:', redirectUrl);
    signInUrl.searchParams.set('redirect_url', redirectUrl);
    return NextResponse.redirect(signInUrl);
  }

  // Continuar con solicitudes autenticadas
  console.log('Authenticated request proceeding:', req.nextUrl.pathname);
  return NextResponse.next();
});

export const config = {
  matcher: [
    // Aplicar middleware a todas las rutas excepto assets estáticos y _next
    '/((?!.*\\..*|_next).*)',
    '/',
    '/(api|trpc)(.*)',
  ],
};