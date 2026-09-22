import { QueryClientProvider, type QueryClient } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import React from 'react';
import { testQueryClient } from '@/__tests__/helpers/queryClient';
import { ToastProvider } from '@/contexts/ToastContext';
import { queryKeys } from '@/lib/query/keys';
import FollowersPage from '../[username]/followers/page';
import FollowingPage from '../[username]/following/page';

/**
 * The followers and following lists: what each row's button does, what a private account's
 * list shows to someone it refuses, and — on your own followers list — "Remove".
 *
 * The two pages are twins that share no code, so everything they both do runs against
 * both. People.i18n.test.tsx covers the same screens' Spanish copy.
 */

type Auth = {
  isAuthenticated: boolean;
  isLoading: boolean;
  user: { id: string; username: string } | null;
};
const signedInAs = (username: string): Auth => ({
  isAuthenticated: true,
  isLoading: false,
  user: { id: `id-${username}`, username },
});

let mockAuth: Auth = signedInAs('vera');
jest.mock('@/contexts/AuthContext', () => ({
  useAuth: () => mockAuth,
}));

/** Whose list the page is showing: /profile/{it}/followers. */
let mockListOwner = 'ana';
jest.mock('next/navigation', () => ({
  useParams: () => ({ username: mockListOwner }),
  useRouter: () => ({ push: jest.fn(), back: jest.fn() }),
}));

type FollowState = 'none' | 'requested' | 'following';

const person = (username: string, isPrivate: boolean, followState: FollowState) => ({
  id: `id-${username}`,
  username,
  fullName: null,
  avatar: null,
  bio: null,
  isPrivate,
  followState,
  isFollowing: followState === 'following',
});

type Answer = { ok: boolean; status: number; json: () => Promise<unknown> };
const ok = (body: unknown): Answer => ({ ok: true, status: 200, json: async () => body });
const refused = (status: number, body: unknown): Answer => ({
  ok: false,
  status,
  json: async () => body,
});
/** fetch itself throwing: the network, not the server. */
const offline = () => Promise.reject(new TypeError('Failed to fetch'));

/** An answer the test hands over when it chooses to. */
function later() {
  let answer: (value: Answer) => void = () => {};
  const promise = new Promise<Answer>((resolve) => {
    answer = resolve;
  });
  return { promise, answer, reply: () => promise };
}

type Reply = Answer | (() => Promise<Answer>);

let mockFetch: jest.Mock;

/** Every GET answers `list`; each POST takes the next of `posts`, in order. */
function serve(list: Reply, posts: Reply[] = []) {
  const queue = [...posts];
  const reply = (r: Reply) => (typeof r === 'function' ? r() : Promise.resolve(r));
  mockFetch.mockImplementation((url: string, init?: RequestInit) => {
    if (init?.method === 'POST') {
      const next = queue.shift();
      if (!next) return Promise.reject(new Error(`Unexpected POST ${url}`));
      return reply(next);
    }
    return reply(list);
  });
}

/** Every POST sent, in order, as [path after /api/users/, headers]. */
const posts = () =>
  mockFetch.mock.calls
    .filter(([, init]) => (init as RequestInit | undefined)?.method === 'POST')
    .map(([url, init]) => [
      String(url).replace('/api/users/', ''),
      (init as RequestInit).headers as Record<string, string>,
    ]);

const FEED = queryKeys.feed({ difficulty: '', time: '', sort: '' });

/** A client holding something from every cache a follow can make wrong. */
function seededClient() {
  const client = testQueryClient();
  client.setQueryData(FEED, { pages: [], pageParams: [] });
  client.setQueryData(queryKeys.recipe('r1'), { recipe: { id: 'r1' } });
  return client;
}

const cachedProfile = (username: string, isPrivate: boolean, followState: FollowState) => ({
  visibility: 'public',
  user: { id: `id-${username}`, username, isPrivate },
  stats: { recipesCount: 1, followersCount: 7, followingCount: 2 },
  recipes: [],
  savedRecipes: [],
  followState,
});

/** The view a private account shows someone who does not follow it: no recipes at all. */
const lockedProfile = (username: string, followState: FollowState) => ({
  visibility: 'private',
  user: { id: `id-${username}`, username, isPrivate: true },
  stats: { recipesCount: 1, followersCount: 7, followingCount: 2 },
  followState,
});

