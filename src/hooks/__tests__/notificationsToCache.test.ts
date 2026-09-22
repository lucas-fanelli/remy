import { testQueryClient } from '@/__tests__/helpers/queryClient';
import { queryKeys } from '@/lib/query/keys';
import { applyNotificationsToCache, type NotificationNews } from '../notificationsToCache';
import type { QueryClient } from '@tanstack/react-query';

/**
 * What each notification changes on screen, for the account that receives it ('vera').
 * Arriving through the bell, it used to change nothing until a reload.
 */

const FEED = queryKeys.feed({ difficulty: '', time: '', sort: '' });

function cacheWithEverything() {
  const client = testQueryClient();
  client.setQueryData(queryKeys.profile('ana'), { visibility: 'private' });
  client.setQueryData(queryKeys.profile('vera'), { visibility: 'public' });
  client.setQueryData(queryKeys.recipe('r1'), { recipe: { id: 'r1' } });
  client.setQueryData(queryKeys.recipe('r2'), { recipe: { id: 'r2' } });
  client.setQueryData(queryKeys.followRequestInbox('v1'), { pages: [], pageParams: [] });
  client.setQueryData(FEED, { pages: [], pageParams: [] });
  return client;
}

const stale = (client: QueryClient, key: readonly unknown[]) =>
  client.getQueryState(key)?.isInvalidated ?? 'gone';

const news = (type: NotificationNews['type'], postId: string | null = null): NotificationNews => ({
  type,
  sender: { username: 'ana' },
  postId,
});

describe('applyNotificationsToCache', () => {
  it('unlocks the profile of an owner who accepted, and lets their recipes into the lists', () => {
    const client = cacheWithEverything();

    applyNotificationsToCache(client, [news('follow_accepted')], 'vera');

    // Read afresh rather than shown locked: the same as tapping the notification.
    expect(client.getQueryData(queryKeys.profile('ana'))).toBeUndefined();
    expect(stale(client, FEED)).toBe(true);
    expect(stale(client, queryKeys.recipe('r1'))).toBe(false);
  });

  it('refreshes the inbox when a request arrives', () => {
    const client = cacheWithEverything();

    applyNotificationsToCache(client, [news('follow_request')], 'vera');

    expect(stale(client, queryKeys.followRequestInbox('v1'))).toBe(true);
    expect(stale(client, queryKeys.profile('ana'))).toBe(false);
  });

  it("refreshes the reader's own profile when someone follows them", () => {
    const client = cacheWithEverything();

    applyNotificationsToCache(client, [news('follow')], 'vera');

    expect(stale(client, queryKeys.profile('vera'))).toBe(true);
    expect(stale(client, queryKeys.profile('ana'))).toBe(false);
    expect(stale(client, FEED)).toBe(false);
  });

  it.each(['like', 'comment', 'rating'] as const)(
    'refreshes the recipe a %s was about, and the profile that lists it',
    (type) => {
      const client = cacheWithEverything();

      applyNotificationsToCache(client, [news(type, 'r1')], 'vera');

      expect(stale(client, queryKeys.recipe('r1'))).toBe(true);
      expect(stale(client, queryKeys.recipe('r2'))).toBe(false);
      expect(stale(client, queryKeys.profile('vera'))).toBe(true);
    }
  );

  it('touches nothing of the reader when nobody is signed in', () => {
    const client = cacheWithEverything();

    applyNotificationsToCache(client, [news('follow'), news('like', 'r1')], null);

    expect(stale(client, queryKeys.profile('vera'))).toBe(false);
    expect(stale(client, queryKeys.recipe('r1'))).toBe(true);
  });
});
