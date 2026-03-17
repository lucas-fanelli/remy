import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin, isAdminAuthError } from '@/lib/auth/requireAdmin';
import { container } from '@/lib/container/container';

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function DELETE(request: NextRequest, { params }: RouteParams) {
  const authResult = await requireAdmin(request);

  if (isAdminAuthError(authResult)) {
    return authResult;
  }

  try {
    const { id } = await params;

    // Prevent admin from deleting themselves
    if (id === authResult.userId) {
      return NextResponse.json({ error: 'Cannot delete your own account' }, { status: 400 });
    }

    const adminService = container.getAdminService();
    await adminService.deleteUser(id);

    return NextResponse.json({ message: 'User deleted successfully' });
  } catch (error) {
    console.error('Error deleting user:', error);
    return NextResponse.json({ error: 'Failed to delete user' }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const authResult = await requireAdmin(request);

  if (isAdminAuthError(authResult)) {
    return authResult;
  }

  try {
    const { id } = await params;
    const body = await request.json();
    const { action } = body;

    if (!action || !['promote', 'demote'].includes(action)) {
      return NextResponse.json(
        { error: 'Invalid action. Must be "promote" or "demote"' },
        { status: 400 }
      );
    }

    // Prevent admin from demoting themselves
    if (action === 'demote' && id === authResult.userId) {
      return NextResponse.json({ error: 'Cannot demote yourself' }, { status: 400 });
    }

    const adminService = container.getAdminService();
    let user;

    if (action === 'promote') {
      user = await adminService.promoteToAdmin(id);
    } else if (action === 'demote') {
      user = await adminService.demoteToUser(id);
    } else {
      return NextResponse.json(
        { error: 'Invalid action. Use "promote" or "demote"' },
        { status: 400 }
      );
    }

    return NextResponse.json(user);
  } catch (error) {
    console.error('Error updating user role:', error);
    return NextResponse.json({ error: 'Failed to update user role' }, { status: 500 });
  }
}
