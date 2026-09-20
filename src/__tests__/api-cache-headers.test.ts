/**
 * @jest-environment node
 *
 * Every API response is written for one reader. These guard the two places that can put
 * one reader's answers in front of another: the HTTP cache, and the service worker.
 */
import fs from 'fs';
import path from 'path';
import { NextRequest } from 'next/server';
import { middleware } from '../middleware';

let ipCounter = 0;
const nextIp = () => `198.51.100.${++ipCounter}`;

function get(pathname: string): NextRequest {
  return new NextRequest(`http://localhost:3000${pathname}`, {
    method: 'GET',
    headers: { 'X-Requested-With': 'fetch', 'x-forwarded-for': nextIp() },
  });
}

describe('API responses are never cached by anything shared', () => {
  it.each([
    '/api/recipes',
    '/api/recipes/match',
    '/api/search?q=milanesa',
    '/api/users/lucas/profile',
    '/api/auth/me',
    // The health routes return early — they must still carry the headers.
    '/api/health',
  ])('%s is private, no-store, and varies by cookie', async (pathname) => {
    const response = await middleware(get(pathname));

    expect(response.headers.get('Cache-Control')).toBe('private, no-store, max-age=0');
    // Next appends its own RSC values to Vary downstream of the middleware, so the header
    // that reaches the browser reads "Cookie, rsc, ..." — Cookie has to be in it, and
    // pinning the whole string would break the next time Next adds one.
    expect(response.headers.get('Vary')).toContain('Cookie');
  });

  it('leaves page requests alone', async () => {
    const response = await middleware(get('/'));

    expect(response.headers.get('Cache-Control')).toBeNull();
  });
});

describe('the service worker does not store API responses', () => {
  const sw = fs.readFileSync(path.join(process.cwd(), 'src', 'sw.ts'), 'utf8');

  it('matches same-origin /api/ with NetworkOnly', () => {
    expect(sw).toMatch(/sameOrigin && url\.pathname\.startsWith\('\/api\/'\)/);
  });

  it('declares that rule before ...defaultCache, because first match wins', () => {
    const apiRule = sw.indexOf("url.pathname.startsWith('/api/')");
    const defaults = sw.indexOf('...defaultCache');

    expect(apiRule).toBeGreaterThan(-1);
    expect(defaults).toBeGreaterThan(-1);
    // defaultCache's `apis` entry keys per-user GETs by URL alone and keeps them for a day.
    // Ordering this rule after it would silently restore the leak.
    expect(apiRule).toBeLessThan(defaults);
  });
});
