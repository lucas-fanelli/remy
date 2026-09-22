import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import React from 'react';
import { ToastProvider } from '@/contexts/ToastContext';
import { queryKeys } from '@/lib/query/keys';
import { useLike, useSave } from '../useViewerMutation';

/**
 * What the shared toggle does beyond painting: the lists whose membership a write changes.
 *
 * Painting is covered where it is seen (each screen's own suite). This is the part no
 * screen can see — a Saved tab that is not on screen when the save happens.
 */

let mockReader: { id: string; username: string } | null = { id: 'u1', username: 'ana' };
jest.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({ user: mockReader, isAuthenticated: mockReader !== null }),
}));

const viewer = { liked: false, saved: false, timesCooked: 0, lastCookedAt: null, myRating: null };

function setup() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  // A recipe you can see somewhere — a search — and your own profile, cached and fresh.
  client.setQueryData(queryKeys.search('x'), {
    users: [],
    recipes: [{ id: 'r1', likeCount: 0, viewer }],
  });
  client.setQueryData(queryKeys.profile('ana'), {
    visibility: 'public',
    user: { id: 'u1', username: 'ana' },
    stats: { recipesCount: 0, followersCount: 0, followingCount: 0 },
    recipes: [],
    savedRecipes: [],
    isFollowing: null,
  });

  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={client}>
      <ToastProvider>{children}</ToastProvider>
    </QueryClientProvider>
  );
  return { client, wrapper };
}

describe('a save, beyond the bookmark', () => {
  let mockFetch: jest.Mock;

  beforeEach(() => {
    mockFetch = global.fetch as jest.Mock;
    mockFetch.mockReset();
    mockReader = { id: 'u1', username: 'ana' };
  });

  it('marks your own profile out of date once the server has it, so the Saved tab gains it', async () => {
    // A patch cannot add a recipe to a tab that does not hold it. Saving from the feed
    // left your Saved tab without it for as long as the cache stayed fresh.
    mockFetch.mockResolvedValue({ ok: true, json: async () => ({ saved: true }) });
    const { client, wrapper } = setup();
    const { result } = renderHook(() => useSave(), { wrapper });

    act(() => result.current.toggle('r1'));

    await waitFor(() =>
      expect(client.getQueryState(queryKeys.profile('ana'))?.isInvalidated).toBe(true)
    );
  });

  it('does not refetch it on the spot', async () => {
    // A refetch right after a write handed back the pre-click answer once, and the heart
    // visibly undid itself. Stale is enough: the next visit refetches.
    mockFetch.mockResolvedValue({ ok: true, json: async () => ({ saved: true }) });
    const { client, wrapper } = setup();
    const { result } = renderHook(() => useSave(), { wrapper });

    act(() => result.current.toggle('r1'));
    await waitFor(() =>
      expect(client.getQueryState(queryKeys.profile('ana'))?.isInvalidated).toBe(true)
    );

    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it('leaves your profile alone when the save failed', async () => {
    mockFetch.mockResolvedValue({ ok: false, status: 500, json: async () => ({}) });
    const { client, wrapper } = setup();
    const { result } = renderHook(() => useSave(), { wrapper });

    act(() => result.current.toggle('r1'));
    await waitFor(() => expect(mockFetch).toHaveBeenCalledTimes(1));
    await act(async () => {});

    expect(client.getQueryState(queryKeys.profile('ana'))?.isInvalidated).toBe(false);
  });

  it('leaves it alone for a like, which changes no list membership', async () => {
    mockFetch.mockResolvedValue({ ok: true, json: async () => ({ liked: true, likeCount: 1 }) });
    const { client, wrapper } = setup();
    const { result } = renderHook(() => useLike(), { wrapper });

    act(() => result.current.toggle('r1'));
    await waitFor(() => expect(mockFetch).toHaveBeenCalledTimes(1));
    await act(async () => {});

    expect(client.getQueryState(queryKeys.profile('ana'))?.isInvalidated).toBe(false);
  });
});
