import { NextRequest, NextResponse } from 'next/server';
import { ZodError } from 'zod';
import { ApiResponseHelper } from '@/lib/api/response';
import { container } from '@/lib/container/container';
import { setAuthCookie } from '@/lib/utils/cookies';
import { logServerError } from '@/lib/utils/logger';
import { requireJsonContentType } from '@/lib/utils/request';
import { loginSchema } from '@/lib/validation/schemas';

export async function POST(request: NextRequest) {
  try {
    const ctError = requireJsonContentType(request);
    if (ctError) return ctError;

    let body;
    try {
      body = await request.json();
    } catch {
      return ApiResponseHelper.badRequest('Invalid JSON body', 'invalidRequest');
    }

    const validatedData = loginSchema.parse(body);
    const authService = container.getAuthService();
    const result = await authService.login(validatedData);
    const { token, ...safeResult } = result;

    // Set httpOnly cookie with the token — do NOT include token in the response body
    const response = NextResponse.json(
      { success: true, data: safeResult, message: 'Login successful' },
      { status: 200 }
    );
    setAuthCookie(response, token);
    return response;
  } catch (error) {
    // No code: these are the per-field zod messages, and the generic 'invalidRequest'
    // sentence would say less than the English it would replace
    if (error instanceof ZodError) {
      return ApiResponseHelper.badRequest(error.errors.map((e) => e.message).join(', '));
    }

    if (error instanceof Error && error.message.includes('Invalid credentials')) {
      return ApiResponseHelper.unauthorized(error.message, 'auth.invalidCredentials');
    }

    logServerError('Login error:', error);
    return ApiResponseHelper.internalError(undefined, 'serverError');
  }
}
