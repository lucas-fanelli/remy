'use client';
import { useCallback, useEffect, useRef } from 'react';

/**
 * Runs a job now, or - when a pointer is pressed - right after it is released.
 *
 * Rows validate when focus leaves them, and a failing row grows by one helper line. A
 * mouse press on 'Add ingredient' (or on any control below the row) is what moves focus
 * out, so validating at once would shift that control from under the pointer between
 * mousedown and mouseup and the browser would drop the click. Keyboard focus changes are
 * not affected: no pointer is down, the job runs synchronously.
 */
export function usePointerSettled(): (job: () => void) => void {
  const pointerDown = useRef(false);
  const jobs = useRef<Array<() => void>>([]);

  useEffect(() => {
    const flush = () => {
      const pending = jobs.current;
      jobs.current = [];
      pending.forEach((job) => job());
    };
    const handleDown = () => {
      pointerDown.current = true;
    };
    const handleUp = () => {
      pointerDown.current = false;
      // A timer, not the event itself: `click` is dispatched right after `pointerup`
      if (jobs.current.length > 0) setTimeout(flush, 0);
    };

    document.addEventListener('pointerdown', handleDown, true);
    document.addEventListener('pointerup', handleUp, true);
    document.addEventListener('pointercancel', handleUp, true);
    return () => {
      document.removeEventListener('pointerdown', handleDown, true);
      document.removeEventListener('pointerup', handleUp, true);
      document.removeEventListener('pointercancel', handleUp, true);
      flush();
    };
  }, []);

  return useCallback((job: () => void) => {
    if (pointerDown.current) jobs.current.push(job);
    else job();
  }, []);
}
