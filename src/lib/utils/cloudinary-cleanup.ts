import { deleteFromCloudinary } from '@/lib/cloudinary';

/**
 * Clean up an orphaned Cloudinary image by URL.
 * Silently ignores failures — callers should treat this as best-effort.
 */
export async function cleanupCloudinaryImage(imageUrl: string): Promise<void> {
  if (!imageUrl?.includes('cloudinary.com')) return;
  const match = imageUrl.match(/\/upload\/(?:v\d+\/)?(.+)\.[^.]+$/);
  if (match) {
    await deleteFromCloudinary(match[1]).catch(() => {});
  }
}
