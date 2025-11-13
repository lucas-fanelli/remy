'use client';
import React from 'react';
import { usePathname } from 'next/navigation';
import Navigation from './Navigation';

export default function LayoutWrapper({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  // Don't show navigation on auth page
  const hideNavigation = pathname === '/auth' || pathname === '/login' || pathname === '/register';

  return (
    <>
      {!hideNavigation && <Navigation />}
      {children}
    </>
  );
}
