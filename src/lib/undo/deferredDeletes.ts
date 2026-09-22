/**
 * Deletes that wait before they happen, so that "Deshacer" can take them back.
 *
 * Lucas's decision (2026-09-22), after deleting pantry items in production: a delete should
 * offer Undo, and it should do it by waiting rather than by deleting and re-creating. The
 * thing leaves the screen at once, the real delete is sent when the window below has
 * passed, and Undo within it cancels the delete — nothing reached the server, so nothing
 * has to be rebuilt. That matters most for a recipe: deleting one also deletes its photo
 * and its comments, which no "restore" could bring back.
 *
 * One delete waits at a time. Starting another sends the one before at once: its toast is
 * about to be covered, and an Undo nobody can see is not one.
 *
 * Nothing waiting is lost: the page going away (a closed tab, a reload), the tab going to
 * the background — where a phone may never bring it back — and signing out all send it
 * straight away, with `keepalive` so the request outlives the page.
 *
 * While a delete waits, the server still has the thing, so any read of a list that holds
 * it would bring it back. Each entry's `hide` is applied again after every read (see
 * reapplyHidden, wired to the query cache in QueryProvider), and screens that keep a list
 * in their own state filter it through isHidden. That holds until the server has answered
 * the delete, not only until it is sent.
 */

import type { QueryClient } from '@tanstack/react-query';

/** How long Undo is offered, and how long the delete waits. */
export const UNDO_WINDOW_MS = 6000;

export interface DeferredDelete {
  /** What is being deleted, as '<kind>:<id>' — 'pantry:…', 'recipe:…', 'comment:…'. */
  key: string;
  /** Take it off the screen. Runs at once, and again after every read while it is hidden. */
  hide: () => void;
  /** Put it back: Undo was pressed, or the delete failed. */
  restore: () => void;
  /** Send the delete. Rejects when it did not happen. */
  commit: (options: { keepalive: boolean }) => Promise<void>;
  /** The server has it. */
  onCommitted?: () => void;
  /** The delete failed and has been restored; tell the reader. */
  onFailed: (error: unknown) => void;
  /** It stopped waiting — sent, or undone. Its toast should go. */
  onSettled?: () => void;
}

let waiting: { entry: DeferredDelete; timer: ReturnType<typeof setTimeout> } | null = null;
/** Sent, not yet answered: still hidden, since a read now could still include it. */
const sending = new Map<string, DeferredDelete>();
/** When each of those is answered, either way. */
const answered = new Map<string, Promise<void>>();
const listeners = new Set<() => void>();
/** Changes whenever anything above does: the snapshot useSyncExternalStore compares. */
let version = 0;

const notify = () => {
  version += 1;
  listeners.forEach((listener) => listener());
};

function send(entry: DeferredDelete, keepalive: boolean) {
  sending.set(entry.key, entry);
  notify();
  const done = entry.commit({ keepalive }).then(
    () => {
      sending.delete(entry.key);
      answered.delete(entry.key);
      // Once more: a read that left before the delete landed may have answered since.
      entry.hide();
      entry.onCommitted?.();
      notify();
    },
    (error: unknown) => {
      sending.delete(entry.key);
      answered.delete(entry.key);
      entry.restore();
      entry.onFailed(error);
      notify();
    }
  );
  answered.set(entry.key, done);
}

/**
 * Resolves once the delete sent under `key` has been answered, or at once if none is on
 * its way. For a write that must reach the server AFTER it — saving a recipe again while
 * its removal is in flight would otherwise race it, and could land first.
 */
export function whenAnswered(key: string): Promise<void> {
  return answered.get(key) ?? Promise.resolve();
}

/** Send the waiting delete now. `keepalive` when the page may be going away. */
export function sendWaitingDelete(keepalive = false): void {
  if (!waiting) return;
  const { entry, timer } = waiting;
  clearTimeout(timer);
  waiting = null;
  entry.onSettled?.();
  send(entry, keepalive);
}

/** Hide something now and delete it when the Undo window has passed. */
export function deferDelete(entry: DeferredDelete): void {
  listenForTheEnd();
  sendWaitingDelete();
  entry.hide();
  waiting = { entry, timer: setTimeout(() => sendWaitingDelete(), UNDO_WINDOW_MS) };
  notify();
}

/** Take back the delete waiting under `key`. False when there is none: it was sent already. */
export function undoDelete(key: string): boolean {
  if (waiting?.entry.key !== key) return false;
  const { entry, timer } = waiting;
  clearTimeout(timer);
  waiting = null;
  entry.onSettled?.();
  entry.restore();
  notify();
  return true;
}

/** Whether `key` is waiting to be deleted, and can still be undone. */
export function isWaiting(key: string): boolean {
  return waiting?.entry.key === key;
}

/** Whether `key` should be off the screen: waiting, or sent and not yet answered. */
export function isHidden(key: string): boolean {
  return isWaiting(key) || sending.has(key);
}

/** Every hidden entry takes itself off the screen again: a read may have brought it back. */
export function reapplyHidden(): void {
  waiting?.entry.hide();
  sending.forEach((entry) => entry.hide());
}

/** For useSyncExternalStore: screens that filter their own lists re-render on changes. */
export function subscribeToDeletes(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** For useSyncExternalStore: a new value whenever what is hidden changes. */
export const deletesVersion = (): number => version;

/**
 * After every read the cache takes from the server, hide again what is waiting to be
 * deleted. Only reads: a `hide` writes to the cache itself, and those writes (`manual`)
 * must not set this off again.
 */
export function keepDeletesHidden(queryClient: QueryClient): () => void {
  return queryClient.getQueryCache().subscribe((event) => {
    if (event.type === 'updated' && event.action.type === 'success' && !event.action.manual) {
      reapplyHidden();
    }
  });
}

let listening = false;

/** The page is going away, or may never come back from the background: send it now. */
function listenForTheEnd() {
  if (listening || typeof window === 'undefined') return;
  listening = true;
  window.addEventListener('pagehide', () => sendWaitingDelete(true));
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') sendWaitingDelete(true);
  });
}

/** Tests only: forget everything between cases. */
export function resetDeferredDeletesForTests(): void {
  if (waiting) clearTimeout(waiting.timer);
  waiting = null;
  sending.clear();
  answered.clear();
}
