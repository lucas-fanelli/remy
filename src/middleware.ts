import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// Safe base64url decode that handles non-ASCII (e.g. accented usernames)
function b64UrlDecode(str: string): string {
  const base64 = str.replace(/-/g, '+').replace(/_/g, '/');
  const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4);
  const bytes = Uint8Array.from(atob(padded), (c) => c.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

/** Verify JWT signature and return payload, or null if invalid. */
async function verifyJwt(token: string, secret: string): Promise<Record<string, unknown> | null> {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const header = JSON.parse(b64UrlDecode(parts[0]));
    if (header.alg !== 'HS256') return null;
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      'raw',
      encoder.encode(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['verify']
    );
    const signatureInput = encoder.encode(`${parts[0]}.${parts[1]}`);
    const b64Sig = parts[2].replace(/-/g, '+').replace(/_/g, '/');
    const paddedSig = b64Sig + '='.repeat((4 - (b64Sig.length % 4)) % 4);
    const signature = Uint8Array.from(atob(paddedSig), (c) => c.charCodeAt(0));
    const valid = await crypto.subtle.verify('HMAC', key, signature, signatureInput);
    if (!valid) return null;
    return JSON.parse(b64UrlDecode(parts[1]));
  } catch {
    return null;
  }
}

// In-memory rate limiting
// WARNING: This is per-instance only. In multi-instance deployments (Vercel serverless, K8s),
// each instance has its own map. For production, replace with Redis/Upstash/Vercel KV.
const rateLimitMap = new Map<string, { count: number; resetTime: number }>();

// Configuration
const RATE_LIMIT_WINDOW = 15 * 60 * 1000; // 15 minutes
const RATE_LIMIT_MAX_REQUESTS = 100; // Max requests per window
const AUTH_RATE_LIMIT_MAX_REQUESTS = 10; // Stricter limit for auth endpoints
const UPLOAD_RATE_LIMIT_MAX_REQUESTS = 20; // Limit for file uploads
const MATCH_RATE_LIMIT_MAX_REQUESTS = 30; // Stricter limit for recipe match (expensive query)
const USER_WRITE_RATE_LIMIT_MAX_REQUESTS = 60; // Per-user limit for write operations

function getRateLimitKey(request: NextRequest): string {
  // Use IP address for rate limiting
  const forwarded = request.headers.get('x-forwarded-for');
  const ip = forwarded ? forwarded.split(',')[0] : 'unknown';
  return `ratelimit:${ip}`;
}

function checkRateLimit(
  key: string,
  maxRequests: number = RATE_LIMIT_MAX_REQUESTS
): {
  allowed: boolean;
  limit: number;
  remaining: number;
  resetTime: number;
} {
  const now = Date.now();
  const record = rateLimitMap.get(key);

  // Clean up expired entry on access
  if (record && now > record.resetTime) {
    rateLimitMap.delete(key);
  }

  // Probabilistic cleanup: 5% chance on each request to scan and remove expired entries
  if (Math.random() < 0.05) {
    for (const [k, v] of rateLimitMap.entries()) {
      if (now > v.resetTime) rateLimitMap.delete(k);
    }
  }

  // Enforce hard cap BEFORE inserting new entries to prevent unbounded growth
  if (rateLimitMap.size > 500) {
    for (const [k, v] of rateLimitMap.entries()) {
      if (now > v.resetTime) rateLimitMap.delete(k);
    }
    // If still over cap after expired cleanup, evict oldest 50 entries by resetTime to avoid
    // repeating O(n) scans on every request when many entries are active.
    if (rateLimitMap.size >= 500) {
      const entries = Array.from(rateLimitMap.entries())
        .sort((a, b) => a[1].resetTime - b[1].resetTime)
        .slice(0, 50);
      for (const [k] of entries) {
        rateLimitMap.delete(k);
      }
    }
  }

  const currentRecord = rateLimitMap.get(key);

  if (!currentRecord) {
    // Create new window
    const resetTime = now + RATE_LIMIT_WINDOW;
    rateLimitMap.set(key, { count: 1, resetTime });
    return {
      allowed: true,
      limit: maxRequests,
      remaining: maxRequests - 1,
      resetTime,
    };
  }

  // Increment counter
  currentRecord.count++;
  rateLimitMap.set(key, currentRecord);

  return {
    allowed: currentRecord.count <= maxRequests,
    limit: maxRequests,
    remaining: Math.max(0, maxRequests - currentRecord.count),
    resetTime: currentRecord.resetTime,
  };
}

