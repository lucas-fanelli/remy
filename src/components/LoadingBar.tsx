'use client';

import { LinearProgress, Box } from '@mui/material';
import { usePathname, useSearchParams } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';

export default function LoadingBar() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState(false);
  const prevPathnameRef = useRef(pathname);

  useEffect(() => {
    // Only show loading bar when the pathname actually changes
    if (prevPathnameRef.current === pathname) return;
    prevPathnameRef.current = pathname;

    // Show loading immediately when route changes
    setLoading(true);

    // Hide loading after a short delay (Next.js will handle the actual loading)
    const timer = setTimeout(() => setLoading(false), 500);

    return () => clearTimeout(timer);
  }, [pathname, searchParams]);

  if (!loading) return null;

  return (
    <Box
      // mui-fixed: MUI compensates fixed elements for the scrollbar it hides while an
      // overlay is open. Without the class this bar stayed put while the AppBar moved.
      className="mui-fixed"
      sx={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        // Above the AppBar, below modals: a route change during an open dialog used to
        // paint this bar over it (9999 outranked every MUI layer).
        zIndex: (theme) => theme.zIndex.appBar + 1,
      }}
    >
      <LinearProgress
        sx={{
          height: 3,
          '& .MuiLinearProgress-bar': {
            transition: 'transform 0.4s linear',
          },
        }}
      />
    </Box>
  );
}
