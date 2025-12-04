import { NextRequest, NextResponse } from 'next/server';
import { uploadToCloudinary } from '@/lib/cloudinary';

// Disable body parsing for file uploads in Next.js 15
export const runtime = 'nodejs';

/**
 * POST /api/upload - Upload an image file to Cloudinary
 */
export async function POST(request: NextRequest) {
  try {
    console.log('[Upload] Request received');
    const formData = await request.formData();
    console.log('[Upload] FormData parsed');
    const file = formData.get('file') as File;

    console.log('[Upload] File from formData:', file ? `${file.name} (${file.type}, ${file.size} bytes)` : 'null');

    if (!file) {
      console.error('[Upload] No file in formData');
      return NextResponse.json(
        { error: 'No file provided' },
        { status: 400 }
      );
    }

    // Check if file is actually a File instance
    if (!(file instanceof File)) {
      console.error('[Upload] File is not a File instance:', typeof file);
      return NextResponse.json(
        { error: 'Invalid file object' },
        { status: 400 }
      );
    }

    // Validate file type
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif'];
    if (!allowedTypes.includes(file.type)) {
      console.error('[Upload] Invalid file type:', file.type);
      return NextResponse.json(
        { error: 'Invalid file type. Only JPEG, PNG, WebP, and GIF are allowed.' },
        { status: 400 }
      );
    }

    // Validate file size (5MB max)
    const maxSize = 5 * 1024 * 1024; // 5MB
    if (file.size > maxSize) {
      return NextResponse.json(
        { error: 'File too large. Maximum size is 5MB.' },
        { status: 400 }
      );
    }

    // Convert file to buffer
    console.log('[Upload] Converting file to buffer...');
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    console.log('[Upload] Buffer size:', buffer.length);

    // Upload to Cloudinary
    console.log('[Upload] Uploading to Cloudinary...');
    const { url: fileUrl, publicId } = await uploadToCloudinary(buffer, 'recipes');
    console.log('[Upload] File uploaded successfully:', fileUrl);

    return NextResponse.json({
      success: true,
      url: fileUrl,
      publicId,
      size: file.size,
      type: file.type,
    });
  } catch (error) {
    console.error('[Upload] Error uploading file:', error);
    console.error('[Upload] Error stack:', error instanceof Error ? error.stack : 'No stack trace');
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to upload file' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/upload - Get upload info (for testing)
 */
export async function GET() {
  return NextResponse.json({
    message: 'Upload API endpoint',
    instructions: 'POST a file with key "file" to upload an image',
    maxSize: '5MB',
    allowedTypes: ['image/jpeg', 'image/png', 'image/webp', 'image/gif'],
  });
}
