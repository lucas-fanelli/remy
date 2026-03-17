import { NextRequest, NextResponse } from 'next/server';
import { ZodError } from 'zod';
import { ApiResponseHelper } from '@/lib/api/response';
import { container } from '@/lib/container/container';
import { setAuthCookie } from '@/lib/utils/cookies';
import { loginSchema } from '@/lib/validation/schemas';

export async function POST(request: NextRequest) {
  try {
    let body;
    try {
      body = await request.json();
    } catch {
      return ApiResponseHelper.badRequest('Invalid JSON body');
    }

    const validatedData = loginSchema.parse(body);
    const authService = container.getAuthService();
    const result = await authService.login(validatedData);

    // Set httpOnly cookie with the token
    const response = NextResponse.json(
      { success: true, data: result, message: 'Login successful' },
      { status: 200 }
    );
    setAuthCookie(response, result.token);
    return response;
  } catch (error) {
    if (error instanceof ZodError) {
      return ApiResponseHelper.badRequest(error.errors.map((e) => e.message).join(', '));
    }

    if (error instanceof Error) {
      if (error.message.includes('Invalid credentials')) {
        return ApiResponseHelper.unauthorized(error.message);
      }
      return ApiResponseHelper.badRequest(error.message);
    }

    console.error('Login error:', error);
    return ApiResponseHelper.internalError();
  }
}
