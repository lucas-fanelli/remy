import { ThemeProvider, createTheme } from '@mui/material/styles';
import { QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { testQueryClient } from '@/__tests__/helpers/queryClient';
import { ToastProvider } from '@/contexts/ToastContext';
import { queryKeys } from '@/lib/query/keys';
import NotificationsPage from '../page';
import '@testing-library/jest-dom';
import type { QueryClient } from '@tanstack/react-query';

/**
 * /notifications, the full list behind the bell.
 *
 * The page had no tests of its own until follow requests gave it two new rows and a pinned
 * one; this file covers what it already did as well, so the next change to it has a floor.
 */

const mockPush = jest.fn();
// One object, like the real router: the page's effect depends on it, and a new one on every
// render would re-run the effect and re-read the first page each time.
const mockRouter = { push: mockPush, back: jest.fn() };
jest.mock('next/navigation', () => ({
  useRouter: () => mockRouter,
}));

let mockUser: { id: string; username: string } | null = { id: 'me-id', username: 'vera' };
let mockAuthLoading = false;
jest.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({ user: mockUser, isLoading: mockAuthLoading, isAuthenticated: !!mockUser }),
}));

const sender = (username: string, fullName: string | null = null) => ({
  id: `id-${username}`,
  username,
  fullName,
  avatar: null,
});

const notification = (
  id: string,
  type: string,
  from: ReturnType<typeof sender>,
  extra: Record<string, unknown> = {}
) => ({
  id,
  type,
  isRead: false,
  createdAt: new Date().toISOString(),
  sender: from,
  postId: null,
  ...extra,
});

const EVERY_TYPE = [
  notification('n1', 'follow', sender('bruno', 'Bruno')),
  notification('n2', 'follow_request', sender('ana', 'Ana')),
  notification('n3', 'follow_accepted', sender('olga', 'Olga')),
  notification('n4', 'like', sender('carla'), { postId: 'r1', isRead: true }),
  notification('n5', 'comment', sender('dario', 'Darío'), { postId: 'r2', isRead: true }),
  notification('n6', 'rating', sender('eva', 'Eva'), { postId: 'r3', isRead: true }),
];

type Answer = { ok: boolean; status: number; json: () => Promise<unknown> };
const ok = (body: unknown): Answer => ({ ok: true, status: 200, json: async () => body });
const fail = (status: number, body: unknown = {}): Answer => ({
  ok: false,
  status,
  json: async () => body,
});

/** What GET /api/notifications answers next; each read takes the next one, then repeats it. */
let pages: Answer[] = [];
let mockFetch: jest.Mock;

const page = (notifications: unknown[], pendingRequestsCount?: number) =>
  ok({ notifications, unreadCount: 0, pendingRequestsCount });

let client: QueryClient;

