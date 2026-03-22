import { NextResponse } from 'next/server';

const COOKIE_NAME = 'auth_token';
const COOKIE_MAX_AGE = 24 * 60 * 60; // 24 hours in seconds

/**
 * Set httpOnly auth cookie on a NextResponse
 */
export function setAuthCookie(response: NextResponse, token: string): NextResponse {
  response.cookies.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV !== 'development',
    sameSite: 'lax', // 'lax' sends cookie on top-level GET navigations (links from email/social) but blocks cross-site POST
    maxAge: COOKIE_MAX_AGE,
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
