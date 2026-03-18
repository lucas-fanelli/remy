import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// In-memory rate limiting
// WARNING: This is per-instance only. In multi-instance deployments (Vercel serverless, K8s),
// each instance has its own map. For production, replace with Redis/Upstash/Vercel KV.
const rateLimitMap = new Map<string, { count: number; resetTime: number }>();

// Configuration
const RATE_LIMIT_WINDOW = 15 * 60 * 1000; // 15 minutes
const RATE_LIMIT_MAX_REQUESTS = 100; // Max requests per window
const AUTH_RATE_LIMIT_MAX_REQUESTS = 10; // Stricter limit for auth endpoints
const UPLOAD_RATE_LIMIT_MAX_REQUESTS = 20; // Limit for file uploads

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

  // Bulk cleanup when map grows too large
  if (rateLimitMap.size > 1000) {
    for (const [k, v] of rateLimitMap.entries()) {
      if (now > v.resetTime) rateLimitMap.delete(k);
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
    `script-src 'self' 'nonce-${nonce}'`,
    `style-src 'self' 'nonce-${nonce}' https://fonts.googleapis.com`,
    "font-src 'self' https://fonts.gstatic.com",
    "img-src 'self' data: https: blob:",
    "connect-src 'self' https:",
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

  // Block admin pages server-side for non-admin users with HMAC signature verification
  if (request.nextUrl.pathname.startsWith('/admin')) {
    // Prefer httpOnly cookie over Bearer header (cookie is canonical auth)
    const cookieToken = request.cookies.get('auth_token')?.value;
    const authHeader = request.headers.get('authorization');
    const rawToken =
      cookieToken || (authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : null);

    let isAdmin = false;
    if (rawToken && process.env.JWT_SECRET) {
      try {
        const parts = rawToken.split('.');
        if (parts.length === 3) {
          // Validate algorithm is HS256 to prevent algorithm confusion attacks
          const headerJson = atob(parts[0].replace(/-/g, '+').replace(/_/g, '/'));
          const header = JSON.parse(headerJson);
          if (header.alg !== 'HS256') {
            throw new Error('Unsupported JWT algorithm');
          }

          // Verify HMAC-SHA256 signature using Web Crypto API
          const encoder = new TextEncoder();
          const key = await crypto.subtle.importKey(
            'raw',
            encoder.encode(process.env.JWT_SECRET),
            { name: 'HMAC', hash: 'SHA-256' },
            false,
            ['verify']
          );
          const signatureInput = encoder.encode(`${parts[0]}.${parts[1]}`);
          const b64Sig = parts[2].replace(/-/g, '+').replace(/_/g, '/');
          const paddedSig = b64Sig + '='.repeat((4 - (b64Sig.length % 4)) % 4);
          const signature = Uint8Array.from(atob(paddedSig), (c) => c.charCodeAt(0));
          const valid = await crypto.subtle.verify('HMAC', key, signature, signatureInput);
          if (valid) {
            const b64Payload = parts[1].replace(/-/g, '+').replace(/_/g, '/');
            const paddedPayload = b64Payload + '='.repeat((4 - (b64Payload.length % 4)) % 4);
            const payload = JSON.parse(atob(paddedPayload));
            const now = Math.floor(Date.now() / 1000);
            isAdmin = payload.role === 'ADMIN' && payload.exp && payload.exp > now;
          }
        }
      } catch {
        // Invalid token
      }
    }

    if (!isAdmin) {
      return NextResponse.redirect(new URL('/', request.url));
    }
  }

  // CSRF protection: state-changing API requests must include a custom header.
  // Browsers won't send custom headers on cross-origin form submissions, and
  // SameSite: strict cookies block cross-site inclusion entirely.
  if (
    request.nextUrl.pathname.startsWith('/api') &&
    ['POST', 'PUT', 'PATCH', 'DELETE'].includes(request.method)
  ) {
    const contentType = request.headers.get('content-type');
    // Sec-Fetch-Site is a browser-generated forbidden header (can't be set by JS)
    // that reliably identifies same-origin requests. This is the strongest CSRF defense.
    const secFetchSite = request.headers.get('sec-fetch-site');
    const isSameOrigin = secFetchSite === 'same-origin' || secFetchSite === 'none';
    // multipart/form-data is NOT included — it's a simple content type that
    // browsers send with standard <form> submissions (not a CSRF-proof signal).
    const hasCustomHeader =
      isSameOrigin ||
      (contentType && contentType.includes('application/json')) ||
      request.headers.has('authorization') ||
      request.headers.has('x-requested-with');
    if (!hasCustomHeader) {
      return NextResponse.json({ error: 'Missing required request header' }, { status: 403 });
    }
  }

  // Apply rate limiting to API routes only
  if (request.nextUrl.pathname.startsWith('/api')) {
    // Skip rate limiting for health check routes only
    if (request.nextUrl.pathname === '/api/health' || request.nextUrl.pathname === '/api/ready') {
      return response;
    }

    const isAuthEndpoint =
      request.nextUrl.pathname === '/api/auth/login' ||
      request.nextUrl.pathname === '/api/auth/register';
    const isUploadEndpoint = request.nextUrl.pathname.startsWith('/api/upload');
    const rateLimitSuffix = isAuthEndpoint ? ':auth' : isUploadEndpoint ? ':upload' : '';
    const rateLimitKey = getRateLimitKey(request) + rateLimitSuffix;
    const maxRequests = isAuthEndpoint
      ? AUTH_RATE_LIMIT_MAX_REQUESTS
      : isUploadEndpoint
        ? UPLOAD_RATE_LIMIT_MAX_REQUESTS
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