function renderPage() {
  client = testQueryClient();
  return render(
    <QueryClientProvider client={client}>
      <ThemeProvider theme={createTheme()}>
        <ToastProvider>
          <NotificationsPage />
        </ToastProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

/** A notification row, found by its sentence, as the reader would tap it. */
const rowOf = (sentence: string) => screen.getByText(sentence).closest('li')!;

describe('/notifications', () => {
  beforeEach(() => {
    mockPush.mockReset();
    mockUser = { id: 'me-id', username: 'vera' };
    mockAuthLoading = false;
    pages = [page(EVERY_TYPE)];

    mockFetch = global.fetch as jest.Mock;
    mockFetch.mockReset();
    mockFetch.mockImplementation(async (input: string, init?: RequestInit) => {
      if (String(input).startsWith('/api/notifications?')) {
        return pages.length > 1 ? pages.shift()! : pages[0];
      }
      if (init?.method === 'PATCH' || init?.method === 'POST') return ok({ success: true });
      throw new Error(`Unexpected fetch: ${input}`);
    });
  });

  describe('before it has anything to show', () => {
    it('sends a signed-out reader to /auth', async () => {
      mockUser = null;
      renderPage();

      await waitFor(() => expect(mockPush).toHaveBeenCalledWith('/auth'));
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('holds the list’s place with a skeleton under the real title, instead of a blank page', () => {
      mockAuthLoading = true;
      renderPage();

      expect(screen.getByRole('heading', { name: 'Notifications' })).toBeInTheDocument();
      expect(screen.getByRole('status', { name: 'Loading...' })).toBeInTheDocument();
    });
  });

  describe('the rows', () => {
    it('says each type in its own sentence, the two request types included', async () => {
      renderPage();

      expect(await screen.findByText('Bruno started following you')).toBeInTheDocument();
      expect(screen.getByText('Ana requested to follow you')).toBeInTheDocument();
      expect(screen.getByText('Olga accepted your follow request')).toBeInTheDocument();
      expect(screen.getByText('carla liked your recipe')).toBeInTheDocument();
      expect(screen.getByText('Darío commented on your recipe')).toBeInTheDocument();
      expect(screen.getByText('Eva rated your recipe')).toBeInTheDocument();
    });

    it('gives the two request types icons of their own', async () => {
      renderPage();
      await screen.findByText('Ana requested to follow you');

      expect(rowOf('Ana requested to follow you')).toContainElement(
        screen.getByTestId('PersonAddAlt1Icon')
      );
      expect(rowOf('Olga accepted your follow request')).toContainElement(
        screen.getByTestId('HowToRegIcon')
      );
      expect(rowOf('Bruno started following you')).toContainElement(
        screen.getByTestId('PersonAddIcon')
      );
    });

    it('"quiere seguirte" opens the inbox, marking itself read with the CSRF header', async () => {
      renderPage();
      fireEvent.click(await screen.findByText('Ana requested to follow you'));

      await waitFor(() => expect(mockPush).toHaveBeenCalledWith('/notifications/requests'));
      expect(mockFetch).toHaveBeenCalledWith('/api/notifications/n2', {
        method: 'PATCH',
        headers: { 'X-Requested-With': 'fetch' },
      });
    });

    it('"aceptó tu solicitud" opens that profile, fresh rather than as the cache last saw it', async () => {
      renderPage();
      await screen.findByText('Olga accepted your follow request');
      // What the cache held while the request was pending: olga locked, a feed without her.
      const FEED = queryKeys.feed({ difficulty: '', time: '', sort: '' });
      client.setQueryData(queryKeys.profile('olga'), {
        visibility: 'private',
        followState: 'requested',
      });
      client.setQueryData(queryKeys.profile('vera'), { visibility: 'public' });
      client.setQueryData(FEED, { pages: [], pageParams: [] });

      fireEvent.click(screen.getByText('Olga accepted your follow request'));

      await waitFor(() => expect(mockPush).toHaveBeenCalledWith('/profile/olga'));
      // Dropped, not merely stale: a stale entry would still paint the lock first.
      expect(client.getQueryData(queryKeys.profile('olga'))).toBeUndefined();
      expect(client.getQueryState(FEED)?.isInvalidated).toBe(true);
      // The reader follows one more account.
      expect(client.getQueryState(queryKeys.profile('vera'))?.isInvalidated).toBe(true);
    });

    it('a follow opens the follower’s profile and forgets nothing', async () => {
      renderPage();
      await screen.findByText('Bruno started following you');
      client.setQueryData(queryKeys.profile('bruno'), { visibility: 'public' });

      fireEvent.click(screen.getByText('Bruno started following you'));

      await waitFor(() => expect(mockPush).toHaveBeenCalledWith('/profile/bruno'));
      expect(client.getQueryData(queryKeys.profile('bruno'))).toBeDefined();
    });

    it('a like opens its recipe', async () => {
      renderPage();
      fireEvent.click(await screen.findByText('carla liked your recipe'));

      await waitFor(() => expect(mockPush).toHaveBeenCalledWith('/recipe/r1'));
      // Already read: nothing to mark.
      expect(mockFetch).not.toHaveBeenCalledWith('/api/notifications/n4', expect.anything());
    });
  });

  describe('the pinned requests row', () => {
    it('sits above the list whenever requests are waiting, and opens the inbox', async () => {
      pages = [page(EVERY_TYPE, 3)];
      renderPage();

      expect(await screen.findByText('Follow requests')).toBeInTheDocument();
      expect(screen.getByText('3 pending requests')).toBeInTheDocument();

      fireEvent.click(screen.getByText('Follow requests'));
      expect(mockPush).toHaveBeenCalledWith('/notifications/requests');
    });

    it('says "1 pending request" for one', async () => {
      pages = [page(EVERY_TYPE, 1)];
      renderPage();

      expect(await screen.findByText('1 pending request')).toBeInTheDocument();
    });

    it('is absent when nobody is waiting, or the answer does not say', async () => {
      pages = [page(EVERY_TYPE, 0)];
      const { unmount } = renderPage();
      await screen.findByText('Bruno started following you');
      expect(screen.queryByText('Follow requests')).not.toBeInTheDocument();
      unmount();

      pages = [page(EVERY_TYPE)];
      renderPage();
      await screen.findByText('Bruno started following you');
      expect(screen.queryByText('Follow requests')).not.toBeInTheDocument();
    });

    it('stands alone when there are no notifications, without "no notifications yet" under it', async () => {
      pages = [page([], 2)];
      renderPage();

      expect(await screen.findByText('2 pending requests')).toBeInTheDocument();
      expect(screen.queryByText('No notifications yet')).not.toBeInTheDocument();
    });
  });

  describe('the rest of the page', () => {
    it('says so when there is nothing at all', async () => {
      pages = [page([], 0)];
      renderPage();

      expect(await screen.findByText('No notifications yet')).toBeInTheDocument();
    });

    it('says a failed read failed, and tries again on "Retry"', async () => {
      pages = [fail(500), page(EVERY_TYPE)];
      renderPage();

      expect(await screen.findByText('We could not load your notifications')).toBeInTheDocument();
      expect(screen.queryByText('No notifications yet')).not.toBeInTheDocument();

      fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
      expect(await screen.findByText('Bruno started following you')).toBeInTheDocument();
    });

    it('marks everything read', async () => {
      renderPage();
      fireEvent.click(await screen.findByRole('button', { name: 'Mark all as read' }));

      await waitFor(() =>
        expect(screen.queryByRole('button', { name: 'Mark all as read' })).not.toBeInTheDocument()
      );
      expect(mockFetch).toHaveBeenCalledWith(
        '/api/notifications',
        expect.objectContaining({ method: 'POST' })
      );
    });

    it('"Load More" asks for the next page and keeps what is shown', async () => {
      const full = Array.from({ length: 20 }, (_, i) =>
        notification(`p${i}`, 'like', sender(`user${i}`), { postId: `r${i}`, isRead: true })
      );
      pages = [page(full), page([notification('last', 'follow', sender('zoe', 'Zoe'))])];
      renderPage();
      await screen.findByText('user0 liked your recipe');

      fireEvent.click(screen.getByRole('button', { name: 'Load More' }));

      expect(await screen.findByText('Zoe started following you')).toBeInTheDocument();
      expect(screen.getByText('user0 liked your recipe')).toBeInTheDocument();
      expect(mockFetch).toHaveBeenCalledWith('/api/notifications?limit=20&offset=20');
    });
  });
});
