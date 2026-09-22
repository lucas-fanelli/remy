'use client';

import { ArrowBack } from '@mui/icons-material';
import {
  Alert,
  Avatar,
  Box,
  Button,
  IconButton,
  List,
  ListItem,
  Paper,
  Skeleton,
  Typography,
} from '@mui/material';
import NextLink from 'next/link';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useEffect } from 'react';
import PageFrame from '@/components/layout/PageFrame';
import { useAuth } from '@/contexts/AuthContext';
import {
  useFollowRequests,
  type FollowRequest,
  type RequestAnswer,
} from '@/hooks/useFollowRequests';
import { cloudinaryImage } from '@/lib/utils/cloudinary';

/** Avatar and gap, so the buttons can line up under the name on a phone. */
const AVATAR = 48;
const GAP = 12;

/**
 * Where the rows will be, sized like them: an avatar, two lines, two buttons. The header is
 * real text from the start — it is known before anything loads.
 */
function RequestsSkeleton({ label }: { label: string }) {
  return (
    <Paper role="status" aria-label={label}>
      {Array.from({ length: 3 }, (_, i) => (
        <Box
          key={i}
          sx={{
            display: 'flex',
            flexDirection: { xs: 'column', sm: 'row' },
            alignItems: { xs: 'stretch', sm: 'center' },
            gap: { xs: 1, sm: 2 },
            px: 2,
            py: 1.5,
            borderBottom: i < 2 ? 1 : 0,
            borderColor: 'divider',
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: `${GAP}px`, flex: 1 }}>
            <Skeleton variant="circular" width={AVATAR} height={AVATAR} />
            <Box sx={{ flex: 1 }}>
              <Skeleton variant="text" width="40%" />
              <Skeleton variant="text" width="25%" />
            </Box>
          </Box>
          <Box sx={{ display: 'flex', gap: 1, pl: { xs: `${AVATAR + GAP}px`, sm: 0 } }}>
            <Skeleton
              variant="rounded"
              height={30}
              sx={{ flex: { xs: 1, sm: 'none' }, width: { sm: 84 } }}
            />
            <Skeleton
              variant="rounded"
              height={30}
              sx={{ flex: { xs: 1, sm: 'none' }, width: { sm: 92 } }}
            />
          </Box>
        </Box>
      ))}
    </Paper>
  );
}

interface RequestRowProps {
  request: FollowRequest;
  divider: boolean;
  onAnswer: (username: string, answer: RequestAnswer) => void;
}

/**
 * One request: who is asking (a link to their profile) and the two answers.
 *
 * The link and the buttons are siblings, never nested: a button inside a link would be
 * announced as part of it, and its tap would open the profile too.
 */
function RequestRow({ request, divider, onAnswer }: RequestRowProps) {
  const t = useTranslations('notifications');
  const { username, fullName, avatar } = request.requester;
  // Each row's buttons say "Aceptar" and "Rechazar", like every other row's. The name, as
  // their description, is what tells a screen reader whose request each one answers —
  // without changing the name the reader sees and says out loud.
  const nameId = `follow-request-${request.requester.id}`;

  return (
    <ListItem
      divider={divider}
      sx={{
        display: 'flex',
        // A phone cannot fit an avatar, a name and two buttons on one line without
        // squeezing the name to nothing, so the buttons go underneath there.
        flexDirection: { xs: 'column', sm: 'row' },
        alignItems: { xs: 'stretch', sm: 'center' },
        gap: { xs: 1, sm: 2 },
        py: 1.5,
      }}
    >
      <Box
        component={NextLink}
        href={`/profile/${username}`}
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: `${GAP}px`,
          flex: 1,
          minWidth: 0,
          color: 'inherit',
          textDecoration: 'none',
          borderRadius: 1,
          '&:hover .request-username': { textDecoration: 'underline' },
          '&:focus-visible': { outline: 2, outlineColor: 'primary.main', outlineOffset: 2 },
        }}
      >
        {/* The name beside it already says who this is; alt text would say it twice. */}
        <Avatar
          src={cloudinaryImage(avatar, 'avatar') || undefined}
          alt=""
          sx={{ width: AVATAR, height: AVATAR }}
        >
          {username.charAt(0).toUpperCase()}
        </Avatar>
        <Box sx={{ minWidth: 0 }}>
          <Typography
            id={nameId}
            className="request-username"
            variant="body1"
            sx={{ fontWeight: 600 }}
            noWrap
          >
            {username}
          </Typography>
          {fullName && (
            <Typography variant="body2" color="text.secondary" noWrap>
              {fullName}
            </Typography>
          )}
        </Box>
      </Box>

      <Box
        sx={{
          display: 'flex',
          gap: 1,
          flexShrink: 0,
          pl: { xs: `${AVATAR + GAP}px`, sm: 0 },
          '& > .MuiButton-root': { flex: { xs: 1, sm: 'none' } },
        }}
      >
        <Button
          variant="contained"
          size="small"
          aria-describedby={nameId}
          onClick={() => onAnswer(username, 'accept')}
        >
          {t('requests.accept')}
        </Button>
        <Button
          variant="outlined"
          size="small"
          aria-describedby={nameId}
          onClick={() => onAnswer(username, 'decline')}
        >
          {t('requests.decline')}
        </Button>
      </Box>
    </ListItem>
  );
}

