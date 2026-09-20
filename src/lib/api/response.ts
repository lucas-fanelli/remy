import { NextResponse } from 'next/server';
import type { ApiErrorCode } from './errorCodes';

// Standard error format across the API is `{ error: 'message' }` with an appropriate HTTP status code.
// ApiResponseHelper wraps this pattern with additional `success` and optional `data` fields.
// New routes should use the simple `{ error: 'message' }` format for consistency with the majority of existing routes.
//
// Every error helper takes an OPTIONAL machine `code` next to the unchanged English `error`
// (see errorCodes.ts). It is left out of the JSON when a route does not pass one, so a route
// that has not been migrated yet answers byte-for-byte what it always did.

export type ApiResponse<T = any> = {
  success: boolean;
  data?: T;
  error?: string;
  code?: ApiErrorCode;
  message?: string;
};

export class ApiResponseHelper {
  static success<T>(data: T, message?: string): NextResponse<ApiResponse<T>> {
    return NextResponse.json(
      {
        success: true,
        data,
        message,
      },
      { status: 200 }
    );
  }

  static created<T>(data: T, message?: string): NextResponse<ApiResponse<T>> {
    return NextResponse.json(
      {
        success: true,
        data,
        message,
      },
      { status: 201 }
    );
  }

  static noContent(): NextResponse {
    return new NextResponse(null, { status: 204 });
  }

  static badRequest(error: string, code?: ApiErrorCode): NextResponse<ApiResponse> {
    return NextResponse.json(
      {
        success: false,
        error,
        code,
      },
      { status: 400 }
    );
  }

  static unauthorized(
    error: string = 'Unauthorized',
    code?: ApiErrorCode
  ): NextResponse<ApiResponse> {
    return NextResponse.json(
      {
        success: false,
        error,
        code,
      },
      { status: 401 }
    );
  }

  static forbidden(error: string = 'Forbidden', code?: ApiErrorCode): NextResponse<ApiResponse> {
    return NextResponse.json(
      {
        success: false,
        error,
        code,
      },
      { status: 403 }
    );
  }

  static notFound(error: string = 'Not found', code?: ApiErrorCode): NextResponse<ApiResponse> {
    return NextResponse.json(
      {
        success: false,
        error,
        code,
      },
      { status: 404 }
    );
  }

  static conflict(error: string, code?: ApiErrorCode): NextResponse<ApiResponse> {
    return NextResponse.json(
      {
        success: false,
        error,
        code,
      },
      { status: 409 }
    );
  }

  static internalError(
    error: string = 'Internal server error',
    code?: ApiErrorCode
  ): NextResponse<ApiResponse> {
    return NextResponse.json(
      {
        success: false,
        error,
        code,
      },
      { status: 500 }
    );
  }
}
