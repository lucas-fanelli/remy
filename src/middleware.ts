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

  if (!record || now > record.resetTime) {
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
  record.count++;
  rateLimitMap.set(key, record);

  return {
    allowed: record.count <= maxRequests,
    limit: maxRequests,
    remaining: Math.max(0, maxRequests - record.count),
    resetTime: record.resetTime,
  };
}

// Clean up old entries periodically
setInterval(() => {
  const now = Date.now();
  for (const [key, record] of rateLimitMap.entries()) {
    if (now > record.resetTime) {
      rateLimitMap.delete(key);
    }
  }
}, 60 * 1000); // Clean up every minute

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

  // Content Security Policy
  const csp = [
    "default-src 'self'",
    "script-src 'self' 'unsafe-eval' 'unsafe-inline'", // unsafe-inline needed for Next.js
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com",
    "img-src 'self' data: https: blob:",
    "connect-src 'self' https:",
    "frame-ancestors 'self'",
    "base-uri 'self'",
    "form-action 'self'",
  ].join('; ');
  response.headers.set('Content-Security-Policy', csp);

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
    const authHeader = request.headers.get('authorization');
    const cookieToken = request.cookies.get('auth_token')?.value;
    const rawToken = authHeader?.replace('Bearer ', '') || cookieToken;

    let isAdmin = false;
    if (rawToken && process.env.JWT_SECRET) {
      try {
        const parts = rawToken.split('.');
        if (parts.length === 3) {
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
          const signature = Uint8Array.from(
            atob(parts[2].replace(/-/g, '+').replace(/_/g, '/')),
            (c) => c.charCodeAt(0)
          );
          const valid = await crypto.subtle.verify('HMAC', key, signature, signatureInput);
          if (valid) {
            const payload = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')));
            const now = Math.floor(Date.now() / 1000);
            isAdmin = payload.role === 'ADMIN' && (!payload.exp || payload.exp > now);
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

  // Apply rate limiting to API routes only
  if (request.nextUrl.pathname.startsWith('/api')) {
    // Skip rate limiting and special handling for these routes
    if (
      request.nextUrl.pathname === '/api/health' ||
      request.nextUrl.pathname === '/api/ready' ||
      request.nextUrl.pathname === '/api/upload'
    ) {
      return response;
    }

    const isAuthEndpoint =
      request.nextUrl.pathname === '/api/auth/login' ||
      request.nextUrl.pathname === '/api/auth/register';
    const rateLimitKey = getRateLimitKey(request) + (isAuthEndpoint ? ':auth' : '');
    const maxRequests = isAuthEndpoint ? AUTH_RATE_LIMIT_MAX_REQUESTS : RATE_LIMIT_MAX_REQUESTS;
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
     * - api/upload (file upload endpoint)
     */
    '/((?!_next/static|_next/image|favicon.ico|api/upload|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
