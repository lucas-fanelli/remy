'use client';
import { usePathname } from 'next/navigation';
import { useEffect, useRef } from 'react';

/**
 * Start a new page at the top of it — or, when the URL names a fragment, at that.
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
    const firstRender = isFirstRender.current;
    isFirstRender.current = false;

    if (cameFromHistory.current) {
      cameFromHistory.current = false;
      return;
    }

    const fragment = fragmentOf(window.location.hash);
    if (fragment) {
      // A new page is reset while its target loads; a first load is left where the
      // browser put it.
      return revealWhenRendered(fragment, { resetWhileWaiting: !firstRender });
    }

    // A first load, or a link opened in a new tab, is already where it should be.
    if (firstRender) return;

    window.scrollTo(0, 0);
  }, [pathname]);

  return null;
}

/**
 * The id a hash names. Anyone can type a URL, and a stray `%` makes decodeURIComponent throw
 * — from here, in the app's frame, that would take down every page; such a hash is simply
 * taken as written.
 */
function fragmentOf(hash: string): string {
  const raw = hash.slice(1);
  try {
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
}

/** Longer than any page here takes to render what it loads, short enough not to surprise. */
const GIVE_UP_AFTER_MS = 10_000;

/** The reader scrolling, tapping or typing: from then on the position is theirs. */
const READER_TOOK_OVER = ['wheel', 'touchstart', 'keydown', 'pointerdown'] as const;

/**
 * Scroll to the element a URL fragment names — once it exists, and keep it there while the
 * page fills in.
 *
 * The browser resolves a fragment when the page arrives, and on a page that loads its
 * content after that there is nothing yet to resolve it to: the comment button used to
 * land on the recipe's top, because the comments render after the recipe has loaded.
 *
 * Going there once the element appears is not enough either, measured on a recipe: at that
 * moment the photo above had not loaded and the comments below had not arrived, so the
 * page was too short to scroll that far, and as both came in the comments were pushed
 * back off the screen. So the target is placed again on every change to the page until
 * the reader moves, the page changes (the returned cleanup) or GIVE_UP_AFTER_MS passes.
 * Placing it where it already is does not scroll, so a settled page is left alone.
 */
function revealWhenRendered(id: string, { resetWhileWaiting }: { resetWhileWaiting: boolean }) {
  // The wait would otherwise happen wherever the previous page left the position.
  if (resetWhileWaiting && !document.getElementById(id)) window.scrollTo(0, 0);

  const place = () => {
    const target = document.getElementById(id);
    if (target) scrollToElement(target);
  };

  // Appearing, and anything rendered after it. A change of size alone, such as a photo
  // loading, is not a mutation — hence the second observer.
  const mutations = new MutationObserver(place);
  const resizes = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(place);
  const timer = window.setTimeout(() => stop(), GIVE_UP_AFTER_MS);

  function stop() {
    mutations.disconnect();
    resizes?.disconnect();
    window.clearTimeout(timer);
    READER_TOOK_OVER.forEach((type) => window.removeEventListener(type, stop));
  }

  place();
  mutations.observe(document.body, { childList: true, subtree: true });
  resizes?.observe(document.documentElement);
  READER_TOOK_OVER.forEach((type) => window.addEventListener(type, stop, { passive: true }));
  return stop;
}

/**
 * Put an element at the top of the viewport, under the fixed header.
 *
 * Not `scrollIntoView`: that goes to where the element is DRAWN, and the recipe page's
 * sections slide in from 20px below where they settle, so it would end 20px short and the
 * heading would slide up under the header. The layout position ignores transforms. The
 * header's height comes from the page's `scroll-padding-top` (globals.css), the same
 * offset the browser applies to every fragment and focus scroll on its own.
 */
function scrollToElement(element: HTMLElement) {
  let top = 0;
  for (let node: HTMLElement | null = element; node; node = node.offsetParent as HTMLElement) {
    top += node.offsetTop;
  }

  const headerOffset = parseFloat(getComputedStyle(document.documentElement).scrollPaddingTop) || 0;
  window.scrollTo(0, Math.max(0, top - headerOffset));
}
