import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return request.cookies.get(name)?.value;
        },
        set(name: string, value: string, options: CookieOptions) {
          request.cookies.set({
            name,
            value,
            ...options,
          });
          response = NextResponse.next({
            request: {
              headers: request.headers,
            },
          });
          response.cookies.set({
            name,
            value,
            ...options,
          });
        },
        remove(name: string, options: CookieOptions) {
          request.cookies.set({
            name,
            value: '',
            ...options,
          });
          response = NextResponse.next({
            request: {
              headers: request.headers,
            },
          });
          response.cookies.set({
            name,
            value: '',
            ...options,
          });
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const pathname = request.nextUrl.pathname;

  // If already authenticated and on the login page, redirect to intended or home
  if (user && pathname === '/login') {
    const url = request.nextUrl.clone();
    const returnUrl = url.searchParams.get('returnUrl') || '/';
    return NextResponse.redirect(new URL(returnUrl, request.url));
  }

  // If no user and trying to access protected route, redirect to login
  if (!user && pathname !== '/login') {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    url.searchParams.set('returnUrl', pathname);
    return NextResponse.redirect(url);
  }

  // No need to inject custom headers; server components will read user via @supabase/ssr

  return response;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - /login, /signup, /reset-password, /confirm (auth pages)
     * - /api/auth/* (auth API routes)
     * - /api/universities* (pre-auth public universities list/search)
     * - /_next/* (Next.js internals)
     * - /static/* (static files)
     * - /favicon.ico, /robots.txt, etc. (public files)
     */
    '/((?!login|signup|reset-password|update-password|confirm|api/auth|api/universities|_next|static|favicon.ico|robots.txt).*)',
    // Also run middleware on /login so we can redirect authenticated users away
    '/login',
  ],
};
