'use client';

import { usePathname } from 'next/navigation';
import React, { Suspense } from 'react';
import Footer from './Footer';
import AppShell from './layout/AppShell';
import ScrollReset from './layout/ScrollReset';
import LoadingBar from './LoadingBar';
import Navigation from './Navigation';

export default function LayoutWrapper({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  // Don't show navigation on auth pages (/auth, /auth/forgot-password, /auth/reset-password)
  const hideNavigation =
    pathname === '/auth' ||
    pathname?.startsWith('/auth/') ||
    pathname === '/login' ||
    pathname === '/register';

  return (
    <>
      <Suspense fallback={null}>
        <LoadingBar />
      </Suspense>
      {/* Every page, not the one page that showed the symptom: the others only look right
          because they collapse to nothing while loading. */}
      <ScrollReset />
      {/* Header, content and footer used to be three siblings with nothing arranging
          them, so every page had to arrange itself. AppShell is that arrangement. */}
      <AppShell
        header={hideNavigation ? undefined : <Navigation />}
        footer={hideNavigation ? undefined : <Footer />}
        hasBottomBar={!hideNavigation}
      >
        {children}
      </AppShell>
    </>
  );
}
