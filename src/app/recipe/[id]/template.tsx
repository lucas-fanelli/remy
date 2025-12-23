'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';

/**
 * Template file for recipe detail pages
 *
 * Uses AnimatePresence with pathname key to ensure animation triggers
 * on every navigation, including first load from home page.
 *
 * The isClient pattern prevents SSR hydration mismatch by not rendering
 * the animation wrapper until client-side hydration completes.
 *
 * @see https://nextjs.org/docs/app/building-your-application/routing/pages-and-layouts#templates
 */
export default function RecipeTemplate({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [isClient, setIsClient] = useState(false);

  // Wait for client-side hydration to complete before animating
  useEffect(() => {
    setIsClient(true);
  }, [pathname]);

  // Don't render animation wrapper during SSR - prevents hydration mismatch
  if (!isClient) {
    return <>{children}</>;
  }

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={pathname}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.5, ease: 'easeOut' }}
        style={{ minHeight: '100vh' }}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
}
