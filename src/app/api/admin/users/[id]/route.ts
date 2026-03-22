import { Prisma } from '@prisma/client';
import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin, isAdminAuthError } from '@/lib/auth/requireAdmin';
import { UUID_REGEX, PG_ADVISORY_LOCK_ADMIN_DELETE } from '@/lib/constants';
import { container } from '@/lib/container/container';
import prisma from '@/lib/database/prisma';
import { isCloudinaryUrl } from '@/lib/utils/cloudinary';
import { cleanupCloudinaryImage } from '@/lib/utils/cloudinary-cleanup';
import { logAuditEvent, logServerError } from '@/lib/utils/logger';
import { requireJsonContentType } from '@/lib/utils/request';

function maskEmail(email: string): string {
  const atIdx = email.indexOf('@');
  if (atIdx < 1) return '***@***';
  const local = email.slice(0, atIdx);
  const domain = email.slice(atIdx + 1);
  const maskedLocal = local[0] + '*'.repeat(Math.max(local.length - 1, 2));
  const dotIdx = domain.lastIndexOf('.');
  if (dotIdx < 1) return `${maskedLocal}@***`;
  const domainName = domain.slice(0, dotIdx);
  const tld = domain.slice(dotIdx);
  const maskedDomain =
    domainName.length <= 1 ? '***' : domainName[0] + '*'.repeat(Math.max(domainName.length - 1, 2));
  return `${maskedLocal}@${maskedDomain}${tld}`;
}

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
    if (!UUID_REGEX.test(id)) {
      return NextResponse.json({ error: 'Invalid ID format' }, { status: 400 });
    }

    // Prevent admin from deleting themselves
    if (id === authResult.userId) {
      return NextResponse.json({ error: 'Cannot delete your own account' }, { status: 400 });
    }

    logAuditEvent('ADMIN_USER_DELETE', { admin: authResult.userId, target: id });

    // Atomically check admin count + delete inside a transaction to prevent
    // race conditions where two concurrent requests could delete the last admin
    const imageUrls = await prisma.$transaction(
      async (tx) => {
        // Guard against long-running transactions (e.g., large cascade deletes)
        await tx.$executeRaw`SET LOCAL statement_timeout = '50s'`;

        // Global advisory lock (second key = 0): concurrent admin deletes of ANY user
        // must be serialized to prevent a race where two requests both see >1 admin
        // and then delete the last two admins simultaneously.
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(${PG_ADVISORY_LOCK_ADMIN_DELETE}, 0)`;

        // Re-verify the requesting user is still admin inside the transaction
        const requester = await tx.user.findUnique({
          where: { id: authResult.userId },
          select: { role: true },
        });
        if (!requester || requester.role !== 'ADMIN') throw new Error('NOT_ADMIN');

        const [userToDelete] = await tx.$queryRaw<
          [{ role: string }] | []
        >`SELECT role FROM "User" WHERE id = ${id}`;
        if (!userToDelete) throw new Error('USER_NOT_FOUND');
        if (userToDelete.role === 'ADMIN') {
          const [{ count }] = await tx.$queryRaw<[{ count: number }]>`
          SELECT COUNT(*)::int as count FROM "User" WHERE role = 'ADMIN'
        `;
          if (count <= 1) throw new Error('LAST_ADMIN');
        }
        // NOTE: Pre-delete image collection is best-effort. There is a small race window
        // where new posts/comments could be created between these queries and the
        // user.delete cascade below. Post-delete query of cascaded records isn't possible
        // with Prisma, so the cleanup-orphaned-images script is the authoritative solution
        // for any missed images.
        // REQUIREMENT: The cleanup-orphaned-images script (src/scripts/cleanup-orphaned-images.ts)
        // MUST be scheduled as a periodic cron job (e.g., daily) to handle images missed by
        // this best-effort collection. Without it, orphaned Cloudinary images will accumulate.
        const userPosts = await tx.post.findMany({
          where: { userId: id },
          select: { imageUrl: true, instructions: true },
        });
        const userComments = await tx.comment.findMany({
          where: { userId: id },
          select: { imageUrl: true },
        });
        const userRecord = await tx.user.findUnique({ where: { id }, select: { avatar: true } });
        await tx.user.delete({ where: { id } });
        const urls: (string | null | undefined)[] = [
          ...userPosts.map((p) => p.imageUrl),
          ...userComments.map((c) => c.imageUrl),
          userRecord?.avatar,
        ];
        // Collect instruction step images from recipes
        for (const post of userPosts) {
          if (Array.isArray(post.instructions)) {
            for (const instr of (post.instructions as unknown[]).slice(0, 50)) {
              if (instr && typeof instr === 'object' && !Array.isArray(instr) && 'image' in instr) {
                const img = (instr as Record<string, unknown>).image;
                if (typeof img === 'string') urls.push(img);
              }
            }
          }
        }
        return urls.filter((url): url is string => Boolean(url) && isCloudinaryUrl(url));
      },
      { timeout: 60000 }
    );

    // Clean up Cloudinary images after successful DB deletion (best-effort).
    // Log any failed deletions so the cleanup script can process them.
    const results = await Promise.allSettled(imageUrls.map((url) => cleanupCloudinaryImage(url)));
    const failedUrls = imageUrls.filter((_, i) => results[i].status === 'rejected');
    if (failedUrls.length > 0) {
      console.warn(`[ORPHANED IMAGES] Failed to cleanup for deleted user ${id}:`, failedUrls);
    }

    return NextResponse.json({ message: 'User deleted successfully' });
  } catch (error) {
    if (error instanceof Error && error.message === 'USER_NOT_FOUND') {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }
    if (error instanceof Error && error.message === 'LAST_ADMIN') {
      return NextResponse.json({ error: 'Cannot delete the last admin' }, { status: 400 });
    }
    if (error instanceof Error && error.message === 'NOT_ADMIN') {
      return NextResponse.json({ error: 'Admin privileges revoked' }, { status: 403 });
    }
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }
    logServerError('Error deleting user:', error);
    return NextResponse.json({ error: 'Failed to delete user' }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const authResult = await requireAdmin(request);

  if (isAdminAuthError(authResult)) {
    return authResult;
  }

  try {
    const ctError = requireJsonContentType(request);
    if (ctError) return ctError;

    const { id } = await params;
    if (!UUID_REGEX.test(id)) {
      return NextResponse.json({ error: 'Invalid ID format' }, { status: 400 });
    }
    let body;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }
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

    if (action === 'promote') {
      const result = await adminService.promoteToAdmin(id);
      return NextResponse.json({
        success: true,
        user: { ...result, email: maskEmail(result.email) },
      });
    } else {
      // Atomically check admin count + demote inside the advisory-locked transaction
      // to prevent a race where two concurrent demotions both see >1 admin
      const result = await prisma.$transaction(
        async (tx) => {
          await tx.$executeRaw`SELECT pg_advisory_xact_lock(${PG_ADVISORY_LOCK_ADMIN_DELETE}, 0)`;
          const [{ count }] = await tx.$queryRaw<[{ count: number }]>`
          SELECT COUNT(*)::int as count FROM "User" WHERE role = 'ADMIN' FOR UPDATE
        `;
          if (count <= 1) throw new Error('LAST_ADMIN');
          return tx.user.update({
            where: { id },
            data: { role: 'USER' },
            select: {
              id: true,
              username: true,
              email: true,
              role: true,
              fullName: true,
              avatar: true,
              isVerified: true,
              createdAt: true,
            },
          });
        },
        { timeout: 10000 }
      );
      return NextResponse.json({
        success: true,
        user: { ...result, email: maskEmail(result.email) },
      });
    }
  } catch (error) {
    if (error instanceof Error && error.message === 'LAST_ADMIN') {
      return NextResponse.json({ error: 'Cannot demote the last admin' }, { status: 400 });
    }
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }
    logServerError('Error updating user role:', error);
    return NextResponse.json({ error: 'Failed to update user role' }, { status: 500 });
  }
}
