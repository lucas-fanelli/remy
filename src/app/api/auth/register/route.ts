import { NextRequest, NextResponse } from 'next/server';
import { ZodError } from 'zod';
import { ApiResponseHelper } from '@/lib/api/response';
import { container } from '@/lib/container/container';
import { setAuthCookie } from '@/lib/utils/cookies';
import { registerSchema } from '@/lib/validation/schemas';

export async function POST(request: NextRequest) {
  try {
    let body;
    try {
      body = await request.json();
    } catch {
      return ApiResponseHelper.badRequest('Invalid JSON body');
    }

    const validatedData = registerSchema.parse(body);
    const authService = container.getAuthService();
    const result = await authService.register(validatedData);

    // Set httpOnly cookie with the token
    const response = NextResponse.json(
      { success: true, data: result, message: 'User registered successfully' },
      { status: 201 }
    );
    setAuthCookie(response, result.token);
    return response;
  } catch (error) {
    if (error instanceof ZodError) {
      return ApiResponseHelper.badRequest(error.errors.map((e) => e.message).join(', '));
    }

    if (error instanceof Error) {
      if (error.message.includes('already exists')) {
        return ApiResponseHelper.conflict(error.message);
      }
      return ApiResponseHelper.badRequest(error.message);
    }

    console.error('Registration error:', error);
    return ApiResponseHelper.internalError();
  }
}
