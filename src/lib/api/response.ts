import { NextResponse } from 'next/server';

// Standard error format across the API is `{ error: 'message' }` with an appropriate HTTP status code.
// ApiResponseHelper wraps this pattern with additional `success` and optional `data` fields.
// New routes should use the simple `{ error: 'message' }` format for consistency with the majority of existing routes.

export type ApiResponse<T = any> = {
  success: boolean;
  data?: T;
  error?: string;
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

  static badRequest(error: string): NextResponse<ApiResponse> {
    return NextResponse.json(
      {
        success: false,
        error,
      },
      { status: 400 }
    );
  }

  static unauthorized(error: string = 'Unauthorized'): NextResponse<ApiResponse> {
    return NextResponse.json(
      {
        success: false,
        error,
      },
      { status: 401 }
    );
  }

  static forbidden(error: string = 'Forbidden'): NextResponse<ApiResponse> {
    return NextResponse.json(
      {
        success: false,
        error,
      },
      { status: 403 }
    );
  }

  static notFound(error: string = 'Not found'): NextResponse<ApiResponse> {
    return NextResponse.json(
      {
        success: false,
        error,
      },
      { status: 404 }
    );
  }

  static conflict(error: string): NextResponse<ApiResponse> {
    return NextResponse.json(
      {
        success: false,
        error,
      },
      { status: 409 }
    );
  }

  static internalError(error: string = 'Internal server error'): NextResponse<ApiResponse> {
    return NextResponse.json(
      {
        success: false,
        error,
      },
      { status: 500 }
    );
  }
}
