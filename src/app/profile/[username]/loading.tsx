'use client';

import ProfileSkeleton from '@/components/profile/ProfileSkeleton';

/**
 * What shows the moment a profile is opened, while the page is on its way — the same
 * skeleton the page shows while its data loads. It used to be null, which blanked the main
 * area: a loading boundary replaces the previous page at once, it does not keep it.
 */
export default function Loading() {
  return <ProfileSkeleton />;
}
