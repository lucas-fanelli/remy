'use client';

import PantrySkeleton from '@/components/pantry/PantrySkeleton';

/**
 * What shows the moment the pantry is opened, while the page is on its way. It used to be
 * null, under a comment saying that kept the previous page visible; a loading boundary
 * replaces the page at once, so it blanked the main area instead.
 */
export default function Loading() {
  return <PantrySkeleton />;
}
