'use client';

export const dynamic = 'force-dynamic';

import React, { Suspense } from 'react';
import { usePathname } from 'next/navigation';
import Navigation from './Navigation';
import LoadingBar from './LoadingBar';

export default function LayoutWrapper({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  // Don't show navigation on auth page
  const hideNavigation = pathname === '/auth' || pathname === '/login' || pathname === '/register';

  return (
    <>
      <Suspense fallback={null}>
        <LoadingBar />
      </Suspense>
      {!hideNavigation && <Navigation />}
      {children}
    </>
  );
}
