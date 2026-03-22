/**
 * Cleanup orphaned Cloudinary images that are no longer referenced in the database.
 *
 * IMPORTANT: This script MUST be scheduled as a periodic job (e.g., daily cron).
 * Without it, images deleted from the database (via admin routes, user deletions,
 * etc.) will remain in Cloudinary indefinitely, accumulating storage costs.
 * Example cron schedule: 0 3 * * * (daily at 3 AM UTC)
 *
 * Usage:
 *   npx tsx src/scripts/cleanup-orphaned-images.ts [--dry-run]
 *
 * Requires environment variables:
 *   DATABASE_URL, CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET
 *
 * How it works:
 *   1. Collects all image URLs from Post.imageUrl, Comment.imageUrl, and User.avatar
 *   2. Lists all images in the configured Cloudinary folders via the Admin API
 *   3. Deletes Cloudinary images that have no matching database reference
 */

import { PrismaClient } from '@prisma/client';
import { v2 as cloudinary } from 'cloudinary';

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const prisma = new PrismaClient();
const DRY_RUN = process.argv.includes('--dry-run');

function extractPublicId(url: string): string | null {
  const match = url.match(/\/upload\/(?:[^/]+\/)*([^/.]+)/);
  return match ? match[1] : null;
}

async function collectDatabaseImageUrls(): Promise<Set<string>> {
  const publicIds = new Set<string>();

  const posts = await prisma.post.findMany({
    where: { imageUrl: { not: '' } },
    select: { imageUrl: true },
  });
  for (const post of posts) {
    if (post.imageUrl) {
      const id = extractPublicId(post.imageUrl);
      if (id) publicIds.add(id);
    }
  }

  const comments = await prisma.comment.findMany({
    where: { imageUrl: { not: null } },
    select: { imageUrl: true },
  });
  for (const comment of comments) {
    if (comment.imageUrl) {
      const id = extractPublicId(comment.imageUrl);
      if (id) publicIds.add(id);
    }
  }

  const users = await prisma.user.findMany({
    where: { avatar: { not: null } },
    select: { avatar: true },
  });
  for (const user of users) {
    if (user.avatar) {
      const id = extractPublicId(user.avatar);
      if (id) publicIds.add(id);
    }
  }

  return publicIds;
}

async function listCloudinaryImages(folder: string): Promise<{ public_id: string }[]> {
  const results: { public_id: string }[] = [];
  let nextCursor: string | undefined;

  do {
    const response = await cloudinary.api.resources({
      type: 'upload',
      prefix: folder,
      max_results: 500,
      next_cursor: nextCursor,
    });
    results.push(...response.resources);
    nextCursor = response.next_cursor;
  } while (nextCursor);

  return results;
}

async function main() {
  console.log(`Cloudinary orphan cleanup${DRY_RUN ? ' (DRY RUN)' : ''}`);
  console.log('---');

  // Acquire advisory lock to prevent concurrent runs (e.g., overlapping cron jobs)
  await prisma.$executeRaw`SELECT pg_advisory_lock(48882, 0)`;

  const dbPublicIds = await collectDatabaseImageUrls();
  console.log(`Found ${dbPublicIds.size} image references in the database.`);

  const folders = ['recipes', 'avatars', 'comments'];
  let orphanCount = 0;
  let deleteCount = 0;

  for (const folder of folders) {
    console.log(`\nScanning Cloudinary folder: ${folder}`);
    let cloudImages: { public_id: string }[];
    try {
      cloudImages = await listCloudinaryImages(folder);
    } catch (err) {
      console.error(`  Failed to list folder "${folder}":`, err);
      continue;
    }

    console.log(`  Found ${cloudImages.length} images in Cloudinary.`);

    for (const img of cloudImages) {
      if (!dbPublicIds.has(img.public_id)) {
        orphanCount++;
        if (DRY_RUN) {
          console.log(`  [DRY RUN] Would delete: ${img.public_id}`);
        } else {
          try {
            await cloudinary.uploader.destroy(img.public_id, { resource_type: 'image' });
            deleteCount++;
            console.log(`  Deleted: ${img.public_id}`);
          } catch (err) {
            console.error(`  Failed to delete ${img.public_id}:`, err);
          }
        }
      }
    }
  }

  console.log('\n---');
  console.log(`Orphans found: ${orphanCount}`);
  if (!DRY_RUN) {
    console.log(`Deleted: ${deleteCount}`);
  }

  // Release advisory lock
  await prisma.$executeRaw`SELECT pg_advisory_unlock(48882, 0)`;

  await prisma.$disconnect();
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
