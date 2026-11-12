'use client';

import { ArrowBack, LockOutlined } from '@mui/icons-material';
import {
  Box,
  Typography,
  List,
  ListItem,
  ListItemAvatar,
  Avatar,
  Button,
  Alert,
  IconButton,
  Paper,
  Skeleton,
} from '@mui/material';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import NextLink from 'next/link';
import { useRouter, useParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import PageFrame from '@/components/layout/PageFrame';
import { MotionPaper } from '@/components/motion';
import FollowButton from '@/components/profile/FollowButton';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import { readBody } from '@/lib/api/readBody';
import { useApiErrorMessage } from '@/lib/api/translateApiError';
import {
  FOLLOW_FAILURE_CODES,
  FollowActionError,
  accessChangeOf,
  afterFollowChange,
  followScope,
  guessFollowState,
  isFollowState,
  sendFollowAction,
  type FollowAction,
  type FollowChange,
  type FollowResult,
} from '@/lib/follows/client/followAction';
import { queryKeys } from '@/lib/query/keys';
import { cloudinaryImage } from '@/lib/utils/cloudinary';
import type { FollowState } from '@/domain/types/follow';
import type { Profile } from '@/hooks/useProfile';
import type { QueryClient } from '@tanstack/react-query';

/*
 * The followers page (../followers/page.tsx) is this page's twin, row for row, plus
 * "Eliminar" on the owner's own list. A change to one belongs in both.
 */

/** One person on the list, as the page keeps it. */
interface Person {
  id: string;
  username: string;
  fullName: string | null;
  avatar: string | null;
  bio: string | null;
  /**
   * The account's own privacy, as the route last said. It decides what "Seguir" does — a
   * follow, or a request the owner has to accept — and whether unfollowing asks first.
   */
  isPrivate: boolean;
  /** Where the signed-in viewer stands with this person: the button on the row. */
  followState: FollowState;
}

/** What the route answered, once it has. Until then the page shows skeleton rows. */
type PeopleList =
  | { status: 'ready'; people: Person[] }
  /** 403 user.profilePrivate: the account is private and the viewer does not follow it. */
  | { status: 'private' }
  | { status: 'failed' };

/** A row as the route sends it. Every field is checked before the page trusts it. */
type RawPerson = Partial<Omit<Person, 'followState'>> & {
  followState?: unknown;
  isFollowing?: unknown;
};

const toPerson = (row: RawPerson): Person => ({
  id: String(row.id),
  username: String(row.username),
  fullName: row.fullName ?? null,
  avatar: row.avatar ?? null,
  bio: row.bio ?? null,
  isPrivate: row.isPrivate === true,
  // `isFollowing` is what the route sent before follow requests existed, and still sends
  // for a tab running the old bundle. Read it only when `followState` is missing, the way
  // useProfile does for the profile header, so a row never loses its button.
  followState: isFollowState(row.followState)
    ? row.followState
    : row.isFollowing === true
      ? 'following'
      : 'none',
});

/** The `code` of an error body, whatever else it carries. */
const codeOf = (body: unknown): unknown =>
  typeof body === 'object' && body !== null ? (body as { code?: unknown }).code : undefined;

/**
 * GET the list. Never throws: every way it can end is a state the page draws.
 *
 * A 403 is not a failure to load. The route refuses a private account's list to anyone
 * who does not follow it — whom an account follows is content, like its recipes — and
 * that refusal has its own screen, not "No pudimos cargar".
 */
async function loadFollowing(username: string): Promise<PeopleList> {
  let response: Response;
  try {
    response = await fetch(`/api/users/${encodeURIComponent(username)}/following`);
  } catch {
    return { status: 'failed' };
  }

  const body = await readBody(response);
  if (response.status === 403 && codeOf(body) === 'user.profilePrivate') {
    return { status: 'private' };
  }
  if (!response.ok) return { status: 'failed' };

  const rows = (body as { following?: unknown } | null)?.following;
  if (!Array.isArray(rows)) return { status: 'failed' };
  return { status: 'ready', people: (rows as RawPerson[]).map(toPerson) };
}

/**
 * The server's answer, written into the person's cached profile if there is one — the same
 * two fields the profile header's own follow writes, and nothing else.
 *
 * afterFollowChange marks that profile stale only when the relation moved. A request or a
 * cancel moves nothing, so without this the profile opened next from this row would still
 * say "Seguir" for a request just sent from here.
 *
 * Only for a change that left access where it was. One that moved it drops the profile
 * instead (see useRowFollow's onSuccess): two fields cannot turn a full view into a lock.
 */
function settleCachedProfile(queryClient: QueryClient, username: string, result: FollowResult) {
  queryClient.setQueryData<Profile>(
    queryKeys.profile(username),
    (profile) =>
      profile && {
        ...profile,
        followState: result.state,
        stats:
          result.followersCount === null
            ? profile.stats
            : { ...profile.stats, followersCount: result.followersCount },
      }
  );
}

/**
 * A burst of taps on one row: every tap made while an earlier one is still waiting on the
 * server joins it.
 *
 * The requests run one at a time (`followScope`), but each tap paints at once, so when a
 * request answers, the row may already show a LATER tap's guess. What a failure goes back
 * to is `settled` — the server's last word, or the row as it was before the burst — never
 * "what was painted before this tap", which may be a guess nobody confirmed. The same rule
 * as the profile header (useFollowProfile), kept per row.
 */
interface RowBurst {
  settled: FollowState;
  /** The row's privacy as the burst learned it: a 'requested' answer proves it private. */
  isPrivate: boolean;
  /** Taps still waiting on the server. The last one out paints the result. */
  inFlight: number;
}

/**
 * Follow, request, cancel or unfollow the person on one row — the same contract as the
 * profile header: the button flips at once, the server's answer wins, and a failure puts
 * the row back AND says so, "sin conexión" told apart from a refusal.
 *
 * - A private row paints "Solicitado" at once, then takes whatever the server answered: an
 *   account that went public since the list loaded answers 'following'.
 * - A public row that answers 'requested' went private mid-tap. The row is private from
 *   then on, so its next "Seguir" asks rather than follows.
 * - Every settled answer goes through afterFollowChange, the one the header uses, so an
 *   unfollow of a private account forgets its recipes from here exactly as it does from
 *   there: the feed, search, pantry matches and every cached recipe page.
 */
function useRowFollow(
  person: Person,
  viewer: string | null,
  paint: (username: string, state: FollowState, isPrivate: boolean) => void
) {
  const queryClient = useQueryClient();
  const { showError } = useToast();
  const apiErrorMessage = useApiErrorMessage();
  const t = useTranslations('profile');
  const burstRef = useRef<RowBurst | null>(null);
  const { username } = person;

  const { mutate } = useMutation({
    mutationKey: queryKeys.followMutation(username),
    // The profile header's queue too: a tap here and one there reach the server in order.
    scope: followScope(username),

    mutationFn: (action: FollowAction) => sendFollowAction(username, action),

    onMutate: (action): { burst: RowBurst } => {
      // No burst under way means nothing is waiting on the server, so what the row shows
      // is the server's own word.
      const burst = burstRef.current ?? {
        settled: person.followState,
        isPrivate: person.isPrivate,
        inFlight: 0,
      };
      burstRef.current = burst;
      burst.inFlight += 1;

      paint(username, guessFollowState(action), burst.isPrivate);
      return { burst };
    },

    onSuccess: (result, _action, { burst }) => {
      const change: FollowChange = {
        username,
        isPrivate: burst.isPrivate,
        before: burst.settled,
        result,
        viewer,
      };

      // What afterFollowChange is about to report, asked first, because the settle has to
      // come before it.
      if (accessChangeOf(change) === null) {
        // Before afterFollowChange: writing data marks an entry fresh again, and the stale
        // mark afterFollowChange may put on it has to be the one that stays.
        settleCachedProfile(queryClient, username, result);
      } else {
        // Access moved, so the cached profile is the wrong view, not just an old count: the
        // full one, recipes and all, of an account just unfollowed, or the lock of one just
        // let in. Settled, the next visit would paint it under the new button until its
        // refetch put it right. Dropped, it opens on the skeleton, then the truth — what
        // afterRequestAccepted does for the same flash.
        void queryClient.resetQueries({ queryKey: queryKeys.profile(username) });
      }
      afterFollowChange(queryClient, change);

      burst.settled = result.state;
      if (result.state === 'requested') burst.isPrivate = true;

      // A later tap is still queued: its own answer paints. Painting this one would flash
      // back to a state the reader has already tapped away from.
      if (burst.inFlight === 1) paint(username, burst.settled, burst.isPrivate);
    },

    onError: (error, action, context) => {
      if (!context) return;
      const { burst } = context;

      // A later tap is queued behind this one: it will settle the row, and the reader has
      // already moved on from what this tap asked for.
      if (burst.inFlight > 1) return;

      paint(username, burst.settled, burst.isPrivate);

      // Nothing to report when an earlier tap of the burst already got the reader where
      // this one wanted to go.
      if (burst.settled === guessFollowState(action)) return;

      const failed = t('followFailed', { action });
      const body = error instanceof FollowActionError ? error.body : null;
      const code = codeOf(body);

      showError(
        error instanceof FollowActionError && error.offline
          ? t('followOffline', { action })
          : // The route's catch-all cannot say which way it failed; this can. A specific
            // code — an expired session, an account that no longer exists — still speaks
            // for itself.
            typeof code === 'string' && FOLLOW_FAILURE_CODES.includes(code)
            ? failed
            : apiErrorMessage(body, failed)
      );
    },

    onSettled: (_result, _error, _action, context) => {
      if (!context) return;
      context.burst.inFlight -= 1;
      if (context.burst.inFlight === 0 && burstRef.current === context.burst) {
        burstRef.current = null;
      }
    },
  });

  return mutate;
}

interface PersonRowProps {
  person: Person;
  index: number;
  isLast: boolean;
  /** The signed-in viewer's username. Their own row has no follow button. */
  viewer: string | null;
  onFollowState: (username: string, state: FollowState, isPrivate: boolean) => void;
}

function PersonRow({ person, index, isLast, viewer, onFollowState }: PersonRowProps) {
  const follow = useRowFollow(person, viewer, onFollowState);

  const showFollow = viewer !== null && person.username !== viewer;
  const profileHref = `/profile/${person.username}`;

  return (
    <MotionPaper
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: index * 0.05 }}
      elevation={0}
    >
      <ListItem
        sx={{
          py: 2,
          gap: 1,
          borderBottom: isLast ? 0 : 1,
          borderColor: 'divider',
        }}
      >
        <ListItemAvatar>
          {/* The name next to it is the same link, and the one a keyboard or a screen
              reader reaches; this one is only a bigger target for a finger. */}
          <Avatar
            component={NextLink}
            href={profileHref}
            prefetch={false}
            tabIndex={-1}
            aria-hidden
            src={cloudinaryImage(person.avatar, 'avatar') || undefined}
            sx={{ width: 48, height: 48 }}
          >
            {person.username.charAt(0).toUpperCase()}
          </Avatar>
        </ListItemAvatar>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          {/* A link rather than a click handler on text, so it can be reached and opened
              from the keyboard like any other link. */}
          <Typography
            component={NextLink}
            href={profileHref}
            prefetch={false}
            variant="body1"
            noWrap
            sx={{
              display: 'block',
              fontWeight: 600,
              color: 'text.primary',
              textDecoration: 'none',
              '&:hover': { textDecoration: 'underline' },
            }}
          >
            {person.fullName || person.username}
          </Typography>
          <Typography variant="body2" color="text.secondary" noWrap>
            @{person.username}
          </Typography>
          {person.bio && (
            <Typography
              variant="body2"
              color="text.secondary"
              sx={{
                mt: 0.5,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                display: '-webkit-box',
                WebkitLineClamp: 2,
                WebkitBoxOrient: 'vertical',
              }}
            >
              {person.bio}
            </Typography>
          )}
        </Box>
        {showFollow && (
          <Box sx={{ flexShrink: 0 }}>
            <FollowButton
              state={person.followState}
              isPrivate={person.isPrivate}
              name={person.username}
              onAction={follow}
            />
          </Box>
        )}
      </ListItem>
    </MotionPaper>
  );
}

