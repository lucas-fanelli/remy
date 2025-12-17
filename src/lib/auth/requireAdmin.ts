import { NextRequest, NextResponse } from 'next/server';
import { container } from '@/lib/container/container';

export interface AdminAuthResult {
    userId: string;
    email: string;
    username: string;
    role: string;
    isAdmin: boolean;
}

/**
 * Middleware to verify admin access from JWT token.
 * Returns admin user info if authorized, or NextResponse with error if not.
 */
export async function requireAdmin(
    request: NextRequest
): Promise<AdminAuthResult | NextResponse> {
    const authHeader = request.headers.get('Authorization');

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return NextResponse.json(
            { error: 'Authorization header required' },
            { status: 401 }
        );
    }

    const token = authHeader.substring(7);

    try {
        const tokenService = container.getTokenService();
        const payload = tokenService.verify(token);

        if (!payload || !payload.userId) {
            return NextResponse.json(
                { error: 'Invalid token' },
                { status: 401 }
            );
        }

        // Check if user has admin role
        if (payload.role !== 'ADMIN') {
            return NextResponse.json(
                { error: 'Admin access required' },
                { status: 403 }
            );
        }

        return {
            userId: payload.userId,
            email: payload.email || '',
            username: payload.username || '',
            role: payload.role,
            isAdmin: true,
        };
    } catch {
        return NextResponse.json(
            { error: 'Invalid or expired token' },
            { status: 401 }
        );
    }
}

/**
 * Helper to check if the result is an error response
 */
export function isAdminAuthError(
    result: AdminAuthResult | NextResponse
): result is NextResponse {
    return result instanceof NextResponse;
}
