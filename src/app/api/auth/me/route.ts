import { NextRequest } from 'next/server';
import { ApiResponseHelper } from '@/lib/api/response';
import { container } from '@/lib/container/container';
import { extractAuthToken } from '@/lib/utils/auth';
import { setAuthCookie } from '@/lib/utils/cookies';
import { logServerError } from '@/lib/utils/logger';

export async function GET(request: NextRequest) {
  try {
    const token = extractAuthToken(request);
    const session = token ? await container.getAuthService().validateSession(token) : null;

    // 401 means exactly one thing to the client: there is no session. A failure to
    // find out (database down, ...) is a 500 below, which must not log anybody out.
    if (!session) {
      return ApiResponseHelper.unauthorized(undefined, 'unauthorized');
    }

    const response = ApiResponseHelper.success(session.user);

    // Sliding renewal: AuthProvider calls this route on every app load, so an active
    // user keeps getting a fresh token and cookie and is never logged out mid-use
    if (session.renewedToken) {
      setAuthCookie(response, session.renewedToken);
    }

    return response;
  } catch (error) {
    logServerError('Get current user error:', error);
    return ApiResponseHelper.internalError(undefined, 'serverError');
  }
}
