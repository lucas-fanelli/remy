'use client';

import { usePathname } from 'next/navigation';
import React, { Suspense } from 'react';
import Footer from './Footer';
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
      {!hideNavigation && <Navigation />}
      {children}
      {!hideNavigation && <Footer />}
    </>
  );
}
