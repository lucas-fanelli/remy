'use client';
import {
  useInfiniteQuery,
  useMutation,
  useMutationState,
  useQueryClient,
  type InfiniteData,
  type QueryClient,
} from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { useCallback, useEffect, useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import { readBody } from '@/lib/api/readBody';
import { useApiErrorMessage } from '@/lib/api/translateApiError';
import { afterFollowChange } from '@/lib/follows/client/followAction';
import { queryKeys } from '@/lib/query/keys';
import { requestNotificationsRefresh } from './useNotificationPolling';

/**
 * The owner's side of a follow request, on the client: the inbox where each one is accepted
 * or declined, and what opening "X aceptó tu solicitud" must forget on the other side.
 *
 * The inbox reads the requests table (GET /api/follow-requests), never the notifications. A
 * notification is only the doorbell: it can be marked read, deleted, or pushed past the
 * dropdown's ten rows, and none of that answers anyone.
 */

/** Where the inbox lives — the target of the pinned row and of every "quiere seguirte". */
export const FOLLOW_REQUESTS_PATH = '/notifications/requests';

/** The route's own default. Twenty avatars is a screen and a half on a phone. */
const PAGE_SIZE = 20;

export interface FollowRequester {
  id: string;
  username: string;
  fullName: string | null;
  avatar: string | null;
}

export interface FollowRequest {
  requester: FollowRequester;
  /** When the request was made (ISO), which is also the inbox's order: newest first. */
  createdAt: string;
}

interface InboxPage {
  requests: FollowRequest[];
  /** Every request still pending, not only this page's: what decides "Cargar más". */
  total: number;
  /**
   * How many rows the server sent for this page. `requests` shrinks as rows are answered;
   * this does not, so an emptied page is not mistaken for the end of the list.
   */
  received: number;
}

type Inbox = InfiniteData<InboxPage, number>;

export type RequestAnswer = 'accept' | 'decline';

interface AnswerVariables {
  username: string;
  answer: RequestAnswer;
}

/** What `useMutationState` watches to know which rows are being answered right now. */
const ANSWER_KEY = [...queryKeys.followRequests(), 'answer'] as const;

/** One queue for every answer, so the server sees them in the order they were tapped. */
const ANSWER_SCOPE = { id: 'follow-requests' };

/** The routes' catch-alls: they say "it failed" and nothing about which way. */
const ANSWER_FAILURE_CODES: readonly string[] = [
  'followRequest.acceptFailed',
  'followRequest.declineFailed',
];

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

const orNull = (value: unknown): string | null => (typeof value === 'string' ? value : null);

/** One row as the route sends it, or null for anything that is not one. */
function parseRequest(value: unknown): FollowRequest | null {
  if (!isRecord(value) || !isRecord(value.requester)) return null;
  const { id, username, fullName, avatar } = value.requester;
  if (typeof id !== 'string' || typeof username !== 'string') return null;
  return {
    requester: { id, username, fullName: orNull(fullName), avatar: orNull(avatar) },
    createdAt: typeof value.createdAt === 'string' ? value.createdAt : '',
  };
}

async function fetchInboxPage(offset: number, signal: AbortSignal): Promise<InboxPage> {
  const response = await fetch(`/api/follow-requests?limit=${PAGE_SIZE}&offset=${offset}`, {
    signal,
  });
  const body = await readBody(response);
  if (!response.ok) throw new Error(`Follow requests: ${response.status}`);

  // A 200 without its list is a broken answer, not an empty inbox: "no tenés solicitudes"
  // would be a confident claim with nothing behind it.
  if (!isRecord(body) || !Array.isArray(body.requests)) {
    throw new Error('Follow requests: malformed answer');
  }

  const requests = body.requests
    .map(parseRequest)
    .filter((row): row is FollowRequest => row !== null);
  return {
    requests,
    total: typeof body.total === 'number' ? body.total : requests.length,
    received: body.requests.length,
  };
}

/**
 * Every row loaded, in order, each person once. Pages can overlap: offsets move under the
 * list whenever a request arrives or is answered between two pages.
 */
function rowsOf(pages: readonly InboxPage[] | undefined): FollowRequest[] {
  const seen = new Set<string>();
  const rows: FollowRequest[] = [];
  for (const page of pages ?? []) {
    for (const row of page.requests) {
      if (seen.has(row.requester.id)) continue;
      seen.add(row.requester.id);
      rows.push(row);
    }
  }
  return rows;
}

/**
 * The inbox without one person's request, because the server no longer has it.
 *
 * `total` goes down with it, so "Cargar más" keeps comparing like with like: rows loaded
 * against requests left. Leaving it would have offered "Cargar más" under a list that was
 * already complete, as many times as rows had been answered.
 */
function withoutRequest(inbox: Inbox | undefined, username: string): Inbox | undefined {
  if (!inbox) return inbox;
  if (!rowsOf(inbox.pages).some((row) => row.requester.username === username)) return inbox;
  return {
    ...inbox,
    pages: inbox.pages.map((page) => ({
      ...page,
      requests: page.requests.filter((row) => row.requester.username !== username),
      total: Math.max(0, page.total - 1),
    })),
  };
}

/** Why an answer did not go through. */
class AnswerError extends Error {
  constructor(
    /**
     * - offline: the request never reached the server; nothing was decided.
     * - gone: 404, nothing left to answer — the requester took it back, it was already
     *   answered in another tab, going public accepted it, or the account is gone.
     * - refused: the server said no, with a body that may say why.
     */
    readonly kind: 'offline' | 'gone' | 'refused',
    readonly body: unknown
  ) {
    super(`Follow request answer: ${kind}`);
    this.name = 'AnswerError';
  }
}

async function sendAnswer({ username, answer }: AnswerVariables): Promise<void> {
  let response: Response;
  try {
    response = await fetch(`/api/follow-requests/${encodeURIComponent(username)}/${answer}`, {
      method: 'POST',
      // The middleware refuses a write without it (CSRF).
      headers: { 'X-Requested-With': 'fetch' },
    });
  } catch {
    throw new AnswerError('offline', null);
  }

  const body = await readBody(response);
  // Every 404 means the same thing to the owner, whichever code it carries: there is no
  // request to answer any more. followRequest.notFound and user.notFound alike.
  if (response.status === 404) throw new AnswerError('gone', body);
  if (!response.ok) throw new AnswerError('refused', body);
}

/**
 * The signed-in owner's follow requests, and the two answers.
 *
 * The same instant-paint contract as a follow: a tap on "Aceptar" or "Rechazar" takes the
 * row away at once, before the server has answered.
 *
 * - The server agrees: the row stays gone. Accepting added a follower, so the owner's own
 *   profile is stale (and the requester's, whose "siguiendo" grew).
 * - 404, nothing left to answer: the row stays gone too, since there is nothing to bring
 *   back, and an info toast says so ("Esta solicitud ya no está"). It is not an error: the
 *   owner's list was simply older than the server's.
 * - Anything else: the row comes back where it was, and a toast says why — "sin conexión"
 *   told apart from a refusal, as everywhere else.
 *
 * How a row is "taken away": it is HIDDEN while its answer is pending, and removed from the
 * cache only once the server confirms. The cache keeps saying what the server has. That is
 * what makes a failure trivial — the row reappears in its own place, with nothing to
 * re-insert — and what keeps "Cargar más" honest: its offset is the rows the server still
 * holds ahead of the next page, and a request being answered is still one of them.
 *
 * When the last answer of a burst settles, the inbox refetches and the navigation is asked
 * to refresh its badge and its pinned count (see NOTIFICATIONS_REFRESH_EVENT). Once per
 * burst, not per tap: every earlier answer would only have been corrected by the next one.
 * The refetch also settles any page read while an answer was still on its way.
 */
export function useFollowRequests() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { showError, showInfo } = useToast();
  const apiErrorMessage = useApiErrorMessage();
  const t = useTranslations('notifications');
  const inboxKey = queryKeys.followRequestInbox(user?.id ?? '');

  const {
    data,
    isError,
    isFetching,
    refetch,
    hasNextPage,
    isFetchingNextPage,
    isFetchNextPageError,
    fetchNextPage,
  } = useInfiniteQuery({
    queryKey: inboxKey,
    queryFn: ({ pageParam, signal }) => fetchInboxPage(pageParam, signal),
    initialPageParam: 0,
    // "Cargar más" asks for the rows after the ones loaded, counted now rather than at the
    // last fetch: an answered row has left the server's list as well as this one, and the
    // offset moves back with it. A page the server sent empty ends the list whatever `total`
    // says, so a count that disagrees with the rows cannot keep asking for the same page.
    getNextPageParam: (lastPage, pages) => {
      if (lastPage.received === 0) return undefined;
      const loaded = rowsOf(pages).length;
      return loaded < lastPage.total ? loaded : undefined;
    },
    enabled: Boolean(user),
    // Always checked on arrival. The owner comes here to decide who sees their recipes,
    // and a request answered elsewhere since (another tab, going public) would only come
    // back as "ya no está".
    staleTime: 0,
  });

  /** The rows whose answer is on its way: hidden until the server has spoken. */
  const answering = useMutationState({
    filters: { mutationKey: ANSWER_KEY, status: 'pending' },
    select: (mutation) => (mutation.state.variables as AnswerVariables | undefined)?.username,
  });

  const requests = useMemo(() => {
    if (!data) return undefined;
    const hidden = new Set(answering);
    return rowsOf(data.pages).filter((row) => !hidden.has(row.requester.username));
  }, [data, answering]);

  const loadMore = useCallback(async () => {
    const result = await fetchNextPage();
    // The rows already on screen stay: a failed "Cargar más" is a toast, not an error
    // page that throws away what the owner was reading.
    if (result.isFetchNextPageError) showError(t('requests.loadFailed'));
  }, [fetchNextPage, showError, t]);

  /**
   * The server no longer has this request: neither may the cache. A read already on its way
   * was sent before the answer and still lists it, and landing after this write it would
   * bring the row back, answered, so it is cancelled first. That holds for "Cargar más" too:
   * a next page lands on top of the pages it started from, the answered row among them.
   *
   * What a cancelled refetch would have fetched, the refetch at the end of the burst fetches.
   * Not a cancelled "Cargar más": that refetch re-reads only the pages already in the cache,
   * so the page the owner asked for would never come. It is asked for again, counted from
   * the rows the server now holds, and waited for, so that the refetch finds it among the
   * pages instead of cancelling it in turn.
   */
  const forget = async (username: string) => {
    const read = queryClient.getQueryState(inboxKey);
    const loadingMore =
      read !== undefined &&
      read.fetchStatus !== 'idle' &&
      read.fetchMeta?.fetchMore?.direction === 'forward';
    await queryClient.cancelQueries({ queryKey: inboxKey });
    queryClient.setQueryData<Inbox>(inboxKey, (inbox) => withoutRequest(inbox, username));
    if (loadingMore) await loadMore();
  };

  const { mutate } = useMutation({
    mutationKey: ANSWER_KEY,
    scope: ANSWER_SCOPE,
    mutationFn: sendAnswer,

    onSuccess: async (_result, { username, answer }) => {
      await forget(username);
      if (answer === 'accept' && user) {
        // One more follower on the owner's profile, one more "siguiendo" on theirs. Neither
        // is on screen, so marked stale for the next visit rather than fetched now.
        void queryClient.invalidateQueries({ queryKey: queryKeys.profile(user.username) });
        void queryClient.invalidateQueries({ queryKey: queryKeys.profile(username) });
      }
    },

    onError: async (error, { username, answer }) => {
      const kind = error instanceof AnswerError ? error.kind : 'refused';
      const body = error instanceof AnswerError ? error.body : null;

      if (kind === 'gone') {
        await forget(username);
        showInfo(t('requests.gone'));
        return;
      }

      // The row reappears on its own once this answer stops being pending; what is left is
      // saying why.
      const failed = t('requests.actionFailed', { action: answer });
      const code = isRecord(body) ? body.code : undefined;
      showError(
        kind === 'offline'
          ? t('requests.actionOffline')
          : // The catch-all cannot say which way it failed; this can. A specific code — an
            // expired session, the rate limit — still speaks for itself.
            typeof code !== 'string' || ANSWER_FAILURE_CODES.includes(code)
            ? failed
            : apiErrorMessage(body, failed)
      );
    },

    onSettled: () => {
      // Still counted as pending here, so 1 means this was the last answer in the queue.
      if (queryClient.isMutating({ mutationKey: ANSWER_KEY }) > 1) return;
      void queryClient.invalidateQueries({ queryKey: inboxKey });
      requestNotificationsRefresh();
    },
  });

  const answerRequest = useCallback(
    (username: string, answer: RequestAnswer) => mutate({ username, answer }),
    [mutate]
  );

  // Every row on screen was answered, but the server has more: fetch them rather than say
  // "no tenés solicitudes pendientes" over a list that is not finished. Not while any read
  // is already on its way (the refetch after a burst may bring them anyway), and not after
  // a failed page, which would ask again on every render; "Cargar más" is there for that.
  const exhausted = requests !== undefined && requests.length === 0;
  useEffect(() => {
    if (exhausted && hasNextPage && !isFetching && !isFetchNextPageError) void loadMore();
  }, [exhausted, hasNextPage, isFetching, isFetchNextPageError, loadMore]);

  return {
    /** The rows to show, newest first; undefined until the first page has arrived. */
    requests,
    /** The first page failed, so there is nothing to show but the failure. */
    loadFailed: isError && !data,
    retry: useCallback(() => void refetch(), [refetch]),
    hasMore: Boolean(hasNextPage),
    loadingMore: isFetchingNextPage,
    loadMore,
    /** Accept or decline one request. Fire and forget: paint, rollback and toast are here. */
    answer: answerRequest,
  };
}

/**
 * "X aceptó tu solicitud" was opened: the reader follows X now, and is about to see X's
 * profile.
 *
 * Everything cached about X was built while the request was pending — a locked profile
 * saying "Solicitado", recipe lists without X's recipes — and the 60-second staleTime would
 * have painted it. So the cache is told what a follow the reader made themselves would tell
 * it (afterFollowChange: access gained, every recipe list stale, the reader's own
 * "siguiendo" stale), and one thing more: X's profile is dropped, not only marked stale. A
 * stale entry is still painted on the next visit, so the page would have opened on the lock
 * and "Solicitado", then jumped to the recipes when its refetch landed. Dropped, it opens on
 * the skeleton, then the truth.
 *
 * Harmless when the notification is old news — the reader unfollowed since, or X went
 * public: every step only makes the cache ask the server again.
 */
export function afterRequestAccepted(
  queryClient: QueryClient,
  owner: string,
  viewer: string | null | undefined
): void {
  afterFollowChange(queryClient, {
    username: owner,
    isPrivate: true,
    before: 'requested',
    result: { state: 'following', was: null, followersCount: null },
    viewer,
  });
  void queryClient.resetQueries({ queryKey: queryKeys.profile(owner) });
}