export async function middleware(request: NextRequest) {
  const response = NextResponse.next();

  // Security Headers
  response.headers.set('X-DNS-Prefetch-Control', 'on');
  response.headers.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  response.headers.set('X-Frame-Options', 'SAMEORIGIN');
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('X-XSS-Protection', '1; mode=block');
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  response.headers.set(
    'Permissions-Policy',
    'camera=(), microphone=(), geolocation=(), interest-cohort=()'
  );

  // Content Security Policy with per-request nonce (replaces unsafe-inline)
  const nonce = Buffer.from(crypto.randomUUID()).toString('base64');

  const csp = [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' https://va.vercel-scripts.com`,
    // style-src needs 'unsafe-inline' because MUI Emotion injects <style> tags
    // client-side after hydration. The nonce covers SSR-rendered styles via
    // AppRouterCacheProvider, but dynamic sx-prop and theme-change styles
    // cannot carry the nonce. This is MUI's documented recommendation.
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com",
    "img-src 'self' data: https: blob:",
    "connect-src 'self' https://res.cloudinary.com https://*.sentry.io https://*.vercel-analytics.com https://*.vercel-insights.com",
    "frame-ancestors 'self'",
    "base-uri 'self'",
    "form-action 'self'",
  ].join('; ');
  response.headers.set('Content-Security-Policy', csp);

  // Pass the nonce to Next.js so it can apply it to inline <script> tags
  response.headers.set('x-nonce', nonce);

  // CORS Headers
  const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(',') || [];
  const origin = request.headers.get('origin');

  if (origin && (allowedOrigins.includes(origin) || process.env.NODE_ENV === 'development')) {
    response.headers.set('Access-Control-Allow-Origin', origin);
    response.headers.set('Access-Control-Allow-Credentials', 'true');
    response.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS, PATCH');
    response.headers.set(
      'Access-Control-Allow-Headers',
      'Content-Type, Authorization, X-Requested-With'
    );
  }

  // Handle preflight requests
  if (request.method === 'OPTIONS') {
    return new NextResponse(null, { status: 200, headers: response.headers });
  }

  // Block admin pages server-side for non-admin users with HMAC signature verification.
  // NOTE: This checks the role claim from the JWT, which may be stale after demotion.
  // This is defense-in-depth only — all admin API routes re-verify role from the DB
  // via requireAdmin(). A demoted user can see the admin UI shell until JWT expires,
  // but cannot perform any admin actions.
  if (request.nextUrl.pathname.startsWith('/admin')) {
    // Prefer httpOnly cookie over Bearer header (cookie is canonical auth)
    const cookieToken = request.cookies.get('auth_token')?.value;
    const authHeader = request.headers.get('authorization');
    const rawToken =
      cookieToken || (authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : null);

    let isAdmin = false;
    if (rawToken && process.env.JWT_SECRET) {
      const payload = await verifyJwt(rawToken, process.env.JWT_SECRET);
      if (payload) {
        const now = Math.floor(Date.now() / 1000);
        isAdmin = payload.role === 'ADMIN' && !!payload.exp && (payload.exp as number) > now;
      }
    }

    if (!isAdmin) {
      return NextResponse.redirect(new URL('/', request.url));
    }
  }

  // CSRF protection — layered defense for state-changing API requests:
  //
  // Layer 1: SameSite: lax cookie — sends cookies on top-level GET navigations
  //          but blocks cross-site POST/PUT/DELETE submissions.
  // Layer 2: Sec-Fetch-Site header — unforgeable browser header, strongest signal.
  // Layer 3: Custom header check — fallback for browsers without Sec-Fetch-Site.
  //
  // IMPORTANT: All file upload endpoints using multipart/form-data MUST include
  // the X-Requested-With: fetch header from the client. Without it, the request
  // will be rejected as a CSRF violation (multipart is a "simple" content type
  // that browsers send with standard form submissions).
  if (
    request.nextUrl.pathname.startsWith('/api') &&
    ['POST', 'PUT', 'PATCH', 'DELETE'].includes(request.method)
  ) {
    const contentType = request.headers.get('content-type');
    const secFetchSite = request.headers.get('sec-fetch-site');
    const isSameOrigin = secFetchSite === 'same-origin' || secFetchSite === 'none';

    // Multipart/form-data is a "simple" content type that browsers send with
    // standard form submissions. Require either Sec-Fetch-Site (same-origin) or
    // X-Requested-With to prove this isn't a cross-site form POST.
    if (
      contentType?.includes('multipart/form-data') &&
      !isSameOrigin &&
      !request.headers.has('x-requested-with')
    ) {
      return NextResponse.json(
        { error: 'Missing required request header for file upload' },
        { status: 403 }
      );
    }

    const hasCustomHeader = isSameOrigin || request.headers.has('x-requested-with');
    if (!hasCustomHeader) {
      return NextResponse.json({ error: 'Missing required request header' }, { status: 403 });
    }
  }

  // Apply rate limiting to API routes only
  if (request.nextUrl.pathname.startsWith('/api')) {
    // Skip rate limiting for health check routes
    if (request.nextUrl.pathname === '/api/health' || request.nextUrl.pathname === '/api/ready') {
      return response;
    }

    const isAuthEndpoint =
      request.nextUrl.pathname === '/api/auth/login' ||
      request.nextUrl.pathname === '/api/auth/register' ||
      request.nextUrl.pathname === '/api/auth/forgot-password' ||
      request.nextUrl.pathname === '/api/auth/reset-password';
    const isUploadEndpoint = request.nextUrl.pathname.startsWith('/api/upload');
    const isMatchEndpoint = request.nextUrl.pathname === '/api/recipes/match';
    const isNotificationGet =
      request.nextUrl.pathname === '/api/notifications' && request.method === 'GET';
    const isNotificationPost =
      request.nextUrl.pathname === '/api/notifications' && request.method === 'POST';
    const rateLimitSuffix = isAuthEndpoint
      ? ':auth'
      : isUploadEndpoint
        ? ':upload'
        : isMatchEndpoint
          ? ':match'
          : isNotificationPost
            ? ':notif-write'
            : '';
    const rateLimitKey = getRateLimitKey(request) + rateLimitSuffix;
    // Use higher limit for notification polling, stricter for expensive endpoints
    const maxRequests = isAuthEndpoint
      ? AUTH_RATE_LIMIT_MAX_REQUESTS
      : isUploadEndpoint
        ? UPLOAD_RATE_LIMIT_MAX_REQUESTS
        : isMatchEndpoint
          ? MATCH_RATE_LIMIT_MAX_REQUESTS
          : isNotificationGet
            ? 200 // Higher limit for polling
            : isNotificationPost
              ? 10 // Stricter limit for mark-all-as-read (10 per 15 minutes)
              : RATE_LIMIT_MAX_REQUESTS;
    const rateLimit = checkRateLimit(rateLimitKey, maxRequests);

    // Add rate limit headers
    response.headers.set('X-RateLimit-Limit', rateLimit.limit.toString());
    response.headers.set('X-RateLimit-Remaining', rateLimit.remaining.toString());
    response.headers.set('X-RateLimit-Reset', new Date(rateLimit.resetTime).toISOString());

    if (!rateLimit.allowed) {
      return NextResponse.json(
        {
          error: 'Too many requests',
          message: 'Rate limit exceeded. Please try again later.',
          retryAfter: Math.ceil((rateLimit.resetTime - Date.now()) / 1000),
        },
        {
          status: 429,
          headers: {
            'Retry-After': Math.ceil((rateLimit.resetTime - Date.now()) / 1000).toString(),
            ...Object.fromEntries(response.headers),
          },
        }
      );
    }

    // Per-user rate limiting for write operations — uses signature-verified JWT
    // to prevent userId spoofing via crafted cookies
    if (
      ['POST', 'PUT', 'PATCH', 'DELETE'].includes(request.method) &&
      !isAuthEndpoint &&
      process.env.JWT_SECRET
    ) {
      const cookieToken = request.cookies.get('auth_token')?.value;
      if (cookieToken) {
        const payload = await verifyJwt(cookieToken, process.env.JWT_SECRET);
        if (payload?.userId) {
          const userRateLimit = checkRateLimit(
            `ratelimit:user:${payload.userId}`,
            USER_WRITE_RATE_LIMIT_MAX_REQUESTS
          );
          if (!userRateLimit.allowed) {
            return NextResponse.json(
              {
                error: 'Too many requests',
                message: 'Per-user rate limit exceeded. Please try again later.',
                retryAfter: Math.ceil((userRateLimit.resetTime - Date.now()) / 1000),
              },
              {
                status: 429,
                headers: {
                  'Retry-After': Math.ceil(
                    (userRateLimit.resetTime - Date.now()) / 1000
                  ).toString(),
                  ...Object.fromEntries(response.headers),
                },
              }
            );
          }
        }
      }
    }
  }

  return response;
}

// Configure which routes use this middleware
export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