const SKELETON_ROWS = 6;

/**
 * The list before it arrives, sized like the rows it becomes: avatar, name, handle and a
 * button. It used to render nothing, so the page was blank and then everything arrived at
 * once.
 */
function PeopleSkeleton({ label }: { label: string }) {
  return (
    <Box role="status" aria-label={label} sx={{ bgcolor: 'background.paper', borderRadius: 2 }}>
      {Array.from({ length: SKELETON_ROWS }, (_, index) => (
        <Box
          key={index}
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 1,
            px: 2,
            py: 2,
            borderBottom: index < SKELETON_ROWS - 1 ? 1 : 0,
            borderColor: 'divider',
          }}
        >
          {/* ListItemAvatar's width, so the text starts where a row's does. */}
          <Box sx={{ minWidth: 56 }}>
            <Skeleton variant="circular" width={48} height={48} />
          </Box>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Skeleton variant="text" width="45%" sx={{ fontSize: '1rem' }} />
            <Skeleton variant="text" width="30%" sx={{ fontSize: '0.875rem' }} />
          </Box>
          <Skeleton variant="rounded" width={100} height={31} />
        </Box>
      ))}
    </Box>
  );
}

export default function FollowingPage() {
  const t = useTranslations('profile');
  const tCommon = useTranslations('common');
  const router = useRouter();
  const params = useParams();
  const username = params.username as string;
  const { isAuthenticated, isLoading: authLoading, user: currentUser } = useAuth();

  // Which load the list on screen answers. A new username, or a retry, starts a new one,
  // and until it answers the page shows skeletons rather than the previous answer.
  const [attempt, setAttempt] = useState(0);
  const requestKey = `${username}#${attempt}`;
  const [loaded, setLoaded] = useState<{ key: string; list: PeopleList } | null>(null);
  const list = loaded?.key === requestKey ? loaded.list : null;

  const viewer = currentUser?.username ?? null;

  useEffect(() => {
    // Nothing to fetch without a session: the route answers 401, and the page shows the
    // sign-in prompt instead.
    if (!isAuthenticated) return;

    let current = true;
    void loadFollowing(username).then((next) => {
      // A later load (another username, a retry) owns the screen now.
      if (current) setLoaded({ key: requestKey, list: next });
    });
    return () => {
      current = false;
    };
  }, [username, requestKey, isAuthenticated]);

  const updatePeople = useCallback(
    (update: (people: Person[]) => Person[]) =>
      setLoaded((prev) =>
        prev?.list.status === 'ready'
          ? { ...prev, list: { status: 'ready', people: update(prev.list.people) } }
          : prev
      ),
    []
  );

  const paintFollow = useCallback(
    (target: string, followState: FollowState, isPrivate: boolean) =>
      updatePeople((people) =>
        people.map((person) =>
          person.username === target ? { ...person, followState, isPrivate } : person
        )
      ),
    [updatePeople]
  );

  const people = list?.status === 'ready' ? list.people : [];

  const header = (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3 }}>
      <IconButton onClick={() => router.back()} edge="start" aria-label={tCommon('actions.goBack')}>
        <ArrowBack />
      </IconButton>
      <Typography variant="h5" component="h1" sx={{ fontWeight: 600 }}>
        {t('followingList.title')}
      </Typography>
    </Box>
  );

  const skeleton = (
    <PageFrame width="reading">
      {header}
      <PeopleSkeleton label={tCommon('status.loading')} />
    </PageFrame>
  );

  // The order matters. The session first, then whether there is one, and only then this
  // page's own load: a visitor without a session never fetches, so a check of the load
  // before the sign-in prompt would leave them on skeletons forever.
  if (authLoading) {
    return skeleton;
  }

  if (!isAuthenticated) {
    return (
      <PageFrame width="reading" sx={{ textAlign: 'center' }}>
        <Typography variant="h6" color="text.secondary" sx={{ mb: 2 }}>
          {t('followingList.signInPrompt')}
        </Typography>
        <Button component={NextLink} href="/auth" variant="contained">
          {t('signIn')}
        </Button>
      </PageFrame>
    );
  }

  if (!list) {
    return skeleton;
  }

  if (list.status === 'failed') {
    return (
      <PageFrame width="reading">
        <Alert
          severity="error"
          sx={{ mb: 2 }}
          action={
            <Button color="inherit" size="small" onClick={() => setAttempt((n) => n + 1)}>
              {tCommon('actions.retry')}
            </Button>
          }
        >
          {t('followingList.loadFailed')}
        </Alert>
        <Button onClick={() => router.back()}>{tCommon('actions.goBack')}</Button>
      </PageFrame>
    );
  }

  if (list.status === 'private') {
    // The profile's own lock, without its call to action: this page has no follow button,
    // so "Seguí esta cuenta" would ask for a tap there is nowhere to make. The way in is
    // the profile, where the button is.
    return (
      <PageFrame width="reading">
        {header}
        <Box sx={{ textAlign: 'center', py: 8 }}>
          <LockOutlined sx={{ fontSize: 80, color: 'text.secondary', mb: 2 }} />
          <Typography variant="h6" component="h2" color="text.secondary">
            {t('private.title')}
          </Typography>
          <Button
            component={NextLink}
            href={`/profile/${username}`}
            variant="contained"
            sx={{ mt: 3 }}
          >
            {t('private.viewProfile')}
          </Button>
        </Box>
      </PageFrame>
    );
  }

  return (
    <PageFrame width="reading">
      {header}

      {people.length === 0 ? (
        <Paper sx={{ p: 4, textAlign: 'center' }}>
          <Typography variant="body1" color="text.secondary">
            {t('followingList.empty')}
          </Typography>
        </Paper>
      ) : (
        <List sx={{ bgcolor: 'background.paper', borderRadius: 2 }}>
          {people.map((person, index) => (
            <PersonRow
              key={person.id}
              person={person}
              index={index}
              isLast={index === people.length - 1}
              viewer={viewer}
              onFollowState={paintFollow}
            />
          ))}
        </List>
      )}
    </PageFrame>
  );
}
