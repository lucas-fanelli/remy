'use client';

import {
  Settings,
  GridOn,
  BookmarkBorder,
  Restaurant,
  Edit as EditIcon,
  Link as LinkIcon,
} from '@mui/icons-material';
import { Box, Typography, Avatar, Button, Grid, IconButton, Alert } from '@mui/material';
import { motion } from 'framer-motion';
import { useParams, useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import React, { useState, useEffect, useCallback } from 'react';
import PageFrame from '@/components/layout/PageFrame';
import { MotionBox } from '@/components/motion';
import CookingLog from '@/components/profile/CookingLog';
import EditProfileModal from '@/components/profile/EditProfileModal';
import RecipeCard, { type RecipeCardModel } from '@/components/recipe/RecipeCard';
import AnimatedTabs from '@/components/ui/AnimatedTabs';
import TabPanelTransition from '@/components/ui/TabPanelTransition';
import { useAuth } from '@/contexts/AuthContext';
import { cloudinaryImage } from '@/lib/utils/cloudinary';
import type { ViewerState } from '@/domain/types/recipe';

interface User {
  id: string;
  username: string;
  fullName?: string;
  bio?: string;
  avatar?: string;
  website?: string;
  createdAt: string;
}

/**
 * What `/api/users/[username]/profile` sends for a recipe on either tab.
 *
 * Written from the route, not from memory. This interface used to declare nine fields while
 * the route sent fourteen, so `description`, both times, `servings` and `viewer` arrived
 * on every request and were discarded here: profile cards had no description, no time and
 * no servings, and on your OWN profile your own liked recipes showed empty hearts. The
 * route even carries a comment saying it attaches `viewer` "so the card here takes the
 * same props as the card anywhere else". The page was not listening.
 */
interface Recipe {
  id: string;
  title: string;
  description: string | null;
  imageUrl: string;
  difficulty: string;
  prepTime: number | null;
  cookingTime: number | null;
  servings: number | null;
  likeCount: number;
  commentCount: number;
  averageRating?: number;
  totalRatings?: number;
  /** The saved tab only — the owner's own recipes need no byline. */
  author?: {
    username: string;
    avatar?: string;
  };
  viewer: ViewerState | null;
}

/**
 * A profile recipe, narrowed to what a card shows.
 *
 * A pass-through now. `description`, the times and `servings` come across as they are,
 * and a `null` from the server stays absent on the card rather than being invented — the
 * card omits any slot it is not given, which is the whole convergence mechanism.
 */
const toCardModel = (recipe: Recipe): RecipeCardModel => ({
  id: recipe.id,
  title: recipe.title,
  description: recipe.description ?? undefined,
  imageUrl: recipe.imageUrl,
  difficulty: recipe.difficulty,
  prepTime: recipe.prepTime ?? undefined,
  cookingTime: recipe.cookingTime ?? undefined,
  servings: recipe.servings,
  author: recipe.author,
  averageRating: recipe.averageRating,
  totalRatings: recipe.totalRatings,
  likeCount: recipe.likeCount,
  commentCount: recipe.commentCount,
});

interface ProfileStats {
  recipesCount: number;
  followersCount: number;
  followingCount: number;
}

/** Which message the error banner shows - a closed set, so the key can be built from it. */
type ProfileError = 'userNotFound' | 'loadFailed';

/** The big bold number inside a stat sentence; the message decides where it sits. */
const statCount = (chunks: React.ReactNode) => (
  <Typography variant="h6" component="span" sx={{ fontWeight: 700 }}>
    {chunks}
  </Typography>
);

export default function ProfilePage() {
  const t = useTranslations('profile');
  const tCommon = useTranslations('common');
  const params = useParams();
  const router = useRouter();
  const { user: currentUser, isAuthenticated } = useAuth();
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
  const [error, setError] = useState<ProfileError | null>(null);
  const [activeTab, setActiveTab] = useState(0);
  const [isFollowing, setIsFollowing] = useState(false);
  const [followLoading, setFollowLoading] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [bioExpanded, setBioExpanded] = useState(false);

  const isOwnProfile = currentUser?.username === username;
  const bioPreviewLength = 100;

  // The page no longer spells difficulty itself. It had its own key, `profile.difficulty`,
  // whose `other` arm named `{fallback}` rather than `{level}` and so required the value be
  // passed twice — which meant a profile could render a difficulty differently from the
  // recipe page showing the same recipe. One key now: `recipe.meta.difficulty`, inside
  // DifficultyChip.

  const loadProfile = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      // Single API call to get ALL profile data
      const response = await fetch(`/api/users/${username}/profile`);

      if (!response.ok) {
        // The banner picks its own sentence: the failure is a state, not a string
        setError(response.status === 404 ? 'userNotFound' : 'loadFailed');
        return;
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
      setError('loadFailed');
    } finally {
      setLoading(false);
    }
  }, [username]);

  useEffect(() => {
    loadProfile();
  }, [loadProfile]);

  const handleFollow = async () => {
    if (isOwnProfile) return;

    // Redirect guests to auth page
    if (!isAuthenticated) {
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
        headers: { 'X-Requested-With': 'fetch' },
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

  // Return null during loading - the global LoadingBar shows progress
  if (loading) {
    return null;
  }

  if (error || !profile) {
    return (
      <PageFrame width="reading">
        <Alert severity="error" sx={{ mb: 2 }}>
          {error ? t(`errors.${error}`) : t('errors.notFound')}
        </Alert>
        <Button onClick={() => router.push('/')}>{t('goHome')}</Button>
      </PageFrame>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: 'spring', stiffness: 300, damping: 30 }}
    >
      <>
        <PageFrame>
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
                  src={cloudinaryImage(profile.avatar, 'avatarLarge')}
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
                        {t('actions.edit')}
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
                      {followLoading
                        ? tCommon('status.loading')
                        : isFollowing
                          ? t('actions.following')
                          : t('actions.follow')}
                    </Button>
                  )}
                </Box>

                {/* Stats - one message each, so the count and its noun agree in both languages */}
                <Box sx={{ display: 'flex', gap: 4, mb: 2 }}>
                  <Typography variant="body2" sx={{ color: 'text.primary' }}>
                    {t.rich('stats.recipes', { count: stats.recipesCount, value: statCount })}
                  </Typography>
                  <Typography
                    variant="body2"
                    sx={{
                      color: 'text.primary',
                      cursor: 'pointer',
                      '&:hover': { opacity: 0.7 },
                      transition: 'opacity 0.2s',
                    }}
                    onClick={() => router.push(`/profile/${username}/followers`)}
                  >
                    {t.rich('stats.followers', { count: stats.followersCount, value: statCount })}
                  </Typography>
                  <Typography
                    variant="body2"
                    sx={{
                      color: 'text.primary',
                      cursor: 'pointer',
                      '&:hover': { opacity: 0.7 },
                      transition: 'opacity 0.2s',
                    }}
                    onClick={() => router.push(`/profile/${username}/following`)}
                  >
                    {t.rich('stats.following', { count: stats.followingCount, value: statCount })}
                  </Typography>
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
                        {bioExpanded ? tCommon('actions.showLess') : tCommon('actions.showMore')}
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
              { key: 0, label: t('tabs.recipes'), icon: <GridOn /> },
              // Both are about you, not about the profile being viewed, so neither shows
              // on someone else's.
              ...(isOwnProfile
                ? [
                    { key: 1, label: t('tabs.saved'), icon: <BookmarkBorder /> },
                    { key: 2, label: t('tabs.cooked'), icon: <Restaurant /> },
                  ]
                : []),
            ]}
            activeKey={activeTab}
            onChange={(key) => setActiveTab(key as number)}
          />
          {/* Tab Content with X-Axis Transition */}
          <Box sx={{ mt: 3 }}>
            <TabPanelTransition activeKey={activeTab}>
              {/* Recipe Grid */}
              {activeTab === 0 && (
                <Grid container spacing={{ xs: 2, sm: 2.5, md: 3 }}>
                  {recipes.length === 0 ? (
                    <Grid item xs={12}>
                      <Box sx={{ textAlign: 'center', py: 8 }}>
                        <Restaurant sx={{ fontSize: 80, color: 'text.secondary', mb: 2 }} />
                        <Typography variant="h6" color="text.secondary">
                          {t('empty.recipes')}
                        </Typography>
                        {isOwnProfile && (
                          <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                            {t('empty.recipesOwn')}
                          </Typography>
                        )}
                      </Box>
                    </Grid>
                  ) : (
                    recipes.map((recipe, index) => (
                      <Grid item xs={12} sm={6} md={4} key={recipe.id} sx={{ display: 'flex' }}>
                        <MotionBox
                          initial={{ opacity: 0, y: 20 }}
                          animate={{ opacity: 1, y: 0 }}
                          // Bounded, unlike the `Grow timeout={(index + 1) * 200}` it
                          // replaces — that made the twentieth card wait four seconds.
                          transition={{ delay: Math.min(index, 11) * 0.05 }}
                          sx={{ width: '100%' }}
                        >
                          <RecipeCard recipe={toCardModel(recipe)} viewer={recipe.viewer} />
                        </MotionBox>
                      </Grid>
                    ))
                  )}
                </Grid>
              )}

              {/* Saved Recipes Tab */}
              {activeTab === 1 && isOwnProfile && (
                <Grid container spacing={{ xs: 2, sm: 2.5, md: 3 }}>
                  {savedRecipes.length === 0 ? (
                    <Grid item xs={12}>
                      <Box sx={{ textAlign: 'center', py: 8 }}>
                        <BookmarkBorder sx={{ fontSize: 80, color: 'text.secondary', mb: 2 }} />
                        <Typography variant="h6" color="text.secondary">
                          {t('empty.saved')}
                        </Typography>
                        <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                          {t('empty.savedDescription')}
                        </Typography>
                      </Box>
                    </Grid>
                  ) : (
                    savedRecipes.map((recipe, index) => (
                      <Grid item xs={12} sm={6} md={4} key={recipe.id} sx={{ display: 'flex' }}>
                        <MotionBox
                          initial={{ opacity: 0, y: 20 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: Math.min(index, 11) * 0.05 }}
                          sx={{ width: '100%' }}
                        >
                          {/* The same card as the tab above it. Its only real difference
                              was the author byline, and "an absent field renders nothing"
                              covers that: the saved payload carries an author and the
                              owner's own recipes do not, so one component serves both and
                              the sixty duplicated lines go. */}
                          <RecipeCard recipe={toCardModel(recipe)} viewer={recipe.viewer} />
                        </MotionBox>
                      </Grid>
                    ))
                  )}
                </Grid>
              )}

              {activeTab === 2 && isOwnProfile && <CookingLog />}
            </TabPanelTransition>
          </Box>
        </PageFrame>

        {/* Edit Profile Modal */}
        <EditProfileModal
          open={editModalOpen}
          onClose={() => setEditModalOpen(false)}
          onSuccess={() => {
            loadProfile(); // Reload profile after editing
          }}
        />
      </>
    </motion.div>
  );
}
