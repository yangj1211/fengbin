import { NextResponse } from 'next/server';
export function proxy() {
  const response = NextResponse.next();
  response.headers.set('Cache-Control', 'private, no-store');
  response.headers.set('X-Robots-Tag', 'noindex, nofollow');
  return response;
}
export const config = {
  matcher: [
    '/',
    '/login',
    '/apps/:path*',
    '/records/:path*',
    '/data',
    '/api/auth/:path*',
  ],
};
