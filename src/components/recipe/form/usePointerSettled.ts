'use client';
import { useCallback, useEffect, useRef } from 'react';

/**
 * Runs a job now, or - when a pointer is pressed - right after it is released.
 *
 * Fields and rows validate when focus leaves them, and a failing one grows by one helper
 * line. A press on a control below it (a quick-pick chip, 'Add ingredient') is what moves
 * focus out, so validating at once would shift that control from under the pointer between
 * the press and the release and the browser would drop the click. Keyboard focus changes
 * are not affected: no pointer is down, the job runs synchronously.
 *
 * Mouse events are tracked next to pointer events because a TAP moves focus in its
 * compatibility `mousedown`, which is dispatched after `pointerup`.
 */
const PRESS_EVENTS = ['pointerdown', 'mousedown'] as const;
const RELEASE_EVENTS = ['pointerup', 'pointercancel', 'mouseup'] as const;

export function usePointerSettled(): (job: () => void) => void {
  const pressed = useRef(false);
  const jobs = useRef<Array<() => void>>([]);

  useEffect(() => {
    const flush = () => {
      const pending = jobs.current;
      jobs.current = [];
      pending.forEach((job) => job());
    };
    const handlePress = () => {
      pressed.current = true;
    };
    const handleRelease = () => {
      pressed.current = false;
      // A timer, not the event itself: `click` is dispatched right after the release
      if (jobs.current.length > 0) setTimeout(flush, 0);
    };

    PRESS_EVENTS.forEach((type) => document.addEventListener(type, handlePress, true));
    RELEASE_EVENTS.forEach((type) => document.addEventListener(type, handleRelease, true));
    return () => {
      PRESS_EVENTS.forEach((type) => document.removeEventListener(type, handlePress, true));
      RELEASE_EVENTS.forEach((type) => document.removeEventListener(type, handleRelease, true));
      flush();
    };
  }, []);

  return useCallback((job: () => void) => {
    if (pressed.current) jobs.current.push(job);
    else job();
  }, []);
}
