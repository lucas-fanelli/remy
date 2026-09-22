import { ThemeProvider, createTheme } from '@mui/material/styles';
import { QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { testQueryClient } from '@/__tests__/helpers/queryClient';
import { ToastProvider } from '@/contexts/ToastContext';
import { NOTIFICATIONS_REFRESH_EVENT } from '@/hooks/useNotificationPolling';
import { queryKeys } from '@/lib/query/keys';
import FollowRequestsPage from '../requests/page';
import '@testing-library/jest-dom';
import type { QueryClient } from '@tanstack/react-query';

/**
 * The follow-request inbox, as the owner uses it: who is asking, and "Aceptar" or
 * "Rechazar" on each — the row gone at once, back with a reason if the server says no.
 *
 * The routes are faked by a tiny in-memory server (`server` below) rather than one canned
 * answer per call, so a test can say "the owner accepted ana" and the next page read agrees,
 * the way the real table would.
 */

const mockPush = jest.fn();
// One object, like the real router, which the page's redirect effect depends on.
const mockRouter = { push: mockPush, back: jest.fn() };
jest.mock('next/navigation', () => ({
  useRouter: () => mockRouter,
}));

let mockUser: { id: string; username: string } | null = { id: 'owner-id', username: 'olga' };
let mockAuthLoading = false;
jest.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({ user: mockUser, isLoading: mockAuthLoading, isAuthenticated: !!mockUser }),
}));

interface Row {
  requester: { id: string; username: string; fullName: string | null; avatar: string | null };
  createdAt: string;
}

/** Newest first, as the route orders them: `minutesAgo` grows down the list. */
const row = (username: string, minutesAgo: number, fullName: string | null = null): Row => ({
  requester: { id: `id-${username}`, username, fullName, avatar: null },
  createdAt: new Date(Date.UTC(2026, 8, 22, 12) - minutesAgo * 60_000).toISOString(),
});

type Answer = { ok: boolean; status: number; json: () => Promise<unknown> };
const ok = (body: unknown): Answer => ({ ok: true, status: 200, json: async () => body });
const fail = (status: number, body: unknown = {}): Answer => ({
  ok: false,
  status,
  json: async () => body,
});

/** An answer the test hands over when it chooses to: the moment between a tap and its reply. */
function later() {
  let answer: (value: Answer) => void = () => {};
  let drop: () => void = () => {};
  const promise = new Promise<Answer>((resolve, reject) => {
    answer = resolve;
    drop = () => reject(new TypeError('Failed to fetch'));
  });
  return { promise, answer, drop };
}

/** What the requests table holds right now. */
let server: Row[] = [];

/** The table's side of an accept or decline that went through. */
const answered = (username: string): Answer => {
  server = server.filter((r) => r.requester.username !== username);
  return ok({ success: true, pendingCount: server.length });
};

/** How the fake answers a POST; by default, it goes through. */
let answerWith: (username: string, action: string) => Answer | Promise<Answer> = answered;
/** How the fake answers a read; by default, with the table. */
let readWith: (offset: number, limit: number) => Answer | Promise<Answer> = (offset, limit) =>
  ok({ requests: server.slice(offset, offset + limit), total: server.length });

let mockFetch: jest.Mock;

/** Every inbox read, as its offset. */
const reads = () =>
  mockFetch.mock.calls
    .map(([url]) => new URL(String(url), 'http://x'))
    .filter((url) => url.pathname === '/api/follow-requests')
    .map((url) => Number(url.searchParams.get('offset')));

/** Every answer sent, as "username/action". */
const answersSent = () =>
  mockFetch.mock.calls
    .filter(([, init]) => (init as RequestInit | undefined)?.method === 'POST')
    .map(([url]) => String(url).replace('/api/follow-requests/', ''));

/** The rows on screen, top to bottom, as the profile each one links to. */
const rowsShown = () =>
  screen.queryAllByRole('link').map((link) => link.getAttribute('href')?.replace('/profile/', ''));

/** A row's button, found the way a screen reader tells them apart: by whose name it carries. */
const button = (name: 'Accept' | 'Decline', username: string) =>
  screen.getByRole('button', { name, description: username });

let client: QueryClient;