const stale = (client: QueryClient, key: readonly unknown[]) =>
  client.getQueryState(key)?.isInvalidated;

function renderPage(Page: React.ComponentType, client: QueryClient = testQueryClient()) {
  render(
    <QueryClientProvider client={client}>
      <ToastProvider>
        <Page />
      </ToastProvider>
    </QueryClientProvider>
  );
  return client;
}

/** The row of the person whose @handle is shown, as a scope for its buttons. */
const row = (username: string) => {
  const handle = screen.getByText(`@${username}`);
  const item = handle.closest('li');
  if (!item) throw new Error(`No row for ${username}`);
  return within(item);
};

/** A button on a person's row, once the row is there and the button says `name`. */
const findButton = (username: string, name: string) =>
  waitFor(() => row(username).getByRole('button', { name }));

const PAGES = [
  {
    name: 'followers',
    Page: FollowersPage,
    listOf: (people: unknown[]) => ok({ followers: people, total: people.length }),
    title: 'Followers',
    loadFailed: 'Failed to load followers',
    signInPrompt: 'Sign in to view followers',
  },
  {
    name: 'following',
    Page: FollowingPage,
    listOf: (people: unknown[]) => ok({ following: people, total: people.length }),
    title: 'Following',
    loadFailed: 'Failed to load following',
    signInPrompt: 'Sign in to view following',
  },
] as const;

beforeEach(() => {
  mockFetch = global.fetch as jest.Mock;
  mockFetch.mockReset();
  mockAuth = signedInAs('vera');
  mockListOwner = 'ana';
});

