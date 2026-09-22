'use client';

import { ArrowBack } from '@mui/icons-material';
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
  Snackbar,
} from '@mui/material';
import NextLink from 'next/link';
import { useRouter, useParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import React, { useEffect, useState } from 'react';
import PageFrame from '@/components/layout/PageFrame';
import { MotionPaper } from '@/components/motion';
import { useAuth } from '@/contexts/AuthContext';
import { cloudinaryImage } from '@/lib/utils/cloudinary';

interface UserListItem {
  id: string;
  username: string;
  fullName: string | null;
  avatar: string | null;
  bio: string | null;
  isFollowing: boolean;
}

export default function FollowersPage() {
  const t = useTranslations('profile');
  const tCommon = useTranslations('common');
  const router = useRouter();
  const params = useParams();
  const username = params.username as string;
  const { isAuthenticated, isLoading: authLoading, user: currentUser } = useAuth();

  const [followers, setFollowers] = useState<UserListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [followError, setFollowError] = useState('');
  const [followingState, setFollowingState] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (!isAuthenticated) return;

    const fetchFollowers = async () => {
      try {
        const response = await fetch(`/api/users/${username}/followers`);

        if (!response.ok) {
          throw new Error('Failed to fetch followers');
        }

        const data = await response.json();
        setFollowers(data.followers);

        // Initialize following state from API response
        const initialState: Record<string, boolean> = {};
        data.followers.forEach((follower: UserListItem) => {
          initialState[follower.username] = follower.isFollowing;
        });
        setFollowingState(initialState);
      } catch (err) {
        console.error('Error fetching followers:', err);
        setError(true);
      } finally {
        setLoading(false);
      }
    };

    fetchFollowers();
  }, [username, isAuthenticated]);

  const handleFollow = async (targetUsername: string) => {
    if (!isAuthenticated) return;

    const isCurrentlyFollowing = followingState[targetUsername] || false;

    try {
      setFollowingState((prev) => ({ ...prev, [targetUsername]: !isCurrentlyFollowing }));

      const endpoint = isCurrentlyFollowing ? 'unfollow' : 'follow';
      const response = await fetch(`/api/users/${targetUsername}/${endpoint}`, {
        method: 'POST',
        headers: { 'X-Requested-With': 'fetch' },
      });

      if (!response.ok) {
        console.error('Follow toggle failed with status:', response.status);
        setFollowingState((prev) => ({ ...prev, [targetUsername]: isCurrentlyFollowing }));
        setFollowError(t('followFailed', { action: endpoint }));
      }
    } catch (error) {
      setFollowingState((prev) => ({ ...prev, [targetUsername]: isCurrentlyFollowing }));
      setFollowError(t('followFailed', { action: isCurrentlyFollowing ? 'unfollow' : 'follow' }));
      console.error('Error toggling follow:', error);
    }
  };

  // The session first. A visitor without one never fetches, so this page's own `loading`
  // never clears for them: checking it first left anyone arriving signed out on a blank
  // page forever, with the sign-in prompt below unreachable.
  if (authLoading) {
    return null;
  }

  if (!isAuthenticated) {
    return (
      <PageFrame width="reading" sx={{ textAlign: 'center' }}>
        <Typography variant="h6" color="text.secondary" sx={{ mb: 2 }}>
          {t('followers.signInPrompt')}
        </Typography>
        <Button component={NextLink} href="/auth" variant="contained">
          {t('signIn')}
        </Button>
      </PageFrame>
    );
  }

  if (loading) {
    return null;
  }

  if (error) {
    return (
      <PageFrame width="reading">
        <Alert severity="error" sx={{ mb: 2 }}>
          {t('followers.loadFailed')}
        </Alert>
        <Button onClick={() => router.back()}>{tCommon('actions.goBack')}</Button>
      </PageFrame>
    );
  }

  return (
    <>
      <PageFrame width="reading">
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3 }}>
          <IconButton onClick={() => router.back()} edge="start">
            <ArrowBack />
          </IconButton>
          <Typography variant="h5" component="h1" sx={{ fontWeight: 600 }}>
            {t('followers.title')}
          </Typography>
        </Box>

        {followers.length === 0 ? (
          <Paper sx={{ p: 4, textAlign: 'center' }}>
            <Typography variant="body1" color="text.secondary">
              {t('followers.empty')}
            </Typography>
          </Paper>
        ) : (
          <List sx={{ bgcolor: 'background.paper', borderRadius: 2 }}>
            {followers.map((follower, index) => (
              <MotionPaper
                key={follower.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: index * 0.05 }}
                elevation={0}
              >
                <ListItem
                  sx={{
                    py: 2,
                    borderBottom: index < followers.length - 1 ? 1 : 0,
                    borderColor: 'divider',
                  }}
                >
                  <ListItemAvatar>
                    <Avatar
                      src={cloudinaryImage(follower.avatar, 'avatar') || undefined}
                      sx={{
                        width: 48,
                        height: 48,
                        cursor: 'pointer',
                      }}
                      onClick={() => router.push(`/profile/${follower.username}`)}
                    >
                      {follower.username.charAt(0).toUpperCase()}
                    </Avatar>
                  </ListItemAvatar>
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Typography
                      variant="body1"
                      sx={{
                        fontWeight: 600,
                        cursor: 'pointer',
                        '&:hover': { textDecoration: 'underline' },
                      }}
                      onClick={() => router.push(`/profile/${follower.username}`)}
                    >
                      {follower.fullName || follower.username}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      @{follower.username}
                    </Typography>
                    {follower.bio && (
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
                        {follower.bio}
                      </Typography>
                    )}
                  </Box>
                  {currentUser && follower.username !== currentUser.username && (
                    <Button
                      variant={followingState[follower.username] ? 'outlined' : 'contained'}
                      size="small"
                      onClick={() => handleFollow(follower.username)}
                      sx={{ minWidth: 100 }}
                    >
                      {followingState[follower.username]
                        ? t('actions.following')
                        : t('actions.follow')}
                    </Button>
                  )}
                </ListItem>
              </MotionPaper>
            ))}
          </List>
        )}
      </PageFrame>

      <Snackbar
        open={!!followError}
        autoHideDuration={4000}
        onClose={() => setFollowError('')}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert onClose={() => setFollowError('')} severity="error" variant="filled">
          {followError}
        </Alert>
      </Snackbar>
    </>
  );
}
