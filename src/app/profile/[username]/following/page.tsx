'use client';

import { ArrowBack } from '@mui/icons-material';
import {
  Box,
  Container,
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
import { MotionPaper } from '@/components/motion';
import { useAuth } from '@/contexts/AuthContext';

interface UserListItem {
  id: string;
  username: string;
  fullName: string | null;
  avatar: string | null;
  bio: string | null;
  isFollowing: boolean;
}

export default function FollowingPage() {
  const t = useTranslations('profile');
  const tCommon = useTranslations('common');
  const router = useRouter();
  const params = useParams();
  const username = params.username as string;
  const { isAuthenticated, isLoading: authLoading, user: currentUser } = useAuth();

  const [following, setFollowing] = useState<UserListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [followError, setFollowError] = useState('');
  const [followingState, setFollowingState] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (!isAuthenticated) return;

    const fetchFollowing = async () => {
      try {
        const response = await fetch(`/api/users/${username}/following`);

        if (!response.ok) {
          throw new Error('Failed to fetch following');
        }

        const data = await response.json();
        setFollowing(data.following);

        // Initialize following state from API response
        const initialState: Record<string, boolean> = {};
        data.following.forEach((user: UserListItem) => {
          initialState[user.username] = user.isFollowing;
        });
        setFollowingState(initialState);
      } catch (err) {
        console.error('Error fetching following:', err);
        setError(true);
      } finally {
        setLoading(false);
      }
    };

    fetchFollowing();
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

  if (loading || authLoading) {
    return null;
  }

  if (!isAuthenticated) {
    return (
      <Box sx={{ backgroundColor: 'background.default' }}>
        <Container maxWidth="md" sx={{ pt: 4, textAlign: 'center' }}>
          <Typography variant="h6" color="text.secondary" sx={{ mb: 2 }}>
            {t('followingList.signInPrompt')}
          </Typography>
          <Button component={NextLink} href="/auth" variant="contained">
            {t('signIn')}
          </Button>
        </Container>
      </Box>
    );
  }

  if (error) {
    return (
      <Box sx={{ backgroundColor: 'background.default' }}>
        <Container maxWidth="md" sx={{ pt: 4 }}>
          <Alert severity="error" sx={{ mb: 2 }}>
            {t('followingList.loadFailed')}
          </Alert>
          <Button onClick={() => router.back()}>{tCommon('actions.goBack')}</Button>
        </Container>
      </Box>
    );
  }

  return (
    <Box sx={{ backgroundColor: 'background.default' }}>
      <Container maxWidth="md" sx={{ pt: 2, pb: 4 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3 }}>
          <IconButton onClick={() => router.back()} edge="start">
            <ArrowBack />
          </IconButton>
          <Typography variant="h5" component="h1" sx={{ fontWeight: 600 }}>
            {t('followingList.title')}
          </Typography>
        </Box>

        {following.length === 0 ? (
          <Paper sx={{ p: 4, textAlign: 'center' }}>
            <Typography variant="body1" color="text.secondary">
              {t('followingList.empty')}
            </Typography>
          </Paper>
        ) : (
          <List sx={{ bgcolor: 'background.paper', borderRadius: 2 }}>
            {following.map((user, index) => (
              <MotionPaper
                key={user.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: index * 0.05 }}
                elevation={0}
              >
                <ListItem
                  sx={{
                    py: 2,
                    borderBottom: index < following.length - 1 ? 1 : 0,
                    borderColor: 'divider',
                  }}
                >
                  <ListItemAvatar>
                    <Avatar
                      src={user.avatar || undefined}
                      sx={{
                        width: 48,
                        height: 48,
                        cursor: 'pointer',
                      }}
                      onClick={() => router.push(`/profile/${user.username}`)}
                    >
                      {user.username.charAt(0).toUpperCase()}
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
                      onClick={() => router.push(`/profile/${user.username}`)}
                    >
                      {user.fullName || user.username}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      @{user.username}
                    </Typography>
                    {user.bio && (
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
                        {user.bio}
                      </Typography>
                    )}
                  </Box>
                  {currentUser && user.username !== currentUser.username && (
                    <Button
                      variant={followingState[user.username] ? 'outlined' : 'contained'}
                      size="small"
                      onClick={() => handleFollow(user.username)}
                      sx={{ minWidth: 100 }}
                    >
                      {followingState[user.username] ? t('actions.following') : t('actions.follow')}
                    </Button>
                  )}
                </ListItem>
              </MotionPaper>
            ))}
          </List>
        )}
      </Container>

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
    </Box>
  );
}
