import { NextRequest, NextResponse } from 'next/server';
import { writeFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';

/**
 * POST /api/upload - Upload an image file
 *
 * For production, consider using:
 * - Cloudinary: https://cloudinary.com/
 * - AWS S3: https://aws.amazon.com/s3/
 * - Vercel Blob: https://vercel.com/docs/storage/vercel-blob
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

    // Create uploads directory if it doesn't exist
    const uploadsDir = path.join(process.cwd(), 'public', 'uploads');
    console.log('[Upload] Uploads directory:', uploadsDir);

    if (!existsSync(uploadsDir)) {
      console.log('[Upload] Creating uploads directory...');
      await mkdir(uploadsDir, { recursive: true });
      console.log('[Upload] Directory created');
    }

    // Generate unique filename
    const fileExtension = path.extname(file.name);
    const fileName = `${uuidv4()}${fileExtension}`;
    const filePath = path.join(uploadsDir, fileName);
    console.log('[Upload] File path:', filePath);

    // Convert file to buffer and save
    console.log('[Upload] Converting file to buffer...');
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    console.log('[Upload] Buffer size:', buffer.length);

    console.log('[Upload] Writing file...');
    await writeFile(filePath, buffer);
    console.log('[Upload] File written successfully');

    // Return the URL to access the uploaded file
    const fileUrl = `/uploads/${fileName}`;
    console.log('[Upload] File URL:', fileUrl);

    return NextResponse.json({
      success: true,
      url: fileUrl,
      fileName,
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
