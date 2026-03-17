'use client';

import {
  Settings,
  GridOn,
  BookmarkBorder,
  Restaurant,
  Edit as EditIcon,
  Link as LinkIcon,
} from '@mui/icons-material';
import {
  Container,
  Box,
  Typography,
  Avatar,
  Button,
  Grid,
  Card,
  CardMedia,
  CardContent,
  IconButton,
  Chip,
  Alert,
  Toolbar,
  Grow,
  Rating,
} from '@mui/material';
import { motion } from 'framer-motion';
import { useParams, useRouter } from 'next/navigation';
import React, { useState, useEffect, useCallback } from 'react';
import EditProfileModal from '@/components/profile/EditProfileModal';
import AnimatedTabs from '@/components/ui/AnimatedTabs';
import TabPanelTransition from '@/components/ui/TabPanelTransition';
import { useAuth } from '@/contexts/AuthContext';
import { getDifficultyColor } from '@/lib/utils/recipe';

const MotionCard = motion.create(Card);
const MotionBox = motion.create(Box);

interface User {
  id: string;
  username: string;
  fullName?: string;
  bio?: string;
  avatar?: string;
  website?: string;
  createdAt: string;
}

interface Recipe {
  id: string;
  title: string;
  imageUrl: string;
  difficulty: string;
  likesCount: number;
  commentsCount: number;
  averageRating?: number;
  totalRatings?: number;
  author?: {
    username: string;
    avatar?: string;
  };
}

interface ProfileStats {
  recipesCount: number;
  followersCount: number;
  followingCount: number;
}