function renderPage() {
  client = testQueryClient();
  // The owner's own profile and the requester's, to see what an accept marks stale.
  client.setQueryData(queryKeys.profile('olga'), { user: { username: 'olga' } });
  client.setQueryData(queryKeys.profile('ana'), { user: { username: 'ana' } });
  return render(
    <QueryClientProvider client={client}>
      <ThemeProvider theme={createTheme()}>
        <ToastProvider>
          <FollowRequestsPage />
        </ToastProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

const stale = (key: readonly unknown[]) => client.getQueryState(key)?.isInvalidated;

describe('/notifications/requests', () => {
  let refreshes: jest.Mock;

  beforeEach(() => {
    mockPush.mockReset();
    mockUser = { id: 'owner-id', username: 'olga' };
    mockAuthLoading = false;
    server = [row('ana', 1, 'Ana López'), row('bruno', 2), row('carla', 3, 'Carla')];
    answerWith = answered;
    readWith = (offset, limit) =>
      ok({ requests: server.slice(offset, offset + limit), total: server.length });

    mockFetch = global.fetch as jest.Mock;
    mockFetch.mockReset();
    mockFetch.mockImplementation(async (input: string, init?: RequestInit) => {
      const url = new URL(input, 'http://x');
      if (url.pathname === '/api/follow-requests') {
        return readWith(
          Number(url.searchParams.get('offset')),
          Number(url.searchParams.get('limit'))
        );
      }
      const answer = url.pathname.match(/^\/api\/follow-requests\/([^/]+)\/(accept|decline)$/);
      if (answer && init?.method === 'POST') return answerWith(answer[1], answer[2]);
      throw new Error(`Unexpected fetch: ${input}`);
    });

    refreshes = jest.fn();
    window.addEventListener(NOTIFICATIONS_REFRESH_EVENT, refreshes);
  });

  afterEach(() => {
    window.removeEventListener(NOTIFICATIONS_REFRESH_EVENT, refreshes);
  });

  describe('what the owner sees', () => {
    it('sends a signed-out reader to /auth, without reading anyone’s inbox', async () => {
      mockUser = null;
      renderPage();

      await waitFor(() => expect(mockPush).toHaveBeenCalledWith('/auth'));
      expect(screen.getByRole('status', { name: 'Loading...' })).toBeInTheDocument();
      expect(reads()).toEqual([]);
    });

    it('waits for the session before deciding anything', () => {
      mockUser = null;
      mockAuthLoading = true;
      renderPage();

      expect(mockPush).not.toHaveBeenCalled();
      expect(screen.getByRole('status', { name: 'Loading...' })).toBeInTheDocument();
    });

    it('holds the rows’ place with a skeleton until the first page arrives', async () => {
      const first = later();
      readWith = () => first.promise;
      renderPage();

      expect(screen.getByRole('heading', { name: 'Follow requests' })).toBeInTheDocument();
      expect(screen.getByRole('status', { name: 'Loading...' })).toBeInTheDocument();

      await act(async () => first.answer(ok({ requests: server, total: 3 })));
      await waitFor(() => expect(screen.queryByRole('status')).not.toBeInTheDocument());
      expect(rowsShown()).toEqual(['ana', 'bruno', 'carla']);
    });

    it('shows who is asking — username, full name, a link to the profile — and the two answers', async () => {
      renderPage();

      const link = await screen.findByRole('link', { name: /ana/ });
      expect(link).toHaveAttribute('href', '/profile/ana');
      expect(link).toHaveTextContent('Ana López');
      expect(button('Accept', 'ana')).toBeInTheDocument();
      expect(button('Decline', 'ana')).toBeInTheDocument();
      // Filled for the yes, outlined for the no.
      expect(button('Accept', 'ana')).toHaveClass('MuiButton-contained');
      expect(button('Decline', 'ana')).toHaveClass('MuiButton-outlined');
      expect(rowsShown()).toEqual(['ana', 'bruno', 'carla']);
    });

    it('says the inbox is empty only when it read an empty one', async () => {
      server = [];
      renderPage();

      expect(await screen.findByText('You have no pending requests')).toBeInTheDocument();
    });

    it('says a failed read failed — not "no requests" — and tries again on "Retry"', async () => {
      readWith = () => fail(500, { code: 'followRequest.listFailed' });
      renderPage();

      expect(await screen.findByText('We could not load your requests')).toBeInTheDocument();
      expect(screen.queryByText('You have no pending requests')).not.toBeInTheDocument();

      readWith = (offset, limit) =>
        ok({ requests: server.slice(offset, offset + limit), total: server.length });
      fireEvent.click(screen.getByRole('button', { name: 'Retry' }));

      await waitFor(() => expect(rowsShown()).toEqual(['ana', 'bruno', 'carla']));
      expect(screen.queryByText('We could not load your requests')).not.toBeInTheDocument();
    });
  });

  describe('answering', () => {
    it('Accept: the row goes at once, before the server has answered', async () => {
      const pending = later();
      answerWith = () => pending.promise;
      renderPage();
      await screen.findByRole('link', { name: /ana/ });

      fireEvent.click(button('Accept', 'ana'));

      await waitFor(() => expect(rowsShown()).toEqual(['bruno', 'carla']));
      expect(answersSent()).toEqual(['ana/accept']);
      const [, init] = mockFetch.mock.calls.find(([, i]) => (i as RequestInit)?.method === 'POST')!;
      expect((init as RequestInit).headers).toEqual({ 'X-Requested-With': 'fetch' });

      await act(async () => pending.answer(answered('ana')));
      expect(rowsShown()).toEqual(['bruno', 'carla']);
    });

    it('Accept, confirmed: the badge is refreshed and both profiles’ counts are stale', async () => {
      renderPage();
      await screen.findByRole('link', { name: /ana/ });
      // The re-read after the answer never lands: what shows is the cache's own word.
      readWith = () => new Promise<Answer>(() => {});

      fireEvent.click(button('Accept', 'ana'));

      await waitFor(() => expect(refreshes).toHaveBeenCalledTimes(1));
      // A follower more for the owner, a "siguiendo" more for ana.
      expect(stale(queryKeys.profile('olga'))).toBe(true);
      expect(stale(queryKeys.profile('ana'))).toBe(true);
      // Confirmed, so no longer hidden but gone, even before the inbox is read again.
      await waitFor(() => expect(client.isMutating()).toBe(0));
      expect(rowsShown()).toEqual(['bruno', 'carla']);
      // And the count went with it: two rows loaded of two left is a complete list.
      expect(screen.queryByRole('button', { name: 'Load More' })).not.toBeInTheDocument();
    });

    it('Decline, confirmed: the row stays gone, and no count is touched', async () => {
      renderPage();
      await screen.findByRole('link', { name: /bruno/ });

      fireEvent.click(button('Decline', 'bruno'));

      await waitFor(() => expect(refreshes).toHaveBeenCalledTimes(1));
      expect(answersSent()).toEqual(['bruno/decline']);
      expect(rowsShown()).toEqual(['ana', 'carla']);
      expect(stale(queryKeys.profile('olga'))).toBeFalsy();
    });

    it('404, nothing left to answer: the row stays gone, and an info toast says so', async () => {
      answerWith = (username) => {
        server = server.filter((r) => r.requester.username !== username);
        return fail(404, { code: 'followRequest.notFound' });
      };
      renderPage();
      await screen.findByRole('link', { name: /bruno/ });
      // The re-read after the answer never lands: what shows is the cache's own word.
      readWith = () => new Promise<Answer>(() => {});

      fireEvent.click(button('Accept', 'bruno'));

      expect(await screen.findByText('This request is no longer there')).toBeInTheDocument();
      expect(screen.queryByText('We could not accept the request')).not.toBeInTheDocument();
      await waitFor(() => expect(refreshes).toHaveBeenCalled());
      await waitFor(() => expect(client.isMutating()).toBe(0));
      expect(rowsShown()).toEqual(['ana', 'carla']);
    });

    it('404 for an account that no longer exists means the same', async () => {
      // Deleting an account deletes its requests with it (the foreign key cascades).
      answerWith = (username) => {
        server = server.filter((r) => r.requester.username !== username);
        return fail(404, { code: 'user.notFound' });
      };
      renderPage();
      await screen.findByRole('link', { name: /bruno/ });

      fireEvent.click(button('Decline', 'bruno'));

      expect(await screen.findByText('This request is no longer there')).toBeInTheDocument();
      expect(rowsShown()).toEqual(['ana', 'carla']);
    });

    it('refused: the row comes back in its own place, and the toast says which answer failed', async () => {
      answerWith = () => fail(500, { code: 'followRequest.acceptFailed' });
      renderPage();
      await screen.findByRole('link', { name: /bruno/ });

      fireEvent.click(button('Accept', 'bruno'));

      expect(await screen.findByText('We could not accept the request')).toBeInTheDocument();
      await waitFor(() => expect(rowsShown()).toEqual(['ana', 'bruno', 'carla']));
      expect(stale(queryKeys.profile('olga'))).toBeFalsy();
    });

    it('refused decline says "decline"', async () => {
      answerWith = () => fail(500, { code: 'followRequest.declineFailed' });
      renderPage();
      await screen.findByRole('link', { name: /carla/ });

      fireEvent.click(button('Decline', 'carla'));

      expect(await screen.findByText('We could not decline the request')).toBeInTheDocument();
      await waitFor(() => expect(rowsShown()).toEqual(['ana', 'bruno', 'carla']));
    });

    it('offline is told apart from a refusal: the request is still pending', async () => {
      const pending = later();
      answerWith = () => pending.promise;
      renderPage();
      await screen.findByRole('link', { name: /ana/ });

      fireEvent.click(button('Accept', 'ana'));
      await waitFor(() => expect(rowsShown()).toEqual(['bruno', 'carla']));
      await act(async () => pending.drop());

      expect(
        await screen.findByText('No connection — the request is still pending')
      ).toBeInTheDocument();
      expect(rowsShown()).toEqual(['ana', 'bruno', 'carla']);
    });

    it('a specific refusal speaks for itself', async () => {
      answerWith = () => fail(401, { error: 'Unauthorized', code: 'unauthorized' });
      renderPage();
      await screen.findByRole('link', { name: /ana/ });

      fireEvent.click(button('Accept', 'ana'));

      expect(await screen.findByText('You need to log in to do that.')).toBeInTheDocument();
      expect(rowsShown()).toEqual(['ana', 'bruno', 'carla']);
    });

    it('rapid answers reach the server one at a time, in tap order, and refresh once', async () => {
      const first = later();
      const queue = [first.promise];
      answerWith = (username) => queue.shift() ?? answered(username);
      renderPage();
      await screen.findByRole('link', { name: /ana/ });

      fireEvent.click(button('Accept', 'ana'));
      fireEvent.click(button('Decline', 'carla'));

      // Both rows go at once; only the first answer has left.
      await waitFor(() => expect(rowsShown()).toEqual(['bruno']));
      expect(answersSent()).toEqual(['ana/accept']);

      await act(async () => first.answer(answered('ana')));

      await waitFor(() => expect(answersSent()).toEqual(['ana/accept', 'carla/decline']));
      // Counted once everything has settled: one refresh and one re-read for the burst.
      await waitFor(() => expect(client.isMutating()).toBe(0));
      await waitFor(() => expect(reads()).toEqual([0, 0]));
      expect(refreshes).toHaveBeenCalledTimes(1);
      expect(rowsShown()).toEqual(['bruno']);
    });

    it('re-reads the inbox once the last answer is in', async () => {
      renderPage();
      await screen.findByRole('link', { name: /ana/ });
      expect(reads()).toEqual([0]);

      fireEvent.click(button('Accept', 'ana'));

      await waitFor(() => expect(reads()).toEqual([0, 0]));
      expect(rowsShown()).toEqual(['bruno', 'carla']);
    });

    it('a read made while an answer is on its way does not bring the row back', async () => {
      const pending = later();
      answerWith = () => pending.promise;
      renderPage();
      await screen.findByRole('link', { name: /ana/ });

      fireEvent.click(button('Accept', 'ana'));
      await waitFor(() => expect(rowsShown()).toEqual(['bruno', 'carla']));

      // The table still has ana: her answer has not arrived.
      await act(async () => {
        await client.refetchQueries({ queryKey: queryKeys.followRequestInbox('owner-id') });
      });
      expect(rowsShown()).toEqual(['bruno', 'carla']);

      await act(async () => pending.answer(answered('ana')));
      await waitFor(() => expect(reads().length).toBe(3));
      expect(rowsShown()).toEqual(['bruno', 'carla']);
    });
  });

  describe('more than one page', () => {
    const many = (count: number) =>
      Array.from({ length: count }, (_, i) => row(`user${String(i).padStart(2, '0')}`, i));

    it('"Load More" asks for the rows after the ones loaded', async () => {
      server = many(23);
      renderPage();
      await screen.findByRole('link', { name: /user00/ });
      expect(rowsShown()).toHaveLength(20);

      fireEvent.click(screen.getByRole('button', { name: 'Load More' }));

      await waitFor(() => expect(rowsShown()).toHaveLength(23));
      expect(reads()).toEqual([0, 20]);
      expect(screen.queryByRole('button', { name: 'Load More' })).not.toBeInTheDocument();
    });

    const everyoneLeft = () => server.map((r) => r.requester.username);

    it('an answer between two pages neither skips anyone nor shows anyone twice', async () => {
      server = many(23);
      renderPage();
      await screen.findByRole('link', { name: /user00/ });

      fireEvent.click(button('Accept', 'user03'));
      await waitFor(() => expect(refreshes).toHaveBeenCalledTimes(1));
      fireEvent.click(screen.getByRole('button', { name: 'Load More' }));

      await waitFor(() => expect(rowsShown()).toEqual(everyoneLeft()));
      expect(rowsShown()).toHaveLength(22);
    });

    it('"Load More" while an answer is on its way continues where the list left off', async () => {
      server = many(23);
      const pending = later();
      answerWith = () => pending.promise;
      renderPage();
      await screen.findByRole('link', { name: /user00/ });

      fireEvent.click(button('Accept', 'user03'));
      await waitFor(() => expect(rowsShown()).toHaveLength(19));
      fireEvent.click(screen.getByRole('button', { name: 'Load More' }));

      // user03 is still in the table, ahead of the next page: the offset counts her.
      await waitFor(() => expect(reads()).toEqual([0, 20]));
      await waitFor(() => expect(rowsShown()).toHaveLength(22));
      expect(rowsShown()).not.toContain('user03');

      await act(async () => pending.answer(answered('user03')));
      await waitFor(() => expect(refreshes).toHaveBeenCalledTimes(1));
      await waitFor(() => expect(rowsShown()).toEqual(everyoneLeft()));
    });

    it('offers no "Load More" once every row is loaded', async () => {
      renderPage();
      await screen.findByRole('link', { name: /ana/ });

      expect(screen.queryByRole('button', { name: 'Load More' })).not.toBeInTheDocument();
    });

    it('a failed "Load More" keeps the rows and says so in a toast', async () => {
      server = many(23);
      renderPage();
      await screen.findByRole('link', { name: /user00/ });

      readWith = () => fail(500);
      fireEvent.click(screen.getByRole('button', { name: 'Load More' }));

      expect(await screen.findByText('We could not load your requests')).toBeInTheDocument();
      expect(rowsShown()).toHaveLength(20);
      // A toast, not the first-page error that replaces the list.
      expect(screen.queryByRole('button', { name: 'Retry' })).not.toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Load More' })).toBeInTheDocument();
    });

    it('answering every row shown fetches the rest instead of claiming the inbox is empty', async () => {
      server = [row('ana', 1), row('bruno', 2), row('carla', 3)];
      // A server whose pages are one row long, so the list has more than it shows.
      const onePage = (offset: number) =>
        ok({ requests: server.slice(offset, offset + 1), total: server.length });
      readWith = onePage;
      const pending = later();
      answerWith = () => pending.promise;
      renderPage();
      await screen.findByRole('link', { name: /ana/ });
      expect(rowsShown()).toEqual(['ana']);
      const nextPage = later();
      readWith = () => nextPage.promise;

      fireEvent.click(button('Accept', 'ana'));

      // ana is hidden while her answer travels, and the page after her is asked for. While
      // it is on its way nothing is on screen, and it is not "no pending requests".
      await waitFor(() => expect(reads()).toEqual([0, 1]));
      expect(rowsShown()).toEqual([]);
      expect(screen.queryByText('You have no pending requests')).not.toBeInTheDocument();

      await act(async () => nextPage.answer(onePage(1)));
      await waitFor(() => expect(rowsShown()).toEqual(['bruno']));
      readWith = onePage;

      // Confirmed, then re-read: both pages, from the table as it is now.
      await act(async () => pending.answer(answered('ana')));
      await waitFor(() => expect(refreshes).toHaveBeenCalledTimes(1));
      await waitFor(() => expect(rowsShown()).toEqual(['bruno', 'carla']));
    });
  });
});
