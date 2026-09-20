import { NextRequest, NextResponse } from 'next/server';
import { verifySessionToken } from '@/lib/api/auth';
import { uploadToCloudinary } from '@/lib/cloudinary';
import { extractAuthToken } from '@/lib/utils/auth';
import { validateImageMagicBytes } from '@/lib/utils/image-validation';
import { logServerError } from '@/lib/utils/logger';

// Disable body parsing for file uploads in Next.js 15
export const runtime = 'nodejs';

/**
 * POST /api/upload - Upload an image file to Cloudinary
 *
 * KNOWN LIMITATION: Uploaded images are not tracked per-user in the database.
 * Any authenticated user can reference any Cloudinary URL when creating/updating
 * a recipe. This is low-risk because Cloudinary URLs are not guessable (they
 * contain random public IDs), but a proper fix would require a new DB table
 * mapping uploads to users, which is a significant architecture change.
 */
export async function POST(request: NextRequest) {
  try {
    const authToken = extractAuthToken(request);
    if (!authToken) {
      return NextResponse.json({ error: 'Unauthorized', code: 'unauthorized' }, { status: 401 });
    }

    const payload = await verifySessionToken(authToken);

    if (!payload) {
      return NextResponse.json(
        { error: 'Invalid token', code: 'auth.invalidToken' },
        { status: 401 }
      );
    }

    // Check Content-Type header
    const contentType = request.headers.get('content-type');
    if (!contentType || !contentType.includes('multipart/form-data')) {
      return NextResponse.json(
        {
          error: 'Invalid Content-Type. Expected multipart/form-data.',
          code: 'upload.invalidContentType',
        },
        { status: 400 }
      );
    }

    const formData = await request.formData();
    const fileEntry = formData.get('file');

    if (!fileEntry || !(fileEntry instanceof File)) {
      return NextResponse.json(
        { error: 'No valid file provided', code: 'upload.noFile' },
        { status: 400 }
      );
    }
    const file = fileEntry;

    // Validate file type
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif'];
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json(
        {
          error: 'Invalid file type. Only JPEG, PNG, WebP, and GIF are allowed.',
          code: 'upload.invalidFileType',
        },
        { status: 400 }
      );
    }

    // Validate file size (5MB max)
    const maxSize = 5 * 1024 * 1024; // 5MB
    if (file.size > maxSize) {
      return NextResponse.json(
        { error: 'File too large. Maximum size is 5MB.', code: 'upload.tooLarge' },
        { status: 400 }
      );
    }

    // Convert file to buffer and validate magic bytes
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    if (!validateImageMagicBytes(buffer)) {
      return NextResponse.json(
        {
          error: 'Invalid file content. File does not match any allowed image format.',
          code: 'upload.invalidFileContent',
        },
        { status: 400 }
      );
    }

    // SECURITY: Upload ownership is not tracked. Any authenticated user can reference any Cloudinary URL.
    // This is mitigated by: (1) Cloudinary URLs contain random public IDs, (2) validateCloudinaryUrl checks
    // the URL belongs to our cloud account. Implementing an Upload table is recommended for production.
    // TODO: Track upload ownership (publicId -> userId) to prevent cross-user image references.

    // Upload to Cloudinary
    const { url: fileUrl } = await uploadToCloudinary(buffer, 'recipes');

    return NextResponse.json({
      success: true,
      url: fileUrl,
      size: file.size,
      type: file.type,
    });
  } catch (error) {
    logServerError('Error uploading file:', error);
    return NextResponse.json(
      { error: 'Failed to upload file', code: 'upload.failed' },
      { status: 500 }
    );
  }
}
