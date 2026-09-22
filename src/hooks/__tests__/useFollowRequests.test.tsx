import { renderHook, waitFor } from '@testing-library/react';
import { queryWrapper, testQueryClient } from '@/__tests__/helpers/queryClient';
import { queryKeys } from '@/lib/query/keys';
import { afterRequestAccepted, useFollowRequests } from '../useFollowRequests';

/**
 * What only the cache shows of follow requests. The inbox's behaviour on screen is
 * app/notifications/__tests__/followRequestsPage.test.tsx.
 */

let mockUser: { id: string; username: string } | null = { id: 'owner-id', username: 'olga' };
jest.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({ user: mockUser, isAuthenticated: !!mockUser }),
}));

jest.mock('@/contexts/ToastContext', () => ({
  useToast: () => ({ showError: jest.fn(), showInfo: jest.fn() }),
}));

const FEED = queryKeys.feed({ difficulty: '', time: '', sort: '' });

describe('afterRequestAccepted — opening "X aceptó tu solicitud"', () => {
  function cacheBeforeTheAccept() {
    const client = testQueryClient();
    client.setQueryData(queryKeys.profile('ana'), {
      visibility: 'private',
      followState: 'requested',
    });
    client.setQueryData(queryKeys.profile('vera'), { visibility: 'public' });
    client.setQueryData(FEED, { pages: [], pageParams: [] });
    client.setQueryData(queryKeys.recipe('r1'), { recipe: { id: 'r1' } });
    client.setQueryData(queryKeys.profile('someone'), { visibility: 'public' });
    return client;
  }

  it('drops the profile the cache last saw locked, so it cannot paint the lock again', () => {
    const client = cacheBeforeTheAccept();

    afterRequestAccepted(client, 'ana', 'vera');

    expect(client.getQueryData(queryKeys.profile('ana'))).toBeUndefined();
  });

  it('marks every recipe list stale — they were built without ana’s recipes', () => {
    const client = cacheBeforeTheAccept();

    afterRequestAccepted(client, 'ana', 'vera');

    expect(client.getQueryState(FEED)?.isInvalidated).toBe(true);
    // Every profile is a recipe list too.
    expect(client.getQueryState(queryKeys.profile('someone'))?.isInvalidated).toBe(true);
  });

  it('marks the reader’s own profile stale: they follow one more account', () => {
    const client = cacheBeforeTheAccept();

    afterRequestAccepted(client, 'ana', 'vera');

    expect(client.getQueryState(queryKeys.profile('vera'))?.isInvalidated).toBe(true);
  });

  it('keeps the recipe pages: gaining access makes none of them wrong', () => {
    const client = cacheBeforeTheAccept();

    afterRequestAccepted(client, 'ana', 'vera');

    expect(client.getQueryData(queryKeys.recipe('r1'))).toEqual({ recipe: { id: 'r1' } });
  });
});

describe('the inbox cache', () => {
  beforeEach(() => {
    mockUser = { id: 'owner-id', username: 'olga' };
    (global.fetch as jest.Mock).mockReset();
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ requests: [], total: 0 }),
    });
  });

  it('is keyed on its owner, so another account signing in on this tab gets its own', async () => {
    const client = testQueryClient();
    renderHook(() => useFollowRequests(), { wrapper: queryWrapper(client) });

    await waitFor(() =>
      expect(client.getQueryData(queryKeys.followRequestInbox('owner-id'))).toBeDefined()
    );
    expect(client.getQueryData(queryKeys.followRequestInbox('someone-else'))).toBeUndefined();
  });

  it('sits under the root that bulk answers invalidate (going public accepts them all)', async () => {
    const client = testQueryClient();
    renderHook(() => useFollowRequests(), { wrapper: queryWrapper(client) });
    const inbox = queryKeys.followRequestInbox('owner-id');
    await waitFor(() => expect(client.getQueryData(inbox)).toBeDefined());

    await client.invalidateQueries({ queryKey: queryKeys.followRequests(), refetchType: 'none' });

    expect(client.getQueryState(inbox)?.isInvalidated).toBe(true);
  });

  it('is under neither recipe root, so a like or a new recipe does not touch it', async () => {
    const client = testQueryClient();
    renderHook(() => useFollowRequests(), { wrapper: queryWrapper(client) });
    const inbox = queryKeys.followRequestInbox('owner-id');
    await waitFor(() => expect(client.getQueryData(inbox)).toBeDefined());

    await client.invalidateQueries({ queryKey: ['recipes'], refetchType: 'none' });
    await client.invalidateQueries({ queryKey: ['profile'], refetchType: 'none' });

    expect(client.getQueryState(inbox)?.isInvalidated).toBe(false);
  });

  it('reads nothing while signed out', () => {
    mockUser = null;
    renderHook(() => useFollowRequests(), { wrapper: queryWrapper() });

    expect(global.fetch).not.toHaveBeenCalled();
  });
});
