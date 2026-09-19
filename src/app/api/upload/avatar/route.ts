import { NextRequest, NextResponse } from 'next/server';
import { verifySessionToken } from '@/lib/api/auth';
import { uploadToCloudinary } from '@/lib/cloudinary';
import prisma from '@/lib/database/prisma';
import { extractAuthToken } from '@/lib/utils/auth';
import { cleanupCloudinaryImage } from '@/lib/utils/cloudinary-cleanup';
import { validateImageMagicBytes } from '@/lib/utils/image-validation';
import { logServerError } from '@/lib/utils/logger';

// Configure route to use Node.js runtime
export const runtime = 'nodejs';
// Disable body parsing to handle FormData properly
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const token = extractAuthToken(request);
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const payload = await verifySessionToken(token);

    if (!payload) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    // Check Content-Type header
    const contentType = request.headers.get('content-type');
    if (!contentType || !contentType.includes('multipart/form-data')) {
      return NextResponse.json(
        { error: `Invalid Content-Type. Expected multipart/form-data, got: ${contentType}` },
        { status: 400 }
      );
    }

    const formData = await request.formData();
    const file = formData.get('avatar') as File;

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    // Validate file type
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif'];
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json(
        { error: 'Invalid file type. Only JPEG, PNG, WebP, and GIF are allowed.' },
        { status: 400 }
      );
    }

    // Validate file size (max 5MB)
    const maxSize = 5 * 1024 * 1024; // 5MB in bytes
    if (file.size > maxSize) {
      return NextResponse.json(
        { error: 'File size too large. Maximum size is 5MB.' },
        { status: 400 }
      );
    }

    // Convert file to buffer and validate magic bytes
    const buffer = Buffer.from(await file.arrayBuffer());

    if (!validateImageMagicBytes(buffer)) {
      return NextResponse.json(
        { error: 'Invalid file content. File does not match any allowed image format.' },
        { status: 400 }
      );
    }

    // Get existing avatar for cleanup
    const existingUser = await prisma.user.findUnique({
      where: { id: payload.userId },
      select: { avatar: true },
    });

    // Upload to Cloudinary
    const { url: avatarUrl } = await uploadToCloudinary(buffer, 'avatars');

    // Update user's avatar in database
    await prisma.user.update({
      where: { id: payload.userId },
      data: { avatar: avatarUrl },
    });

    // Clean up old avatar from Cloudinary (best-effort)
    if (existingUser?.avatar) {
      try {
        await cleanupCloudinaryImage(existingUser.avatar);
      } catch (cleanupError) {
        logServerError('Failed to cleanup old avatar from Cloudinary:', cleanupError);
      }
    }

    return NextResponse.json({
      url: avatarUrl,
      message: 'Avatar uploaded successfully',
    });
  } catch (error) {
    logServerError('Error uploading avatar:', error);
    return NextResponse.json({ error: 'Failed to upload avatar' }, { status: 500 });
  }
}
