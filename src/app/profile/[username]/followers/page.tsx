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

export default function FollowersPage() {
  const router = useRouter();
  const params = useParams();
  const username = params.username as string;
  const { token, user: currentUser } = useAuth();

  const [followers, setFollowers] = useState<UserListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [followingState, setFollowingState] = useState<Record<string, boolean>>({});

  useEffect(() => {
    const fetchFollowers = async () => {
      try {
        const headers: HeadersInit = {};
        if (token) {
          headers['Authorization'] = `Bearer ${token}`;
        }

        const response = await fetch(`/api/users/${username}/followers`, {
          headers,
        });

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
        setError('Failed to load followers');
      } finally {
        setLoading(false);
      }
    };

    fetchFollowers();
  }, [username, token]);

  const handleFollow = async (targetUsername: string) => {
    if (!token) return;

    const isCurrentlyFollowing = followingState[targetUsername] || false;

    try {
      setFollowingState((prev) => ({ ...prev, [targetUsername]: !isCurrentlyFollowing }));

      const endpoint = isCurrentlyFollowing ? 'unfollow' : 'follow';
      const response = await fetch(`/api/users/${targetUsername}/${endpoint}`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        setFollowingState((prev) => ({ ...prev, [targetUsername]: isCurrentlyFollowing }));
      }
    } catch (error) {
      setFollowingState((prev) => ({ ...prev, [targetUsername]: isCurrentlyFollowing }));
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
            Followers
          </Typography>
        </Box>

        {followers.length === 0 ? (
          <Paper sx={{ p: 4, textAlign: 'center' }}>
            <Typography variant="body1" color="text.secondary">
              No followers yet
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
                      src={follower.avatar || undefined}
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
                      {followingState[follower.username] ? 'Following' : 'Follow'}
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
