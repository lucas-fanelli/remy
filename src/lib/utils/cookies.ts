import { NextResponse } from 'next/server';
import { getSessionLifetimeSeconds } from '@/lib/auth/session';

const COOKIE_NAME = 'auth_token';

/**
 * Set httpOnly auth cookie on a NextResponse.
 * The cookie lives exactly as long as the token inside it (see lib/auth/session).
 */
export function setAuthCookie(response: NextResponse, token: string): NextResponse {
  response.cookies.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV !== 'development',
    sameSite: 'lax', // 'lax' sends cookie on top-level GET navigations (links from email/social) but blocks cross-site POST
    maxAge: getSessionLifetimeSeconds(),
    path: '/',
  });
  return response;
}

/**
 * Clear the auth cookie on a NextResponse
 */
export function clearAuthCookie(response: NextResponse): NextResponse {
  response.cookies.set(COOKIE_NAME, '', {
    httpOnly: true,
    secure: process.env.NODE_ENV !== 'development',
    sameSite: 'lax', // 'lax' sends cookie on top-level GET navigations (links from email/social) but blocks cross-site POST
    maxAge: 0,
    path: '/',
  });
  return response;
}
