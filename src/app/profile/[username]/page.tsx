'use client';

import {
  Settings,
  GridOn,
  BookmarkBorder,
  Restaurant,
  Edit as EditIcon,
  Link as LinkIcon,
  LockOutlined,
} from '@mui/icons-material';
import { Box, Typography, Avatar, Button, Grid, IconButton, Alert, Link } from '@mui/material';
import { motion } from 'framer-motion';
import NextLink from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import React, { useState } from 'react';
import PageFrame from '@/components/layout/PageFrame';
import { MotionBox } from '@/components/motion';
import CookingLog from '@/components/profile/CookingLog';
import EditProfileModal from '@/components/profile/EditProfileModal';
import FollowButton from '@/components/profile/FollowButton';
import ProfileSkeleton from '@/components/profile/ProfileSkeleton';
import RecipeCard, { type RecipeCardModel } from '@/components/recipe/RecipeCard';
import AnimatedTabs from '@/components/ui/AnimatedTabs';
import TabPanelTransition from '@/components/ui/TabPanelTransition';
import { useAuth } from '@/contexts/AuthContext';
import { useFollowProfile } from '@/hooks/useFollowProfile';
import { useProfile, ProfileFetchError, type ProfileRecipe } from '@/hooks/useProfile';
import { useLike, useSave } from '@/hooks/useViewerMutation';
import { cloudinaryImage } from '@/lib/utils/cloudinary';
import type { FollowAction } from '@/lib/follows/client/followAction';

/**
 * A profile recipe, narrowed to what a card shows.
 *
 * A pass-through now. `description`, the times and `servings` come across as they are,
 * and a `null` from the server stays absent on the card rather than being invented — the
 * card omits any slot it is not given, which is the whole convergence mechanism.
 */