describe.each(PAGES)('the $name page', ({ Page, listOf, title, loadFailed, signInPrompt }) => {
  describe('before the list', () => {
    it('shows sized skeleton rows while the session is still being checked, and fetches nothing', () => {
      mockAuth = { isAuthenticated: false, isLoading: true, user: null };

      renderPage(Page);

      expect(screen.getByRole('status', { name: 'Loading...' })).toBeInTheDocument();
      expect(screen.queryByText(signInPrompt)).not.toBeInTheDocument();
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('asks a visitor who arrives signed out to sign in, instead of waiting forever for a list it never fetches', () => {
      mockAuth = { isAuthenticated: false, isLoading: false, user: null };

      renderPage(Page);

      expect(screen.getByText(signInPrompt)).toBeInTheDocument();
      expect(screen.getByRole('link', { name: 'Sign In' })).toHaveAttribute('href', '/auth');
      expect(screen.queryByRole('status')).not.toBeInTheDocument();
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('shows the title over skeleton rows while the list loads, then the rows', async () => {
      const pending = later();
      serve(pending.reply);

      renderPage(Page);

      expect(screen.getByRole('heading', { name: title })).toBeInTheDocument();
      expect(screen.getByRole('status', { name: 'Loading...' })).toBeInTheDocument();

      pending.answer(listOf([person('bruno', false, 'none')]));

      expect(await screen.findByText('@bruno')).toBeInTheDocument();
      expect(screen.queryByRole('status')).not.toBeInTheDocument();
    });
  });

  describe('each row', () => {
    it('shows where the viewer stands, and no button on their own row', async () => {
      serve(
        listOf([
          person('bruno', false, 'none'),
          person('clara', false, 'following'),
          person('dani', true, 'requested'),
          person('vera', false, 'none'),
        ])
      );

      renderPage(Page);

      await screen.findByText('@bruno');
      expect(row('bruno').getByRole('button', { name: 'Follow' })).toBeInTheDocument();
      expect(row('clara').getByRole('button', { name: 'Following' })).toBeInTheDocument();
      expect(row('dani').getByRole('button', { name: 'Requested' })).toBeInTheDocument();
      expect(row('vera').queryByRole('button')).not.toBeInTheDocument();
    });

    it('links the name to the profile, so the keyboard can reach it', async () => {
      serve(listOf([person('bruno', false, 'none')]));

      renderPage(Page);

      expect(await screen.findByRole('link', { name: 'bruno' })).toHaveAttribute(
        'href',
        '/profile/bruno'
      );
    });

    it('a private row paints "Requested" at once, then keeps the server’s word', async () => {
      const pending = later();
      serve(listOf([person('eva', true, 'none')]), [pending.reply]);
      const client = seededClient();
      client.setQueryData(queryKeys.profile('eva'), cachedProfile('eva', true, 'none'));

      renderPage(Page, client);
      fireEvent.click(await findButton('eva', 'Follow'));

      // Before the server has said anything: its answer is still held back.
      expect(await findButton('eva', 'Requested')).toBeInTheDocument();
      await waitFor(() =>
        expect(posts()).toEqual([['eva/follow', { 'X-Requested-With': 'fetch' }]])
      );

      pending.answer(ok({ success: true, state: 'requested', followersCount: 7 }));

      // The profile opened next from this row already says so: a request moves no count,
      // so nothing else would have told it.
      await waitFor(() =>
        expect(
          (client.getQueryData(queryKeys.profile('eva')) as { followState: string }).followState
        ).toBe('requested')
      );
      expect(row('eva').getByRole('button', { name: 'Requested' })).toBeInTheDocument();
      // A request grants nothing: the recipe caches are untouched.
      expect(stale(client, FEED)).toBe(false);
      expect(client.getQueryData(queryKeys.recipe('r1'))).toBeDefined();
    });

    it('a request the server answers "following" shows "Following", and forgets the lists built without access', async () => {
      // The account went public since the list loaded.
      serve(listOf([person('eva', true, 'none')]), [
        ok({ success: true, state: 'following', followersCount: 8 }),
      ]);
      const client = seededClient();

      renderPage(Page, client);
      fireEvent.click(await findButton('eva', 'Follow'));

      expect(await findButton('eva', 'Following')).toBeInTheDocument();
      expect(stale(client, FEED)).toBe(true);
    });

    it('a public row that answers "requested" went private: from then on its "Follow" asks', async () => {
      serve(listOf([person('bruno', false, 'none')]), [
        ok({ success: true, state: 'requested', followersCount: 3 }),
        ok({ success: true, state: 'none', was: 'requested', followersCount: 3 }),
        later().reply,
      ]);

      renderPage(Page);
      fireEvent.click(await findButton('bruno', 'Follow'));
      expect(await findButton('bruno', 'Requested')).toBeInTheDocument();

      // Taking the request back asks nothing: it loses nothing.
      fireEvent.click(row('bruno').getByRole('button', { name: 'Requested' }));
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      expect(await findButton('bruno', 'Follow')).toBeInTheDocument();

      fireEvent.click(row('bruno').getByRole('button', { name: 'Follow' }));
      expect(await findButton('bruno', 'Requested')).toBeInTheDocument();
      await waitFor(() =>
        expect(posts().map(([path]) => path)).toEqual([
          'bruno/follow',
          'bruno/unfollow',
          'bruno/follow',
        ])
      );
    });

    it('unfollowing a private row asks first, and sends nothing when the reader backs out', async () => {
      serve(listOf([person('fede', true, 'following')]), [
        ok({ success: true, state: 'none', was: 'following', followersCount: 4 }),
      ]);

      renderPage(Page);
      fireEvent.click(await findButton('fede', 'Following'));

      const dialog = screen.getByRole('dialog', { name: 'Unfollow fede?' });
      fireEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }));
      await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
      expect(posts()).toEqual([]);
      expect(row('fede').getByRole('button', { name: 'Following' })).toBeInTheDocument();

      fireEvent.click(row('fede').getByRole('button', { name: 'Following' }));
      fireEvent.click(
        within(screen.getByRole('dialog', { name: 'Unfollow fede?' })).getByRole('button', {
          name: 'Unfollow',
        })
      );

      expect(await findButton('fede', 'Follow')).toBeInTheDocument();
      expect(posts().map(([path]) => path)).toEqual(['fede/unfollow']);
    });

    it('unfollowing a public row does not ask', async () => {
      serve(listOf([person('clara', false, 'following')]), [
        ok({ success: true, state: 'none', was: 'following', followersCount: 4 }),
      ]);

      renderPage(Page);
      fireEvent.click(await findButton('clara', 'Following'));

      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      expect(await findButton('clara', 'Follow')).toBeInTheDocument();
    });

    it('unfollowing a private account forgets its recipes here exactly as the profile does', async () => {
      serve(listOf([person('fede', true, 'following')]), [
        ok({ success: true, state: 'none', was: 'following', followersCount: 4 }),
      ]);
      const client = seededClient();
      client.setQueryData(queryKeys.profile('fede'), cachedProfile('fede', true, 'following'));
      client.setQueryData(queryKeys.profile('vera'), cachedProfile('vera', false, null as never));

      renderPage(Page, client);
      fireEvent.click(await findButton('fede', 'Following'));
      fireEvent.click(
        within(screen.getByRole('dialog', { name: 'Unfollow fede?' })).getByRole('button', {
          name: 'Unfollow',
        })
      );

      await waitFor(() => expect(client.getQueryData(queryKeys.recipe('r1'))).toBeUndefined());
      expect(stale(client, FEED)).toBe(true);
      // The viewer's own "following". Theirs goes further: see the next test.
      expect(stale(client, queryKeys.profile('vera'))).toBe(true);
    });

    it('unfollowing a private account drops its cached profile, recipes and all, instead of settling it', async () => {
      serve(listOf([person('fede', true, 'following')]), [
        ok({ success: true, state: 'none', was: 'following', followersCount: 4 }),
      ]);
      const client = seededClient();
      // The full view a follower gets: the recipes are in it.
      client.setQueryData(queryKeys.profile('fede'), {
        ...cachedProfile('fede', true, 'following'),
        recipes: [{ id: 'r1' }],
      });

      renderPage(Page, client);
      fireEvent.click(await findButton('fede', 'Following'));
      fireEvent.click(
        within(screen.getByRole('dialog', { name: 'Unfollow fede?' })).getByRole('button', {
          name: 'Unfollow',
        })
      );

      expect(await findButton('fede', 'Follow')).toBeInTheDocument();
      // Settled to "none", the entry would open the next visit on those recipes under
      // "Follow", until its refetch put the lock back. Gone, the visit loads and meets it.
      await waitFor(() => expect(client.getQueryData(queryKeys.profile('fede'))).toBeUndefined());
    });

    it('a request answered "following" drops the locked profile it had cached, instead of settling "Following" onto the lock', async () => {
      // The account went public since the list loaded.
      serve(listOf([person('eva', true, 'none')]), [
        ok({ success: true, state: 'following', followersCount: 8 }),
      ]);
      const client = seededClient();
      client.setQueryData(queryKeys.profile('eva'), lockedProfile('eva', 'none'));

      renderPage(Page, client);
      fireEvent.click(await findButton('eva', 'Follow'));

      expect(await findButton('eva', 'Following')).toBeInTheDocument();
      await waitFor(() => expect(client.getQueryData(queryKeys.profile('eva'))).toBeUndefined());
    });

    it('following a public account only dates the two counts it moved', async () => {
      serve(listOf([person('bruno', false, 'none')]), [
        ok({ success: true, state: 'following', followersCount: 8 }),
      ]);
      const client = seededClient();
      client.setQueryData(queryKeys.profile('bruno'), cachedProfile('bruno', false, 'none'));

      renderPage(Page, client);
      fireEvent.click(await findButton('bruno', 'Follow'));

      await waitFor(() => expect(stale(client, queryKeys.profile('bruno'))).toBe(true));
      expect(
        (client.getQueryData(queryKeys.profile('bruno')) as { stats: { followersCount: number } })
          .stats.followersCount
      ).toBe(8);
      expect(stale(client, FEED)).toBe(false);
      expect(client.getQueryData(queryKeys.recipe('r1'))).toBeDefined();
    });

    it('a refused request goes back to "Follow" and says what failed', async () => {
      serve(listOf([person('eva', true, 'none')]), [refused(500, { code: 'user.followFailed' })]);

      renderPage(Page);
      fireEvent.click(await findButton('eva', 'Follow'));

      expect(await screen.findByText('Failed to send the follow request')).toBeInTheDocument();
      expect(row('eva').getByRole('button', { name: 'Follow' })).toBeInTheDocument();
    });

    it('a cancel that never left keeps "Requested" and says the request is still pending', async () => {
      serve(listOf([person('dani', true, 'requested')]), [offline]);

      renderPage(Page);
      fireEvent.click(await findButton('dani', 'Requested'));

      expect(
        await screen.findByText('No connection — your request is still pending')
      ).toBeInTheDocument();
      expect(row('dani').getByRole('button', { name: 'Requested' })).toBeInTheDocument();
    });

    it('rapid taps reach the server one at a time, and only the last answer paints', async () => {
      const first = later();
      const second = later();
      serve(listOf([person('bruno', false, 'none')]), [first.reply, second.reply]);

      renderPage(Page);
      fireEvent.click(await findButton('bruno', 'Follow'));
      fireEvent.click(await findButton('bruno', 'Following'));

      // The second tap painted at once, but its request waits for the first.
      expect(await findButton('bruno', 'Follow')).toBeInTheDocument();
      await waitFor(() => expect(posts()).toHaveLength(1));

      first.answer(ok({ success: true, state: 'following', followersCount: 8 }));
      await waitFor(() => expect(posts()).toHaveLength(2));
      // The first answer does not flash "Following" back over the reader's second tap.
      expect(row('bruno').getByRole('button', { name: 'Follow' })).toBeInTheDocument();

      second.answer(ok({ success: true, state: 'none', was: 'following', followersCount: 7 }));
      await waitFor(() =>
        expect(posts().map(([path]) => path)).toEqual(['bruno/follow', 'bruno/unfollow'])
      );
      expect(row('bruno').getByRole('button', { name: 'Follow' })).toBeInTheDocument();
    });
  });

  describe('a list the viewer may not see', () => {
    it('shows the lock and the way to the profile, not a failure and not a call to follow', async () => {
      serve(refused(403, { error: 'This profile is private', code: 'user.profilePrivate' }));

      renderPage(Page);

      expect(await screen.findByText('This profile is private')).toBeInTheDocument();
      expect(screen.getByRole('link', { name: 'View their profile' })).toHaveAttribute(
        'href',
        '/profile/ana'
      );
      expect(screen.getByRole('heading', { name: title })).toBeInTheDocument();
      expect(screen.queryByText(loadFailed)).not.toBeInTheDocument();
      expect(
        screen.queryByText('Follow this account to see their recipes.')
      ).not.toBeInTheDocument();
    });

    it('treats any other refusal as a failed load', async () => {
      serve(refused(403, { error: 'Forbidden', code: 'auth.forbidden' }));

      renderPage(Page);

      expect(await screen.findByText(loadFailed)).toBeInTheDocument();
      expect(screen.queryByText('This profile is private')).not.toBeInTheDocument();
    });
  });

  it('a failed load can be tried again', async () => {
    serve(offline);

    renderPage(Page);
    const retry = await screen.findByRole('button', { name: 'Retry' });
    serve(listOf([person('bruno', false, 'none')]));
    fireEvent.click(retry);

    expect(await screen.findByText('@bruno')).toBeInTheDocument();
    expect(screen.queryByText(loadFailed)).not.toBeInTheDocument();
  });
});

describe('"Remove" on your own followers list', () => {
  const followers = () =>
    ok({
      followers: [person('bruno', false, 'none'), person('clara', false, 'following')],
      total: 2,
    });

  beforeEach(() => {
    mockAuth = signedInAs('ana');
    mockListOwner = 'ana';
  });

  const removeDialog = (name: string) =>
    screen.getByRole('dialog', { name: `Remove ${name} from your followers?` });

  it('is offered on every row of your own list, and nowhere else', async () => {
    serve(followers());

    renderPage(FollowersPage);

    await screen.findByText('@bruno');
    expect(row('bruno').getByRole('button', { name: 'Remove' })).toBeInTheDocument();
    expect(row('clara').getByRole('button', { name: 'Remove' })).toBeInTheDocument();
  });

  it('is not offered on someone else’s followers list', async () => {
    mockAuth = signedInAs('vera');
    serve(followers());

    renderPage(FollowersPage);

    await screen.findByText('@bruno');
    expect(screen.queryByRole('button', { name: 'Remove' })).not.toBeInTheDocument();
  });

  it('is not offered on your own following list', async () => {
    serve(ok({ following: [person('bruno', false, 'following')], total: 1 }));

    renderPage(FollowingPage);

    await screen.findByText('@bruno');
    expect(screen.queryByRole('button', { name: 'Remove' })).not.toBeInTheDocument();
  });

  it('asks first, and sends nothing when you back out', async () => {
    serve(followers());

    renderPage(FollowersPage);
    fireEvent.click(await findButton('bruno', 'Remove'));

    const dialog = removeDialog('bruno');
    expect(
      within(dialog).getByText(
        "We won't tell them. If your account is private, they will stop seeing your recipes."
      )
    ).toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }));

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(screen.getByText('@bruno')).toBeInTheDocument();
    expect(posts()).toEqual([]);
  });

  it('takes the row away at once, and it stays away when the server agrees', async () => {
    const pending = later();
    serve(followers(), [pending.reply]);
    const client = testQueryClient();
    client.setQueryData(queryKeys.profile('ana'), cachedProfile('ana', true, null as never));

    renderPage(FollowersPage, client);
    fireEvent.click(await findButton('bruno', 'Remove'));
    fireEvent.click(within(removeDialog('bruno')).getByRole('button', { name: 'Remove' }));

    // Before the server has answered: its answer is still held back.
    await waitFor(() => expect(screen.queryByText('@bruno')).not.toBeInTheDocument());
    expect(screen.getByText('@clara')).toBeInTheDocument();
    await waitFor(() =>
      expect(posts()).toEqual([['bruno/remove-follower', { 'X-Requested-With': 'fetch' }]])
    );

    pending.answer(ok({ success: true, removed: true, followersCount: 1 }));

    // The owner's followers count is out of date now.
    await waitFor(() => expect(stale(client, queryKeys.profile('ana'))).toBe(true));
    expect(screen.queryByText('@bruno')).not.toBeInTheDocument();
    expect(screen.queryByText('We could not remove this follower')).not.toBeInTheDocument();
  });

  it.each<[string, Reply, string]>([
    // The route's catch-all says no more than the page's own sentence does.
    [
      'the server’s catch-all refuses',
      refused(500, { error: 'Failed to remove follower', code: 'user.removeFollowerFailed' }),
      'We could not remove this follower',
    ],
    // The middleware's 429 carries no code: its English `error` would reach a Spanish
    // reader untranslated, so the page's own sentence stands in.
    [
      'the rate limit refuses without a code, as the middleware does',
      refused(429, { error: 'Too many requests', retryAfter: 30 }),
      'We could not remove this follower',
    ],
    // A specific code speaks for itself.
    [
      'the session has expired',
      refused(401, { error: 'Unauthorized', code: 'unauthorized' }),
      'You need to log in to do that.',
    ],
    [
      'the rate limit refuses with its code',
      refused(429, { error: 'Too many requests', code: 'rateLimited' }),
      'Too many attempts. Wait a moment and try again.',
    ],
    // Nothing was refused: the request never reached the server.
    ['the request never leaves', offline, 'No connection — they are still your follower'],
  ])('puts the row back where it was, and says why, when %s', async (_case, reply, message) => {
    serve(followers(), [reply]);

    renderPage(FollowersPage);
    fireEvent.click(await findButton('bruno', 'Remove'));
    fireEvent.click(within(removeDialog('bruno')).getByRole('button', { name: 'Remove' }));

    expect(await screen.findByText(message)).toBeInTheDocument();
    const handles = screen.getAllByText(/^@/).map((node) => node.textContent);
    expect(handles).toEqual(['@bruno', '@clara']);
  });

  it('keeps the row away when the follower’s account no longer exists', async () => {
    serve(followers(), [refused(404, { error: 'User not found', code: 'user.notFound' })]);
    const client = testQueryClient();
    client.setQueryData(queryKeys.profile('ana'), cachedProfile('ana', true, null as never));

    renderPage(FollowersPage, client);
    fireEvent.click(await findButton('bruno', 'Remove'));
    fireEvent.click(within(removeDialog('bruno')).getByRole('button', { name: 'Remove' }));

    // Settled as a removal: the owner's count is out of date, as after any other.
    await waitFor(() => expect(stale(client, queryKeys.profile('ana'))).toBe(true));
    expect(screen.queryByText('@bruno')).not.toBeInTheDocument();
    expect(screen.queryByText('We could not remove this follower')).not.toBeInTheDocument();
  });
});