/**
 * /notifications/requests — the owner's pending follow requests, each accepted or declined.
 *
 * Reached from the pinned "Solicitudes de seguimiento" row and from every "quiere seguirte".
 * It reads the requests table, not the notifications, so a request whose notification was
 * read, deleted, or pushed out of the dropdown is still here to answer.
 *
 * What happens to a row after a tap — gone at once, back with a toast if the server says
 * no — is useFollowRequests'. This page only lays it out.
 */
export default function FollowRequestsPage() {
  const t = useTranslations('notifications');
  const tCommon = useTranslations('common');
  const router = useRouter();
  const { user, isLoading } = useAuth();
  const { requests, loadFailed, retry, hasMore, loadingMore, loadMore, answer } =
    useFollowRequests();

  useEffect(() => {
    if (!isLoading && !user) router.push('/auth');
  }, [isLoading, user, router]);

  const header = (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 3 }}>
      <IconButton onClick={() => router.back()} edge="start" aria-label={tCommon('actions.back')}>
        <ArrowBack />
      </IconButton>
      <Typography variant="h5" component="h1" sx={{ fontWeight: 600 }}>
        {t('requests.title')}
      </Typography>
    </Box>
  );

  const renderBody = () => {
    // Signed out too: the redirect is on its way, and "no tenés solicitudes" on the way out
    // would be a claim about an inbox nobody read.
    if (!user) return <RequestsSkeleton label={tCommon('status.loading')} />;

    // The first page failed. Not "no tenés solicitudes": nothing was read.
    if (loadFailed) {
      return (
        <Alert
          severity="error"
          action={
            <Button color="inherit" size="small" onClick={retry}>
              {tCommon('actions.retry')}
            </Button>
          }
        >
          {t('requests.loadFailed')}
        </Alert>
      );
    }

    if (requests === undefined) return <RequestsSkeleton label={tCommon('status.loading')} />;

    // Only when there is nothing further to fetch either. Rows answered down to none with
    // more on the server is a list the hook is still loading, not an empty inbox.
    if (requests.length === 0 && !hasMore) {
      return (
        <Paper sx={{ p: 4, textAlign: 'center' }}>
          <Typography variant="body1" color="text.secondary">
            {t('requests.empty')}
          </Typography>
        </Paper>
      );
    }

    return (
      <Paper>
        {requests.length > 0 && (
          <List disablePadding>
            {requests.map((request, index) => (
              <RequestRow
                key={request.requester.id}
                request={request}
                divider={index < requests.length - 1 || hasMore}
                onAnswer={answer}
              />
            ))}
          </List>
        )}
        {hasMore && (
          <Box sx={{ p: 2, textAlign: 'center' }}>
            <Button variant="text" onClick={() => void loadMore()} disabled={loadingMore}>
              {loadingMore ? tCommon('status.loading') : t('loadMore')}
            </Button>
          </Box>
        )}
      </Paper>
    );
  };

  return (
    <PageFrame width="reading">
      {header}
      {renderBody()}
    </PageFrame>
  );
}
