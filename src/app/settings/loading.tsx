'use client';

import SettingsSkeleton from '@/components/settings/SettingsSkeleton';

/**
 * What shows the moment settings are opened, while the page is on its way. It used to be
 * null, which blanked the main area.
 */
export default function Loading() {
  return <SettingsSkeleton />;
}
