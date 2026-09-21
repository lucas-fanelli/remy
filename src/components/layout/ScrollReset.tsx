'use client';
import { usePathname } from 'next/navigation';
import { useEffect, useRef } from 'react';

/**
 * Start a new page at the top of it.
 *
 * Nothing did. Measured going from the feed at scroll 2500 into a recipe: the position
 * went 2500 → 64 → 597 → 740, and 740 + the 1273px viewport is exactly the recipe's
 * height. You land on the last line of a recipe you have not read yet.
 *
 * Three things stacked up to produce that, and only the first is the cause:
 *
 * 1. The scroll was never reset. 64 is the browser CLAMPING 2500 to the new document's
 *    maximum — a reset would have been 0.
 * 2. The recipe renders `minHeight: calc(100vh - 64px)` while it loads, so the document
 *    was 1337px: tall enough for that clamp to land at 64 rather than at 0.
 * 3. As the real content arrived and the document grew, scroll anchoring kept the reader
 *    pinned to what they were looking at — the bottom — and walked the position up to
 *    740. Confirmed by disabling `overflow-anchor`, which left it at 64.
 *
 * The pages that appear to work are not fixed, they are masked: they `return null` while
 * loading, their document collapses, the clamp lands at 0, and at 0 there is nothing above
 * the viewport for anchoring to hold. Which is why this lives in the shell and not in the
 * recipe page — the recipe is simply the one page whose loading state is honest about its
 * height.
 */
export default function ScrollReset() {
  const pathname = usePathname();
  const cameFromHistory = useRef(false);
  const isFirstRender = useRef(true);

  useEffect(() => {
    // Back and forward have their own position and the browser restores it. Marking the
    // navigation here, rather than resetting unconditionally, is the difference between
    // fixing this and replacing it with a worse bug.
    const markHistoryNavigation = () => {
      cameFromHistory.current = true;
    };

    window.addEventListener('popstate', markHistoryNavigation);
    return () => window.removeEventListener('popstate', markHistoryNavigation);
  }, []);

  useEffect(() => {
    // A first load, or a link opened in a new tab, is already where it should be — and a
    // deep link carrying a hash has to be left alone before anything else touches it.
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }

    if (cameFromHistory.current) {
      cameFromHistory.current = false;
      return;
    }

    // `#comments` is the comment button's whole purpose; the fragment owns the position.
    if (window.location.hash) {
      return;
    }

    window.scrollTo(0, 0);
  }, [pathname]);

  return null;
}
