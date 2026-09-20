import { NextRequest, after } from 'next/server';
import { ZodError } from 'zod';
import { ApiResponseHelper } from '@/lib/api/response';
import { container } from '@/lib/container/container';
import { logServerError } from '@/lib/utils/logger';
import { requireJsonContentType } from '@/lib/utils/request';
import { forgotPasswordSchema } from '@/lib/validation/schemas';

// One body for every well-formed request, whether or not the account exists
const GENERIC_MESSAGE =
  'If an account matches, we sent a link to reset the password. It expires in 60 minutes.';

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

    const { emailOrUsername } = forgotPasswordSchema.parse(body);

    // No user enumeration: the lookup, the token and the email all happen AFTER the
    // response has been sent, so status, body and response time are identical for
    // existing, unknown and throttled accounts. Failures are logged, never surfaced.
    after(async () => {
      try {
        await container.getPasswordResetService().requestReset(emailOrUsername);
      } catch (error) {
        logServerError('Forgot password error:', error);
      }
    });

    return ApiResponseHelper.success(null, GENERIC_MESSAGE);
  } catch (error) {
    // No code: these are the per-field zod messages, and the generic 'invalidRequest'
    // sentence would say less than the English it would replace
    if (error instanceof ZodError) {
      return ApiResponseHelper.badRequest(error.errors.map((e) => e.message).join(', '));
    }

    logServerError('Forgot password error:', error);
    return ApiResponseHelper.internalError(undefined, 'serverError');
  }
}
