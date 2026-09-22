import { act, renderHook, waitFor } from '@testing-library/react';
import {
  NOTIFICATIONS_REFRESH_EVENT,
  requestNotificationsRefresh,
  useNotificationPolling,
} from '../useNotificationPolling';

/**
 * The poller's two follow-request duties: carry the pending count the server sends, and
 * fetch at once when a screen says the bell is out of date.
 *
 * Navigation.test.tsx covers the polling itself — backoff, the breaker, the 401 check —
 * through the component that owns it; this file is the contract other screens rely on.
 */

type Answer = { ok: boolean; status: number; json: () => Promise<unknown> };
const ok = (body: unknown): Answer => ({ ok: true, status: 200, json: async () => body });

const answer = (pendingRequestsCount: unknown, unreadCount = 0) =>
  ok({ notifications: [], unreadCount, pendingRequestsCount });

/**
 * A read that answers when the test says, and fails the way a real fetch does when its
 * signal aborts: the poller's guard against a stale answer is the abort, so a fake that
 * ignored it would test nothing.
 */
function heldRead(init?: RequestInit) {
  let release: (value: Answer) => void = () => {};
  const promise = new Promise<Answer>((resolve, reject) => {
    release = resolve;
    init?.signal?.addEventListener('abort', () =>
      reject(new DOMException('The operation was aborted.', 'AbortError'))
    );
  });
  return { promise, release };
}

const USER = { id: 'u1' };

/**
 * Stable, like Navigation's `logout`. The polling effect depends on it through
 * fetchNotifications, so a new function on every render would restart the effect on every
 * render, and the effect sets state: an endless loop.
 */
const onAuthInvalid = jest.fn();

function setup(user: { id: string } | null = USER) {
  return renderHook(({ who }) => useNotificationPolling({ user: who, onAuthInvalid }), {
    initialProps: { who: user },
  });
}

/** Every read of the notifications, in order. */
const reads = (mockFetch: jest.Mock) =>
  mockFetch.mock.calls.filter(([url]) => url === '/api/notifications');

describe('useNotificationPolling — follow requests', () => {
  let mockFetch: jest.Mock;

  beforeEach(() => {
    mockFetch = global.fetch as jest.Mock;
    mockFetch.mockReset();
  });

  describe('pendingRequestsCount', () => {
    it('is what the server counted', async () => {
      mockFetch.mockResolvedValue(answer(3, 1));
      const { result, unmount } = setup();

      await waitFor(() => expect(result.current.pendingRequestsCount).toBe(3));
      // Beside the unread count, not mixed into it.
      expect(result.current.unreadCount).toBe(1);
      unmount();
    });

    it.each([
      ['missing', undefined],
      ['not a number', '3'],
      ['negative', -1],
      ['not finite', Number.NaN],
    ])('is 0 when the answer’s count is %s', async (_label, value) => {
      mockFetch.mockResolvedValue(answer(value, 2));
      const { result, unmount } = setup();

      await waitFor(() => expect(result.current.unreadCount).toBe(2));
      expect(result.current.pendingRequestsCount).toBe(0);
      unmount();
    });

    it('starts again from 0 for the next person to sign in', async () => {
      mockFetch.mockResolvedValue(answer(4));
      const { result, rerender, unmount } = setup();
      await waitFor(() => expect(result.current.pendingRequestsCount).toBe(4));

      const next = heldRead();
      mockFetch.mockReturnValue(next.promise);
      rerender({ who: { id: 'u2' } });

      // Not the last person's four while the new person's count is on its way.
      expect(result.current.pendingRequestsCount).toBe(0);
      unmount();
    });
  });

  describe('the refresh event', () => {
    it('fetches at once, without waiting for the next poll', async () => {
      mockFetch.mockResolvedValueOnce(answer(2));
      const { result, unmount } = setup();
      await waitFor(() => expect(result.current.pendingRequestsCount).toBe(2));
      expect(reads(mockFetch)).toHaveLength(1);

      mockFetch.mockResolvedValueOnce(answer(1));
      act(() => requestNotificationsRefresh());

      await waitFor(() => expect(result.current.pendingRequestsCount).toBe(1));
      expect(reads(mockFetch)).toHaveLength(2);
      unmount();
    });

    it('is the plain window event other screens can raise by name', async () => {
      mockFetch.mockResolvedValueOnce(answer(2));
      const { result, unmount } = setup();
      await waitFor(() => expect(result.current.pendingRequestsCount).toBe(2));

      mockFetch.mockResolvedValueOnce(answer(0));
      act(() => {
        window.dispatchEvent(new Event('remy:notifications-refresh'));
      });

      await waitFor(() => expect(result.current.pendingRequestsCount).toBe(0));
      expect(NOTIFICATIONS_REFRESH_EVENT).toBe('remy:notifications-refresh');
      unmount();
    });

    it('a poll sent before the change cannot land after it and put the old count back', async () => {
      let stalePoll: ReturnType<typeof heldRead> | null = null;
      mockFetch.mockImplementationOnce((_url: string, init?: RequestInit) => {
        stalePoll = heldRead(init);
        return stalePoll.promise;
      });
      const { result, unmount } = setup();
      await waitFor(() => expect(stalePoll).not.toBeNull());

      // The owner answers the last request; the inbox asks for a refresh.
      mockFetch.mockResolvedValueOnce(answer(0));
      act(() => requestNotificationsRefresh());
      await waitFor(() => expect(reads(mockFetch)).toHaveLength(2));

      // The old poll's answer arrives last, still counting the request.
      await act(async () => stalePoll!.release(answer(1)));

      await waitFor(() => expect(result.current.pendingRequestsCount).toBe(0));
      expect((mockFetch.mock.calls[0][1] as RequestInit).signal?.aborted).toBe(true);
      unmount();
    });

    it('is not heard while nobody is signed in', () => {
      const { unmount } = setup(null);

      act(() => requestNotificationsRefresh());

      expect(mockFetch).not.toHaveBeenCalled();
      unmount();
    });

    it('is not heard after the navigation is gone', async () => {
      mockFetch.mockResolvedValue(answer(1));
      const { unmount } = setup();
      await waitFor(() => expect(reads(mockFetch)).toHaveLength(1));
      unmount();

      act(() => requestNotificationsRefresh());

      expect(reads(mockFetch)).toHaveLength(1);
    });
  });
});
