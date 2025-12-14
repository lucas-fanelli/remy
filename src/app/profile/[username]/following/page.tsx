'use client';

// Force dynamic rendering for this page
export const dynamic = 'force-dynamic';

import React, { useEffect, useState } from 'react';
import {
  Box,
  Container,
  Typography,
  List,
  ListItem,
  ListItemAvatar,
  ListItemText,
  Avatar,
  Button,
  Alert,
  Toolbar,
  IconButton,
  Paper,
} from '@mui/material';
import { useRouter, useParams } from 'next/navigation';
import { ArrowBack } from '@mui/icons-material';
import { motion } from 'framer-motion';
import { useAuth } from '@/contexts/AuthContext';

interface UserListItem {
  id: string;
  username: string;
  fullName: string | null;
  avatar: string | null;
  bio: string | null;
  isFollowing: boolean;
}

const MotionPaper = motion.create(Paper);

export default function FollowingPage() {
  const router = useRouter();
  const params = useParams();
  const username = params.username as string;
  const { token, user: currentUser } = useAuth();

  const [following, setFollowing] = useState<UserListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [followingState, setFollowingState] = useState<Record<string, boolean>>({});

  useEffect(() => {
    const fetchFollowing = async () => {
      try {
        const headers: HeadersInit = {};
        if (token) {
          headers['Authorization'] = `Bearer ${token}`;
        }

        const response = await fetch(`/api/users/${username}/following`, {
          headers,
        });

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
        setError('Failed to load following');
      } finally {
        setLoading(false);
      }
    };

    fetchFollowing();
  }, [username, token]);

  const handleFollow = async (targetUsername: string) => {
    if (!token) return;

    const isCurrentlyFollowing = followingState[targetUsername] || false;

    try {
      setFollowingState(prev => ({ ...prev, [targetUsername]: !isCurrentlyFollowing }));

      const endpoint = isCurrentlyFollowing ? 'unfollow' : 'follow';
      const response = await fetch(`/api/users/${targetUsername}/${endpoint}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        setFollowingState(prev => ({ ...prev, [targetUsername]: isCurrentlyFollowing }));
      }
    } catch (error) {
      setFollowingState(prev => ({ ...prev, [targetUsername]: isCurrentlyFollowing }));
      console.error('Error toggling follow:', error);
    }
  };

  if (loading) {
    return null;
  }

  if (error) {
    return (
      <Box sx={{ minHeight: '100vh', backgroundColor: 'background.default' }}>
        <Toolbar />
        <Container maxWidth="md" sx={{ pt: 4 }}>
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
          <Button onClick={() => router.back()}>Go Back</Button>
        </Container>
      </Box>
    );
  }

  return (
    <Box sx={{ minHeight: '100vh', backgroundColor: 'background.default' }}>
      <Toolbar />
      <Container maxWidth="md" sx={{ pt: 2, pb: 4 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3 }}>
          <IconButton onClick={() => router.back()} edge="start">
            <ArrowBack />
          </IconButton>
          <Typography variant="h5" component="h1" sx={{ fontWeight: 600 }}>
            Following
          </Typography>
        </Box>

        {following.length === 0 ? (
          <Paper sx={{ p: 4, textAlign: 'center' }}>
            <Typography variant="body1" color="text.secondary">
              Not following anyone yet
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
                      {followingState[user.username] ? 'Following' : 'Follow'}
                    </Button>
                  )}
                </ListItem>
              </MotionPaper>
            ))}
          </List>
        )}
      </Container>
    </Box>
  );
}