const toCardModel = (recipe: ProfileRecipe): RecipeCardModel => ({
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

/** The big bold number inside a stat sentence; the message decides where it sits. */
const statCount = (chunks: React.ReactNode) => (
  <Typography variant="h6" component="span" sx={{ fontWeight: 700 }}>
    {chunks}
  </Typography>
);

/**
 * A follower or following count, which opens its list — but only where the list would
 * open.
 *
 * The locked view of a private account shows the counts (how many, never who), and its
 * lists are exactly as private as its recipes: the routes answer 403 to the same viewers.
 * A link there would lead to a lock one tap later, so on that view the sentence is plain
 * text and nothing suggests it can be opened.
 *
 * A real link where it does open, not a clickable paragraph: the paragraph it replaces
 * could not be reached from the keyboard and was announced as text.
 */
function StatLink({ href, children }: { href: string | null; children: React.ReactNode }) {
  if (href === null) return <>{children}</>;
  return (
    <Link
      component={NextLink}
      href={href}
      color="inherit"
      underline="none"
      sx={{ transition: 'opacity 0.2s', '&:hover': { opacity: 0.7 } }}
    >
      {children}
    </Link>
  );
}

export default function ProfilePage() {
  const t = useTranslations('profile');
  const tCommon = useTranslations('common');
  const params = useParams();
  const router = useRouter();
  const { user: currentUser, isAuthenticated } = useAuth();
  const username = params.username as string;

  const profileQuery = useProfile(username);
  const likeToggle = useLike();
  const saveToggle = useSave();
  const follow = useFollowProfile(username);

  const [activeTab, setActiveTab] = useState(0);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [bioExpanded, setBioExpanded] = useState(false);

  const isOwnProfile = currentUser?.username === username;
  const bioPreviewLength = 100;

  // The page no longer spells difficulty itself. It had its own key, `profile.difficulty`,
  // whose `other` arm named `{fallback}` rather than `{level}` and so required the value be
  // passed twice — which meant a profile could render a difficulty differently from the
  // recipe page showing the same recipe. One key now: `recipe.meta.difficulty`, inside
  // DifficultyChip.

  // Only without data. A background refetch that fails keeps the profile it already had
  // on screen rather than swapping a good page for an error.
  if (!profileQuery.data) {
    if (!profileQuery.isError) {
      return <ProfileSkeleton />;
    }

    const reason =
      profileQuery.error instanceof ProfileFetchError ? profileQuery.error.reason : 'loadFailed';
    return (
      <PageFrame width="reading">
        <Alert
          severity="error"
          sx={{ mb: 2 }}
          action={
            // Asking again cannot make a missing person exist, so only a failed load offers
            // to.
            reason === 'loadFailed' ? (
              <Button color="inherit" size="small" onClick={() => profileQuery.refetch()}>
                {tCommon('actions.retry')}
              </Button>
            ) : undefined
          }
        >
          {t(`errors.${reason}`)}
        </Alert>
        <Button onClick={() => router.push('/')}>{t('goHome')}</Button>
      </PageFrame>
    );
  }

  const profile = profileQuery.data;
  const { user, stats } = profile;
  // A private profile seen by someone else carries the person, the counts and the follow
  // state, and nothing of the recipes. Everything below that needs the recipes — the tabs,
  // the grids, and the links into the people lists — is behind this.
  const details = profile.visibility === 'public' ? profile : null;
  // Where the viewer stands. null — signed out, or your own profile — reads as 'none': a
  // signed-out reader sees "Seguir", and a tap on it goes to sign in.
  const followState = profile.followState ?? 'none';
  // The Saved tab is what you have saved NOW, read off each recipe's own bookmark rather
  // than off the list the server sent. Unsaving here empties that bookmark optimistically,
  // so the recipe leaves the tab the moment you tap — and a failed unsave puts the bookmark
  // back, which brings the recipe back with it. No second mutation to keep in step.
  const savedNow = (details?.savedRecipes ?? []).filter((recipe) => recipe.viewer?.saved !== false);

  const handleFollow = (action: FollowAction) => {
    if (!isAuthenticated) {
      router.push('/auth');
      return;
    }
    follow.act(action);
  };

  const likeRecipe = (recipeId: string) => likeToggle.toggle(recipeId);

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
                  src={cloudinaryImage(user.avatar ?? undefined, 'avatarLarge')}
                  sx={{
                    width: { xs: 100, sm: 150 },
                    height: { xs: 100, sm: 150 },
                    border: '3px solid',
                    borderColor: 'primary.main',
                  }}
                >
                  {user.username.charAt(0).toUpperCase()}
                </Avatar>
              </Box>

              {/* Profile Info */}
              <Box sx={{ flex: 1 }}>
                <Box
                  sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2, flexWrap: 'wrap' }}
                >
                  <Typography variant="h4" component="h1" sx={{ color: 'text.primary' }}>
                    {user.username}
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
                    // Everyone else gets the button, on both views. On the locked one it is
                    // the only way in: "Seguir" sends the request, "Solicitado" says one is
                    // waiting and takes it back when tapped. Signed out, it reads "Seguir"
                    // and leads to sign in (handleFollow).
                    <FollowButton
                      state={followState}
                      isPrivate={user.isPrivate}
                      name={user.username}
                      onAction={handleFollow}
                      size="small"
                    />
                  )}
                </Box>

                {/* Stats - one message each, so the count and its noun agree in both
                    languages. On both views: the locked one shows how many, and StatLink
                    decides whether the people behind the number can be opened. The count
                    is the cache's, so a follow moves it the moment it is tapped — and a
                    request, which is not a follower, does not. */}
                <Box sx={{ display: 'flex', gap: 4, mb: 2 }}>
                  <Typography variant="body2" sx={{ color: 'text.primary' }}>
                    {t.rich('stats.recipes', {
                      count: stats.recipesCount,
                      value: statCount,
                    })}
                  </Typography>
                  <Typography variant="body2" sx={{ color: 'text.primary' }}>
                    <StatLink href={details ? `/profile/${username}/followers` : null}>
                      {t.rich('stats.followers', {
                        count: stats.followersCount,
                        value: statCount,
                      })}
                    </StatLink>
                  </Typography>
                  <Typography variant="body2" sx={{ color: 'text.primary' }}>
                    <StatLink href={details ? `/profile/${username}/following` : null}>
                      {t.rich('stats.following', {
                        count: stats.followingCount,
                        value: statCount,
                      })}
                    </StatLink>
                  </Typography>
                </Box>

                {/* Bio */}
                {user.fullName && (
                  <Typography variant="subtitle1" sx={{ fontWeight: 600, color: 'text.primary' }}>
                    {user.fullName}
                  </Typography>
                )}
                {user.bio && (
                  <Box>
                    <Typography
                      variant="body2"
                      sx={{
                        mb: 1,
                        whiteSpace: 'pre-line',
                        color: 'text.primary',
                      }}
                    >
                      {bioExpanded || user.bio.length <= bioPreviewLength
                        ? user.bio
                        : `${user.bio.substring(0, bioPreviewLength)}...`}
                    </Typography>
                    {user.bio.length > bioPreviewLength && (
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
                {user.website && (
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                    <LinkIcon fontSize="small" color="action" />
                    <Typography
                      variant="body2"
                      component="a"
                      href={user.website}
                      target="_blank"
                      rel="noopener noreferrer"
                      sx={{
                        color: 'primary.main',
                        textDecoration: 'none',
                        '&:hover': { textDecoration: 'underline' },
                      }}
                    >
                      {user.website}
                    </Typography>
                  </Box>
                )}
              </Box>
            </Box>
          </MotionBox>

          {!details ? (
            // The locked view: a private account, and a viewer who does not follow it. What
            // it says under the lock follows the button above — "Seguí esta cuenta…" while
            // there is nothing to wait for (signed out reads as 'none' too), "Cuando acepte
            // tu solicitud…" once a request is out. It switches with the paint, before the
            // server answers, and back if the request fails. An accepted follower never
            // lands here: the route sends them the full view.
            <Box sx={{ textAlign: 'center', py: 8 }}>
              <LockOutlined sx={{ fontSize: 80, color: 'text.secondary', mb: 2 }} />
              <Typography variant="h6" color="text.secondary">
                {t('private.title')}
              </Typography>
              {/* Polite, so a screen reader that stays on the button — which only says
                  "Solicitado" — also hears what the request means. */}
              <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }} aria-live="polite">
                {t('private.body', { state: followState })}
              </Typography>
            </Box>
          ) : (
            <>
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
                      {details.recipes.length === 0 ? (
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
                        details.recipes.map((recipe, index) => (
                          <Grid item xs={12} sm={6} md={4} key={recipe.id} sx={{ display: 'flex' }}>
                            <MotionBox
                              initial={{ opacity: 0, y: 20 }}
                              animate={{ opacity: 1, y: 0 }}
                              // Bounded, unlike the `Grow timeout={(index + 1) * 200}` it
                              // replaces — that made the twentieth card wait four seconds.
                              transition={{ delay: Math.min(index, 11) * 0.05 }}
                              sx={{ width: '100%' }}
                            >
                              <RecipeCard
                                recipe={toCardModel(recipe)}
                                viewer={recipe.viewer}
                                onLike={() => likeRecipe(recipe.id)}
                                onSave={() => saveToggle.toggle(recipe.id)}
                              />
                            </MotionBox>
                          </Grid>
                        ))
                      )}
                    </Grid>
                  )}

                  {/* Saved Recipes Tab */}
                  {activeTab === 1 && isOwnProfile && (
                    <Grid container spacing={{ xs: 2, sm: 2.5, md: 3 }}>
                      {savedNow.length === 0 ? (
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
                        savedNow.map((recipe, index) => (
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
                              <RecipeCard
                                recipe={toCardModel(recipe)}
                                viewer={recipe.viewer}
                                onLike={() => likeRecipe(recipe.id)}
                                onSave={() => saveToggle.toggle(recipe.id)}
                              />
                            </MotionBox>
                          </Grid>
                        ))
                      )}
                    </Grid>
                  )}

                  {activeTab === 2 && isOwnProfile && <CookingLog />}
                </TabPanelTransition>
              </Box>
            </>
          )}
        </PageFrame>

        {/* Edit Profile Modal */}
        <EditProfileModal
          open={editModalOpen}
          onClose={() => setEditModalOpen(false)}
          onSuccess={() => {
            profileQuery.refetch(); // Reload profile after editing
          }}
        />
      </>
    </motion.div>
  );
}
