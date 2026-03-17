import { NextRequest, NextResponse } from 'next/server';
import { uploadToCloudinary } from '@/lib/cloudinary';
import { container } from '@/lib/container/container';
import prisma from '@/lib/database/prisma';

// Configure route to use Node.js runtime
export const runtime = 'nodejs';
// Disable body parsing to handle FormData properly
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    // Get authorization token
    const authHeader = request.headers.get('authorization');
    if (!authHeader) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.replace('Bearer ', '');
    const tokenService = container.getTokenService();
    const payload = tokenService.verify(token);

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
    const header = buffer.subarray(0, 12);

    const isJpeg = header[0] === 0xff && header[1] === 0xd8 && header[2] === 0xff;
    const isPng =
      header[0] === 0x89 && header[1] === 0x50 && header[2] === 0x4e && header[3] === 0x47;
    const isGif = header[0] === 0x47 && header[1] === 0x49 && header[2] === 0x46;
    const isWebp =
      header[0] === 0x52 &&
      header[1] === 0x49 &&
      header[2] === 0x46 &&
      header[3] === 0x46 &&
      header[8] === 0x57 &&
      header[9] === 0x45 &&
      header[10] === 0x42 &&
      header[11] === 0x50;

    if (!isJpeg && !isPng && !isGif && !isWebp) {
      return NextResponse.json(
        { error: 'Invalid file content. File does not match any allowed image format.' },
        { status: 400 }
      );
    }

    // Upload to Cloudinary
    const { url: avatarUrl } = await uploadToCloudinary(buffer, 'avatars');

    // Update user's avatar in database
    await prisma.user.update({
      where: { id: payload.userId },
      data: { avatar: avatarUrl },
    });

    return NextResponse.json({
      url: avatarUrl,
      message: 'Avatar uploaded successfully',
    });
  } catch (error) {
    console.error('Error uploading avatar:', error);
    return NextResponse.json({ error: 'Failed to upload avatar' }, { status: 500 });
  }
}
