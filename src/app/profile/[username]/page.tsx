'use client';
import React, { useState, useEffect } from 'react';
import {
  Container,
  Box,
  Typography,
  Avatar,
  Button,
  Tabs,
  Tab,
  Grid,
  Card,
  CardMedia,
  CardContent,
  IconButton,
  Chip,
  Alert,
  Divider,
  Skeleton,
  Toolbar,
  Grow,
} from '@mui/material';
import EditProfileModal from '@/components/profile/EditProfileModal';
import {
  Settings,
  GridOn,
  BookmarkBorder,
  Restaurant,
  Group,
  Edit as EditIcon,
  Link as LinkIcon,
  ArrowBack,
} from '@mui/icons-material';
import { useParams, useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { useAuth } from '@/contexts/AuthContext';

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
}

interface ProfileStats {
  recipesCount: number;
  followersCount: number;
  followingCount: number;
}

const getDifficultyColor = (difficulty: string) => {
  switch (difficulty.toLowerCase()) {
    case 'easy':
      return 'success';
    case 'medium':
      return 'warning';
    case 'hard':
      return 'error';
    default:
      return 'default';
  }
};

export default function ProfilePage() {
  const params = useParams();
  const router = useRouter();
  const { user: currentUser, token } = useAuth();
  const username = params.username as string;

  const [profile, setProfile] = useState<User | null>(null);
  const [stats, setStats] = useState<ProfileStats>({ recipesCount: 0, followersCount: 0, followingCount: 0 });
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

  useEffect(() => {
    loadProfile();
  }, [username]);

  const loadProfile = async () => {
    try {
      setLoading(true);
      setError(null);

      // Load user profile
      const userResponse = await fetch(`/api/users/${username}`);
      console.log('User response status:', userResponse.status);

      if (!userResponse.ok) {
        if (userResponse.status === 404) {
          throw new Error('User not found');
        }
        throw new Error('Failed to load profile');
      }

      const userData = await userResponse.json();
      console.log('User data received:', userData);

      // Handle both userData.user and userData.data.user formats
      const user = userData.user || userData.data?.user || userData;
      console.log('Setting profile to:', user);

      if (!user || !user.id) {
        throw new Error('Invalid user data received');
      }

      setProfile(user);

      // Load profile stats
      const statsResponse = await fetch(`/api/users/${username}/stats`);
      if (statsResponse.ok) {
        const statsData = await statsResponse.json();
        setStats(statsData);
      }

      // Load user's recipes
      const recipesResponse = await fetch(`/api/users/${username}/recipes`);
      if (recipesResponse.ok) {
        const recipesData = await recipesResponse.json();
        setRecipes(recipesData.recipes || []);
      }

      // Check if following (if logged in and not own profile)
      if (currentUser && !isOwnProfile && token) {
        const followResponse = await fetch(`/api/users/${username}/is-following`, {
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        });
        if (followResponse.ok) {
          const followData = await followResponse.json();
          setIsFollowing(followData.isFollowing);
        }
      }

      // Load saved recipes if own profile
      console.log('isOwnProfile:', isOwnProfile, 'token:', !!token);
      if (isOwnProfile && token) {
        console.log('Fetching saved recipes...');
        const savedResponse = await fetch(`/api/users/${username}/saved`, {
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        });
        console.log('Saved recipes response status:', savedResponse.status);
        if (savedResponse.ok) {
          const savedData = await savedResponse.json();
          console.log('Saved recipes data:', savedData);
          setSavedRecipes(savedData.recipes || []);
        } else {
          const errorData = await savedResponse.json();
          console.error('Failed to load saved recipes:', errorData);
        }
      }
    } catch (err) {
      console.error('Error loading profile:', err);
      setError(err instanceof Error ? err.message : 'Failed to load profile');
    } finally {
      setLoading(false);
    }
  };

  const handleFollow = async () => {
    if (!token || isOwnProfile) return;

    // Store the current state before the API call
    const previousFollowState = isFollowing;
    const previousFollowersCount = stats.followersCount;

    try {
      setFollowLoading(true);

      // Optimistically update UI
      setIsFollowing(!previousFollowState);
      setStats(prev => ({
        ...prev,
        followersCount: previousFollowState ? prev.followersCount - 1 : prev.followersCount + 1,
      }));

      const endpoint = previousFollowState ? 'unfollow' : 'follow';
      const response = await fetch(`/api/users/${username}/${endpoint}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        // Revert on error
        setIsFollowing(previousFollowState);
        setStats(prev => ({
          ...prev,
          followersCount: previousFollowersCount,
        }));
        console.error('Follow/unfollow failed');
      }
    } catch (error) {
      // Revert on error
      setIsFollowing(previousFollowState);
      setStats(prev => ({
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

  if (loading) {
    return (
      <Box sx={{ minHeight: '100vh', pb: 8, backgroundColor: 'background.default' }}>
        {/* Spacer for fixed AppBar */}
        <Toolbar />

        <Container maxWidth="lg" sx={{ pt: 2 }}>
          {/* Profile Header Skeleton */}
          <Box sx={{ display: 'flex', gap: 4, mb: 4, flexDirection: { xs: 'column', sm: 'row' } }}>
            <Box sx={{ display: 'flex', justifyContent: 'center' }}>
              <Skeleton variant="circular" width={150} height={150} />
            </Box>
            <Box sx={{ flex: 1 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
                <Skeleton variant="text" width={200} height={40} />
                <Skeleton variant="rectangular" width={120} height={32} sx={{ borderRadius: 1 }} />
              </Box>
              <Box sx={{ display: 'flex', gap: 4, mb: 2 }}>
                <Skeleton variant="text" width={100} height={30} />
                <Skeleton variant="text" width={100} height={30} />
                <Skeleton variant="text" width={100} height={30} />
              </Box>
              <Skeleton variant="text" width="80%" height={20} />
              <Skeleton variant="text" width="60%" height={20} />
            </Box>
          </Box>

          <Divider sx={{ mb: 3 }} />

          {/* Tabs Skeleton */}
          <Box sx={{ mb: 3 }}>
            <Skeleton variant="rectangular" width="100%" height={48} />
          </Box>

          {/* Recipe Grid Skeleton */}
          <Grid container spacing={2}>
            {[1, 2, 3, 4, 5, 6].map((item) => (
              <Grid item xs={12} sm={6} md={4} key={item}>
                <Card>
                  <Skeleton variant="rectangular" width="100%" height={200} />
                  <CardContent>
                    <Skeleton variant="text" width="80%" height={30} />
                    <Box sx={{ display: 'flex', gap: 1, mt: 1 }}>
                      <Skeleton variant="rectangular" width={80} height={24} sx={{ borderRadius: 2 }} />
                      <Skeleton variant="rectangular" width={80} height={24} sx={{ borderRadius: 2 }} />
                    </Box>
                  </CardContent>
                </Card>
              </Grid>
            ))}
          </Grid>
        </Container>
      </Box>
    );
  }

  if (error || !profile) {
    return (
      <Container maxWidth="md" sx={{ py: 4 }}>
        <Alert severity="error" sx={{ mb: 2 }}>
          {error || 'Profile not found'}
        </Alert>
        <Button onClick={() => router.push('/')}>Go Back Home</Button>
      </Container>
    );
  }

  return (
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
          <Box sx={{ display: 'flex', gap: 4, mb: 4, flexDirection: { xs: 'column', sm: 'row' } }}>
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
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2, flexWrap: 'wrap' }}>
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
                  <Typography variant="h6" component="span" sx={{ fontWeight: 700, color: 'text.primary' }}>
                    {stats.recipesCount}
                  </Typography>
                  <Typography variant="body2" component="span" sx={{ ml: 0.5, color: 'text.primary' }}>
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
                  <Typography variant="h6" component="span" sx={{ fontWeight: 700, color: 'text.primary' }}>
                    {stats.followersCount}
                  </Typography>
                  <Typography variant="body2" component="span" sx={{ ml: 0.5, color: 'text.primary' }}>
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
                  <Typography variant="h6" component="span" sx={{ fontWeight: 700, color: 'text.primary' }}>
                    {stats.followingCount}
                  </Typography>
                  <Typography variant="body2" component="span" sx={{ ml: 0.5, color: 'text.primary' }}>
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
                    sx={{ color: 'primary.main', textDecoration: 'none', '&:hover': { textDecoration: 'underline' } }}
                  >
                    {profile.website}
                  </Typography>
                </Box>
              )}
            </Box>
          </Box>
        </MotionBox>

        {/* Tabs */}
        <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 3 }}>
          <Tabs
            value={activeTab}
            onChange={(e, newValue) => setActiveTab(newValue)}
            centered
            aria-label="profile tabs"
          >
            <Tab icon={<GridOn />} label="RECIPES" iconPosition="start" />
            {isOwnProfile && <Tab icon={<BookmarkBorder />} label="SAVED" iconPosition="start" />}
          </Tabs>
        </Box>

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
                          height: '100%'
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
                          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                            <Chip
                              label={recipe.difficulty}
                              size="small"
                              color={getDifficultyColor(recipe.difficulty) as any}
                              sx={{
                                textTransform: 'capitalize',
                                color: 'white',
                                '& .MuiChip-label': {
                                  color: 'white',
                                },
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
                          height: '100%'
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
                          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                            <Chip
                              label={recipe.difficulty}
                              size="small"
                              color={getDifficultyColor(recipe.difficulty) as any}
                              sx={{
                                textTransform: 'capitalize',
                                color: 'white',
                                '& .MuiChip-label': {
                                  color: 'white',
                                },
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
  );
}