export default function ProfilePage() {
  const params = useParams();
  const router = useRouter();
  const { user: currentUser, token } = useAuth();
  const username = params.username as string;

  const [profile, setProfile] = useState<User | null>(null);
  const [stats, setStats] = useState<ProfileStats>({
    recipesCount: 0,
    followersCount: 0,
    followingCount: 0,
  });
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [savedRecipes, setSavedRecipes] = useState<Recipe[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState(0);
  const [isFollowing, setIsFollowing] = useState(false);
  const [followLoading, setFollowLoading] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [bioExpanded, setBioExpanded] = useState(false);

  const isOwnProfile = currentUser?.username === username;
  const bioPreviewLength = 100;

  const loadProfile = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      // Single API call to get ALL profile data
      const headers: HeadersInit = {};
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const response = await fetch(`/api/users/${username}/profile`, { headers });

      if (!response.ok) {
        if (response.status === 404) {
          throw new Error('User not found');
        }
        throw new Error('Failed to load profile');
      }

      const data = await response.json();

      // Set all state from single response
      setProfile(data.user);
      setStats(data.stats);
      setRecipes(data.recipes || []);

      if (data.isFollowing !== undefined) {
        setIsFollowing(data.isFollowing);
      }

      if (data.savedRecipes) {
        setSavedRecipes(data.savedRecipes);
      }
    } catch (err) {
      console.error('Error loading profile:', err);
      setError(err instanceof Error ? err.message : 'Failed to load profile');
    } finally {
      setLoading(false);
    }
  }, [username, token]);

  useEffect(() => {
    loadProfile();
  }, [loadProfile]);

  const handleFollow = async () => {
    if (isOwnProfile) return;

    // Redirect guests to auth page
    if (!token) {
      router.push('/auth');
      return;
    }

    // Store the current state before the API call
    const previousFollowState = isFollowing;
    const previousFollowersCount = stats.followersCount;

    try {
      setFollowLoading(true);

      // Optimistically update UI
      setIsFollowing(!previousFollowState);
      setStats((prev) => ({
        ...prev,
        followersCount: previousFollowState ? prev.followersCount - 1 : prev.followersCount + 1,
      }));

      const endpoint = previousFollowState ? 'unfollow' : 'follow';
      const response = await fetch(`/api/users/${username}/${endpoint}`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        // Revert on error
        setIsFollowing(previousFollowState);
        setStats((prev) => ({
          ...prev,
          followersCount: previousFollowersCount,
        }));
        console.error('Follow/unfollow failed');
      }
    } catch (error) {
      // Revert on error
      setIsFollowing(previousFollowState);
      setStats((prev) => ({
        ...prev,
        followersCount: previousFollowersCount,
      }));
      console.error('Error toggling follow:', error);
    } finally {
      setFollowLoading(false);
    }
  };

  const handleRecipeClick = (recipeId: string) => {
    router.push(`/recipe/${recipeId}`);
  };

  // Return null during loading - the global LoadingBar shows progress
  if (loading) {
    return null;
  }

  if (error || !profile) {
    return (
      <Container maxWidth="md" sx={{ py: 4 }}>
        <Toolbar />
        <Alert severity="error" sx={{ mb: 2 }}>
          {error || 'Profile not found'}
        </Alert>
        <Button onClick={() => router.push('/')}>Go Back Home</Button>
      </Container>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: 'spring', stiffness: 300, damping: 30 }}
    >
      <Box sx={{ minHeight: '100vh', pb: 8, backgroundColor: 'background.default' }}>
        {/* Spacer for fixed AppBar */}
        <Toolbar />

        <Container maxWidth="lg" sx={{ pt: 2 }}>
          {/* Profile Header */}
          <MotionBox
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <Box
              sx={{ display: 'flex', gap: 4, mb: 4, flexDirection: { xs: 'column', sm: 'row' } }}
            >
              {/* Avatar */}
              <Box sx={{ display: 'flex', justifyContent: 'center' }}>
                <Avatar
                  src={profile.avatar}
                  sx={{
                    width: { xs: 100, sm: 150 },
                    height: { xs: 100, sm: 150 },
                    border: '3px solid',
                    borderColor: 'primary.main',
                  }}
                >
                  {profile.username.charAt(0).toUpperCase()}
                </Avatar>
              </Box>

              {/* Profile Info */}
              <Box sx={{ flex: 1 }}>
                <Box
                  sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2, flexWrap: 'wrap' }}
                >
                  <Typography variant="h4" component="h1" sx={{ color: 'text.primary' }}>
                    {profile.username}
                  </Typography>
                  {isOwnProfile ? (
                    <>
                      <Button
                        variant="outlined"
                        startIcon={<EditIcon />}
                        onClick={() => setEditModalOpen(true)}
                        size="small"
                      >
                        Edit Profile
                      </Button>
                      <IconButton onClick={() => router.push('/settings')}>
                        <Settings />
                      </IconButton>
                    </>
                  ) : (
                    <Button
                      key={`follow-btn-${isFollowing}`}
                      variant={isFollowing ? 'outlined' : 'contained'}
                      onClick={handleFollow}
                      disabled={followLoading}
                      size="small"
                      sx={{
                        minWidth: 100,
                        transition: 'all 0.2s ease-in-out',
                      }}
                    >
                      {followLoading ? 'Loading...' : isFollowing ? 'Following' : 'Follow'}
                    </Button>
                  )}
                </Box>

                {/* Stats */}
                <Box sx={{ display: 'flex', gap: 4, mb: 2 }}>
                  <Box>
                    <Typography
                      variant="h6"
                      component="span"
                      sx={{ fontWeight: 700, color: 'text.primary' }}
                    >
                      {stats.recipesCount}
                    </Typography>
                    <Typography
                      variant="body2"
                      component="span"
                      sx={{ ml: 0.5, color: 'text.primary' }}
                    >
                      recipes
                    </Typography>
                  </Box>
                  <Box
                    sx={{
                      cursor: 'pointer',
                      '&:hover': { opacity: 0.7 },
                      transition: 'opacity 0.2s',
                    }}
                    onClick={() => router.push(`/profile/${username}/followers`)}
                  >
                    <Typography
                      variant="h6"
                      component="span"
                      sx={{ fontWeight: 700, color: 'text.primary' }}
                    >
                      {stats.followersCount}
                    </Typography>
                    <Typography
                      variant="body2"
                      component="span"
                      sx={{ ml: 0.5, color: 'text.primary' }}
                    >
                      followers
                    </Typography>
                  </Box>
                  <Box
                    sx={{
                      cursor: 'pointer',
                      '&:hover': { opacity: 0.7 },
                      transition: 'opacity 0.2s',
                    }}
                    onClick={() => router.push(`/profile/${username}/following`)}
                  >
                    <Typography
                      variant="h6"
                      component="span"
                      sx={{ fontWeight: 700, color: 'text.primary' }}
                    >
                      {stats.followingCount}
                    </Typography>
                    <Typography
                      variant="body2"
                      component="span"
                      sx={{ ml: 0.5, color: 'text.primary' }}
                    >
                      following
                    </Typography>
                  </Box>
                </Box>

                {/* Bio */}
                {profile.fullName && (
                  <Typography variant="subtitle1" sx={{ fontWeight: 600, color: 'text.primary' }}>
                    {profile.fullName}
                  </Typography>
                )}
                {profile.bio && (
                  <Box>
                    <Typography
                      variant="body2"
                      sx={{
                        mb: 1,
                        whiteSpace: 'pre-line',
                        color: 'text.primary',
                      }}
                    >
                      {bioExpanded || profile.bio.length <= bioPreviewLength
                        ? profile.bio
                        : `${profile.bio.substring(0, bioPreviewLength)}...`}
                    </Typography>
                    {profile.bio.length > bioPreviewLength && (
                      <Typography
                        variant="caption"
                        color="primary"
                        sx={{ cursor: 'pointer', fontWeight: 500 }}
                        onClick={() => setBioExpanded(!bioExpanded)}
                      >
                        {bioExpanded ? 'Show less' : 'Show more'}
                      </Typography>
                    )}
                  </Box>
                )}
                {profile.website && (
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                    <LinkIcon fontSize="small" color="action" />
                    <Typography
                      variant="body2"
                      component="a"
                      href={profile.website}
                      target="_blank"
                      rel="noopener noreferrer"
                      sx={{
                        color: 'primary.main',
                        textDecoration: 'none',
                        '&:hover': { textDecoration: 'underline' },
                      }}
                    >
                      {profile.website}
                    </Typography>
                  </Box>
                )}
              </Box>
            </Box>
          </MotionBox>

          {/* Tabs with Sliding Indicator */}
          <AnimatedTabs
            tabs={[
              { key: 0, label: 'Recipes', icon: <GridOn /> },
              ...(isOwnProfile ? [{ key: 1, label: 'Saved', icon: <BookmarkBorder /> }] : []),
            ]}
            activeKey={activeTab}
            onChange={(key) => setActiveTab(key as number)}
          />
          {/* Tab Content with X-Axis Transition */}
          <Box sx={{ mt: 3 }}>
            <TabPanelTransition activeKey={activeTab}>
              {/* Recipe Grid */}
              {activeTab === 0 && (
                <Grid container spacing={2}>
                  {recipes.length === 0 ? (
                    <Grid item xs={12}>
                      <Box sx={{ textAlign: 'center', py: 8 }}>
                        <Restaurant sx={{ fontSize: 80, color: 'text.secondary', mb: 2 }} />
                        <Typography variant="h6" color="text.secondary">
                          No recipes yet
                        </Typography>
                        {isOwnProfile && (
                          <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                            Share your first recipe to get started!
                          </Typography>
                        )}
                      </Box>
                    </Grid>
                  ) : (
                    recipes.map((recipe, index) => (
                      <Grid item xs={12} sm={6} md={4} key={recipe.id}>
                        <Grow in={true} timeout={(index + 1) * 200}>
                          <div>
                            <MotionCard
                              whileHover={{ scale: 1.02 }}
                              onClick={() => handleRecipeClick(recipe.id)}
                              sx={{
                                backgroundColor: (theme) => theme.palette.background.paper,
                                cursor: 'pointer',
                                height: '100%',
                                borderRadius: '20px',
                                overflow: 'hidden',
                              }}
                            >
                              <CardMedia
                                component="img"
                                height="200"
                                image={recipe.imageUrl}
                                alt={recipe.title}
                                sx={{ objectFit: 'cover' }}
                              />
                              <CardContent>
                                <Typography variant="h6" gutterBottom noWrap>
                                  {recipe.title}
                                </Typography>
                                {recipe.averageRating !== undefined && recipe.averageRating > 0 && (
                                  <Box
                                    sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 1 }}
                                  >
                                    <Rating
                                      value={recipe.averageRating}
                                      precision={0.5}
                                      size="small"
                                      readOnly
                                      sx={{ color: '#FFB400' }}
                                    />
                                    <Typography
                                      variant="body2"
                                      color="text.secondary"
                                      sx={{ fontSize: '0.8125rem' }}
                                    >
                                      ({recipe.totalRatings || 0})
                                    </Typography>
                                  </Box>
                                )}
                                <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                                  <Chip
                                    label={recipe.difficulty}
                                    size="small"
                                    color={getDifficultyColor(recipe.difficulty)}
                                    sx={{
                                      textTransform: 'capitalize',
                                      color: 'white',
                                      '& .MuiChip-label': { color: 'white' },
                                    }}
                                  />
                                </Box>
                              </CardContent>
                            </MotionCard>
                          </div>
                        </Grow>
                      </Grid>
                    ))
                  )}
                </Grid>
              )}

              {/* Saved Recipes Tab */}
              {activeTab === 1 && isOwnProfile && (
                <Grid container spacing={2}>
                  {savedRecipes.length === 0 ? (
                    <Grid item xs={12}>
                      <Box sx={{ textAlign: 'center', py: 8 }}>
                        <BookmarkBorder sx={{ fontSize: 80, color: 'text.secondary', mb: 2 }} />
                        <Typography variant="h6" color="text.secondary">
                          No saved recipes yet
                        </Typography>
                        <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                          Bookmark recipes you&apos;d like to try later!
                        </Typography>
                      </Box>
                    </Grid>
                  ) : (
                    savedRecipes.map((recipe, index) => (
                      <Grid item xs={12} sm={6} md={4} key={recipe.id}>
                        <Grow in={true} timeout={(index + 1) * 200}>
                          <div>
                            <MotionCard
                              whileHover={{ scale: 1.02 }}
                              onClick={() => handleRecipeClick(recipe.id)}
                              sx={{
                                backgroundColor: (theme) => theme.palette.background.paper,
                                cursor: 'pointer',
                                height: '100%',
                                borderRadius: '20px',
                                overflow: 'hidden',
                              }}
                            >
                              <CardMedia
                                component="img"
                                height="200"
                                image={recipe.imageUrl}
                                alt={recipe.title}
                                sx={{ objectFit: 'cover' }}
                              />
                              <CardContent>
                                <Typography variant="h6" gutterBottom noWrap>
                                  {recipe.title}
                                </Typography>
                                {recipe.author && (
                                  <Box
                                    sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}
                                  >
                                    <Avatar
                                      src={recipe.author.avatar}
                                      sx={{ width: 24, height: 24 }}
                                    >
                                      {recipe.author.username.charAt(0).toUpperCase()}
                                    </Avatar>
                                    <Typography variant="body2" color="text.secondary">
                                      {recipe.author.username}
                                    </Typography>
                                  </Box>
                                )}
                                {recipe.averageRating !== undefined && recipe.averageRating > 0 && (
                                  <Box
                                    sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 1 }}
                                  >
                                    <Rating
                                      value={recipe.averageRating}
                                      precision={0.5}
                                      size="small"
                                      readOnly
                                      sx={{ color: '#FFB400' }}
                                    />
                                    <Typography
                                      variant="body2"
                                      color="text.secondary"
                                      sx={{ fontSize: '0.8125rem' }}
                                    >
                                      ({recipe.totalRatings || 0})
                                    </Typography>
                                  </Box>
                                )}
                                <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                                  <Chip
                                    label={recipe.difficulty}
                                    size="small"
                                    color={getDifficultyColor(recipe.difficulty)}
                                    sx={{
                                      textTransform: 'capitalize',
                                      color: 'white',
                                      '& .MuiChip-label': { color: 'white' },
                                    }}
                                  />
                                </Box>
                              </CardContent>
                            </MotionCard>
                          </div>
                        </Grow>
                      </Grid>
                    ))
                  )}
                </Grid>
              )}
            </TabPanelTransition>
          </Box>
        </Container>

        {/* Edit Profile Modal */}
        <EditProfileModal
          open={editModalOpen}
          onClose={() => setEditModalOpen(false)}
          onSuccess={() => {
            loadProfile(); // Reload profile after editing
          }}
        />
      </Box>
    </motion.div>
  );
}
