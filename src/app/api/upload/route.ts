import { NextRequest, NextResponse } from 'next/server';
import { uploadToCloudinary } from '@/lib/cloudinary';
import { container } from '@/lib/container/container';

// Disable body parsing for file uploads in Next.js 15
export const runtime = 'nodejs';

/**
 * POST /api/upload - Upload an image file to Cloudinary
 */
export async function POST(request: NextRequest) {
  try {
    // Verify authentication
    const authHeader = request.headers.get('authorization');
    if (!authHeader) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const authToken = authHeader.replace('Bearer ', '');
    const tokenService = container.getTokenService();
    const payload = tokenService.verify(authToken);

    if (!payload) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    const formData = await request.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    // Check if file is actually a File instance
    if (!(file instanceof File)) {
      return NextResponse.json({ error: 'Invalid file object' }, { status: 400 });
    }

    // Validate file type
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif'];
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json(
        { error: 'Invalid file type. Only JPEG, PNG, WebP, and GIF are allowed.' },
        { status: 400 }
      );
    }

    // Validate file size (5MB max)
    const maxSize = 5 * 1024 * 1024; // 5MB
    if (file.size > maxSize) {
      return NextResponse.json({ error: 'File too large. Maximum size is 5MB.' }, { status: 400 });
    }

    // Convert file to buffer and validate magic bytes
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
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
    const { url: fileUrl, publicId } = await uploadToCloudinary(buffer, 'recipes');

    return NextResponse.json({
      success: true,
      url: fileUrl,
      publicId,
      size: file.size,
      type: file.type,
    });
  } catch (error) {
    console.error('Error uploading file:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to upload file' },
      { status: 500 }
    );
  }
}
