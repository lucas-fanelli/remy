import { NextRequest, NextResponse } from 'next/server';
import { clearAuthCookie } from '@/lib/utils/cookies';

export async function POST(request: NextRequest) {
  // Idempotent: skip if already logged out.
  if (!request.cookies.get('auth_token')) {
    return NextResponse.json({ success: true, message: 'Already logged out' }, { status: 200 });
  }

  const response = NextResponse.json(
    { success: true, message: 'Logged out successfully' },
    { status: 200 }
  );
  clearAuthCookie(response);
  return response;
}
