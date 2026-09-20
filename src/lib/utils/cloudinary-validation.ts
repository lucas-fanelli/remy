import { NextResponse } from 'next/server';

// URL validation via validateCloudinaryUrl is applied on all write paths (POST/PATCH)
// that accept an imageUrl. This write-time validation is sufficient to ensure only
// trusted Cloudinary URLs are stored in the database; no additional DB-level constraint
// is needed since all entry points are covered.

// isCloudinaryUrl is exported from @/lib/utils/cloudinary (single source of truth).
// Do not duplicate it here.

export function validateCloudinaryUrl(imageUrl: string): NextResponse | null {
  try {
    const url = new URL(imageUrl);
    const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
    if (!cloudName) {
      console.error('CLOUDINARY_CLOUD_NAME is not configured');
      return NextResponse.json(
        { error: 'Image upload is currently unavailable', code: 'upload.unavailable' },
        { status: 400 }
      );
    }
    if (!['http:', 'https:'].includes(url.protocol) || url.hostname !== 'res.cloudinary.com') {
      return NextResponse.json(
        { error: 'Image must be uploaded through the app', code: 'upload.notFromApp' },
        { status: 400 }
      );
    }
    const decodedPath = decodeURIComponent(url.pathname);
    if (decodedPath.includes('..')) {
      return NextResponse.json(
        { error: 'Invalid image URL', code: 'upload.invalidUrl' },
        { status: 400 }
      );
    }
    if (!decodedPath.startsWith(`/${cloudName}/`)) {
      return NextResponse.json(
        { error: 'Image must be uploaded through the app', code: 'upload.notFromApp' },
        { status: 400 }
      );
    }
    return null; // Valid
  } catch {
    return NextResponse.json(
      { error: 'Invalid image URL', code: 'upload.invalidUrl' },
      { status: 400 }
    );
  }
}
