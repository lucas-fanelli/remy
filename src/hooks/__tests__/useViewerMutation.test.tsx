import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import React from 'react';
import { ToastProvider } from '@/contexts/ToastContext';
import { queryKeys } from '@/lib/query/keys';
import { sendWaitingDelete } from '@/lib/undo/deferredDeletes';
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

describe('unsaving, which waits out its Undo', () => {
  // Lucas: removing something from Guardadas should offer "Deshacer". The removal paints at
  // once and is sent when the toast's Undo has gone unanswered.
  let mockFetch: jest.Mock;

  beforeEach(() => {
    mockFetch = global.fetch as jest.Mock;
    mockFetch.mockReset();
    mockReader = { id: 'u1', username: 'ana' };
  });

  const savedViewer = { ...viewer, saved: true };
  const saveCalls = () =>
    mockFetch.mock.calls.map(([, init]) => JSON.parse((init as RequestInit).body as string));
  const bookmark = (client: QueryClient) =>
    client.getQueryData<{ recipes: { viewer: { saved: boolean } }[] }>(queryKeys.search('x'))
      ?.recipes[0].viewer.saved;

  function setupSaved() {
    const harness = setup();
    harness.client.setQueryData(queryKeys.search('x'), {
      users: [],
      recipes: [{ id: 'r1', likeCount: 0, viewer: savedViewer }],
    });
    const { result } = renderHook(() => useSave(), { wrapper: harness.wrapper });
    return { ...harness, toggle: (next?: boolean) => result.current.toggle('r1', next) };
  }

  it('empties the bookmark at once and sends the removal only after the window', async () => {
    mockFetch.mockResolvedValue({ ok: true, json: async () => ({ saved: false }) });
    const { client, toggle } = setupSaved();

    act(() => toggle());

    expect(bookmark(client)).toBe(false);
    expect(mockFetch).not.toHaveBeenCalled();

    await act(async () => sendWaitingDelete());

    expect(saveCalls()).toEqual([{ saved: false }]);
    expect(bookmark(client)).toBe(false);
  });

  it('takes the removal back, sending nothing, when the bookmark is tapped again in time', async () => {
    // The server was never told, so there is nothing to tell it now.
    const { client, toggle } = setupSaved();

    act(() => toggle());
    act(() => toggle());
    await act(async () => sendWaitingDelete());

    expect(bookmark(client)).toBe(true);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('ignores a second removal of the same recipe while the first waits', async () => {
    mockFetch.mockResolvedValue({ ok: true, json: async () => ({ saved: false }) });
    const { toggle } = setupSaved();

    act(() => toggle(false));
    act(() => toggle(false));
    await act(async () => sendWaitingDelete());

    expect(saveCalls()).toEqual([{ saved: false }]);
  });

  it('sends a save made while the removal is on its way only after the removal is answered', async () => {
    // Sent at once, it would race the removal and could land first: the server would end up
    // unsaved while the screen said saved.
    let answerRemoval: () => void = () => {};
    mockFetch.mockImplementation((_url: string, init: RequestInit) =>
      JSON.parse(init.body as string).saved === false
        ? new Promise((resolve) => {
            answerRemoval = () => resolve({ ok: true, json: async () => ({ saved: false }) });
          })
        : Promise.resolve({ ok: true, json: async () => ({ saved: true }) })
    );
    const { client, toggle } = setupSaved();

    act(() => toggle());
    await act(async () => sendWaitingDelete());
    act(() => toggle(true));

    expect(bookmark(client)).toBe(true);
    expect(saveCalls()).toEqual([{ saved: false }]);

    await act(async () => answerRemoval());

    await waitFor(() => expect(saveCalls()).toEqual([{ saved: false }, { saved: true }]));
    await waitFor(() => expect(bookmark(client)).toBe(true));
  });

  it('leaves a like to go at once: unliking is not a deletion', async () => {
    mockFetch.mockReturnValue(new Promise(() => {}));
    const { client, wrapper } = setup();
    client.setQueryData(queryKeys.search('x'), {
      users: [],
      recipes: [{ id: 'r1', likeCount: 1, viewer: { ...viewer, liked: true } }],
    });
    const { result } = renderHook(() => useLike(), { wrapper });

    act(() => result.current.toggle('r1'));

    // Sent without anyone letting an Undo window pass.
    await waitFor(() => expect(mockFetch).toHaveBeenCalledTimes(1));
  });
});
