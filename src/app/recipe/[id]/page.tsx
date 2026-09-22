'use client';

import {
  ArrowBack,
  AccessTime,
  Restaurant,
  Person,
  Edit,
  Delete,
  Favorite,
  FavoriteBorder,
  Share,
  BookmarkBorder,
  Bookmark,
  Close,
  ZoomIn,
} from '@mui/icons-material';
import {
  Box,
  Typography,
  Chip,
  IconButton,
  Button,
  Divider,
  Avatar,
  CardContent,
  Alert,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  Snackbar,
  useTheme,
  useMediaQuery,
  Rating,
  Tooltip,
} from '@mui/material';
import { useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import NextLink from 'next/link';
import { useRouter, useParams } from 'next/navigation';
import { useFormatter, useTranslations } from 'next-intl';
import React, { useState, useCallback } from 'react';
import PageFrame from '@/components/layout/PageFrame';
import { MotionBox, MotionCard } from '@/components/motion';
import CommentsSection from '@/components/recipe/CommentsSection';
import CookConfirmDialog from '@/components/recipe/CookConfirmDialog';
import CaptionQuote from '@/components/recipe/display/CaptionQuote';
import DifficultyChip from '@/components/recipe/display/DifficultyChip';
import { StoredIngredient } from '@/components/recipe/display/displayFormat';
import IngredientLine from '@/components/recipe/display/IngredientLine';
import RecipeTimeStrip from '@/components/recipe/display/RecipeTimeStrip';
import StepNumber from '@/components/recipe/display/StepNumber';
import EditRecipeModal from '@/components/recipe/EditRecipeModal';
import RatingBreakdown from '@/components/recipe/RatingBreakdown';
import RecipeSkeleton from '@/components/recipe/RecipeSkeleton';
import { useAuth } from '@/contexts/AuthContext';
import { Recipe as DomainRecipe, DifficultyLevel } from '@/domain/types/recipe';
import { useRecipe, ApiRecipe, RecipeResponse, RecipeFetchError } from '@/hooks/useRecipe';
import { useLike, useSave } from '@/hooks/useViewerMutation';
import { useTextDescriptor } from '@/i18n/text';
import { useApiErrorMessage } from '@/lib/api/translateApiError';
import { removeRecipeEverywhere } from '@/lib/query/patchRecipeEverywhere';
import { cloudinaryImage, isCloudinaryUrl } from '@/lib/utils/cloudinary';
import { useTokens } from '@/theme/useTokens';
import type { PantryPlan } from '@/lib/cooking/pantryPlan';

/** Adapt the API recipe shape to the DomainRecipe type expected by EditRecipeModal. */
function toEditableRecipe(apiRecipe: ApiRecipe): DomainRecipe {
  const author =
    apiRecipe.author ??
    (apiRecipe.user
      ? {
          username: apiRecipe.user.username,
          fullName: apiRecipe.user.fullName ?? undefined,
          avatar: apiRecipe.user.avatar ?? undefined,
        }
      : undefined);

  return {
    id: apiRecipe.id,
    title: apiRecipe.title,
    description: apiRecipe.description,
    imageUrl: apiRecipe.imageUrl,
    userId: apiRecipe.userId,
    cookingTime: apiRecipe.cookingTime,
    prepTime: apiRecipe.prepTime,
    servings: apiRecipe.servings,
    difficulty: apiRecipe.difficulty as DifficultyLevel,
    ingredients: apiRecipe.ingredients.map(({ name, amount, unit }) => ({ name, amount, unit })),
    instructions: apiRecipe.instructions.map(({ step, description, image }) => ({
      step,
      description,
      image,
    })),
    caption: apiRecipe.caption,
    author,
    averageRating: apiRecipe.averageRating,
    totalRatings: apiRecipe.totalRatings,
    createdAt: new Date(apiRecipe.createdAt),
    updatedAt: new Date(apiRecipe.updatedAt),
  };
}

export default function RecipeDetailPage() {
  const t = useTranslations('recipe');
  const tCommon = useTranslations('common');
  const format = useFormatter();
  const renderText = useTextDescriptor();
  const apiErrorMessage = useApiErrorMessage();
  const router = useRouter();
  const params = useParams();
  const { user } = useAuth();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const tokens = useTokens();
  const queryClient = useQueryClient();

  const recipeId = params.id as string;

  // React Query hooks - with keepPreviousData for smooth transitions
  const { data: recipe, isLoading: loading, error: queryError } = useRecipe(recipeId);

  // Derived state from queries. A RecipeFetchError carries the message it wants printed
  // as a descriptor; anything else only has the English text it was thrown with.
  const error = queryError
    ? queryError instanceof RecipeFetchError
      ? renderText(queryError.descriptor)
      : queryError.message
    : null;
  const privateAuthor = queryError instanceof RecipeFetchError ? queryError.privateAuthor : null;

  // The heart, the count and the bookmark come with the recipe, so they are right on the
  // first paint. They used to be three pieces of local state seeded to false/0 and then
  // corrected by two extra requests, which is why they visibly flipped a moment after the
  // page appeared — and why a reload could leave them wrong.
  const liked = recipe?.viewer?.liked ?? false;
  const likeCount = recipe?.likeCount ?? 0;
  const saved = recipe?.viewer?.saved ?? false;
  const timesCooked = recipe?.viewer?.timesCooked ?? 0;
  const myRating = recipe?.viewer?.myRating ?? null;
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [snackbar, setSnackbar] = useState({
    open: false,
    message: '',
    severity: 'success' as 'success' | 'error' | 'warning',
  });
  const [cookedLoading, setCookedLoading] = useState(false);
  const [cookDialogOpen, setCookDialogOpen] = useState(false);
  const [cookPlan, setCookPlan] = useState<PantryPlan | null>(null);
  const [ratingLoading, setRatingLoading] = useState(false);
  const [imageViewerOpen, setImageViewerOpen] = useState(false);
  const [selectedImage, setSelectedImage] = useState<{ url: string; alt: string } | null>(null);

  const isOwner = user && recipe && user.id === recipe.userId;

  /**
   * Edit the cached recipe in place. `useRecipe` selects `data.recipe` out of the
   * response, so the cache holds the envelope and this has to reach inside it.
   */
  const patchCachedRecipe = useCallback(
    (update: (cached: ApiRecipe) => ApiRecipe) => {
      queryClient.setQueryData<RecipeResponse>(['recipe', recipeId], (previous) =>
        previous ? { ...previous, recipe: update(previous.recipe) } : previous
      );
    },
    [queryClient, recipeId]
  );

  /**
   * Set your score, or clear it by passing null. MUI's Rating sends null when you click
   * the star you already chose, which is the gesture people expect for undoing it.
   */
  const saveMyRating = async (value: number | null) => {
    try {
      setRatingLoading(true);
      const response = await fetch(`/api/recipes/${recipeId}/rating`, {
        method: value === null ? 'DELETE' : 'PUT',
        headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'fetch' },
        ...(value === null ? {} : { body: JSON.stringify({ rating: value }) }),
      });
      const data = await response.json();

      if (!response.ok) {
        setSnackbar({
          open: true,
          message: apiErrorMessage(data, t('toasts.ratingFailed')),
          severity: 'error',
        });
        return;
      }

      // The endpoint returns the recipe's new average alongside your score, so the two
      // never disagree on screen — your fifth star and the average that includes it.
      patchCachedRecipe((cached) => ({
        ...cached,
        averageRating: data.averageRating,
        totalRatings: data.reviewCount,
        ratingBreakdown: data.breakdown ?? cached.ratingBreakdown,
        viewer: cached.viewer ? { ...cached.viewer, myRating: data.myRating } : cached.viewer,
      }));

      setSnackbar({
        open: true,
        message: value === null ? t('toasts.ratingCleared') : t('toasts.rated'),
        severity: 'success',
      });
    } catch (error) {
      console.error('Error saving rating:', error);
      setSnackbar({ open: true, message: t('toasts.ratingFailed'), severity: 'error' });
    } finally {
      setRatingLoading(false);
    }
  };

  const handleBack = () => {
    router.back();
  };

  const handleEdit = () => {
    setEditModalOpen(true);
  };

  const handleEditSuccess = (_updatedRecipe: DomainRecipe) => {
    // No invalidation here: useUpdateRecipe refreshes this page and marks every list stale
    // itself, so no screen that edits a recipe can forget to.
    setSnackbar({ open: true, message: t('toasts.updated'), severity: 'success' });
  };

  const handleDelete = () => {
    setDeleteDialogOpen(true);
  };

  const confirmDelete = async () => {
    if (!user) return;

    try {
      setDeleting(true);
      const response = await fetch(`/api/recipes/${recipeId}`, {
        method: 'DELETE',
        headers: { 'X-Requested-With': 'fetch' },
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(apiErrorMessage(errorData, t('toasts.deleteFailed')));
      }

      // Out of the feed, the profiles, search and the matches before the reader lands on
      // any of them. It went nowhere before: the feed you arrived at still had it.
      removeRecipeEverywhere(queryClient, recipeId);

      setSnackbar({ open: true, message: t('toasts.deleted'), severity: 'success' });

      // Navigate back to feed after a short delay
      router.push('/');
    } catch (err) {
      console.error('Error deleting recipe:', err);
      setSnackbar({
        open: true,
        message: err instanceof Error ? err.message : t('toasts.deleteFailed'),
        severity: 'error',
      });
      setDeleteDialogOpen(false);
    } finally {
      setDeleting(false);
    }
  };

  // Liking and saving go through the one mutation layer now. What used to be here was
  // ninety lines: two handlers that waited for the server before moving anything, each
  // with an `if (response.ok)` and no else, so an expired session or a rate limit changed
  // nothing and said nothing. The policy that replaced them lives in
  // `lib/engagement/specs.ts`, and it is the same policy the feed will get — which is the
  // point. There is no second copy left to drift.
  const likeToggle = useLike();
  const saveToggle = useSave();

  const handleShare = async () => {
    const url = window.location.href;
    if (navigator.share) {
      try {
        await navigator.share({
          title: recipe?.title,
          text: recipe?.description,
          url,
        });
      } catch (err) {
        if ((err as Error).name !== 'AbortError') {
          // Fallback to clipboard on share failure (except user cancellation)
          if (navigator.clipboard && window.isSecureContext) {
            try {
              await navigator.clipboard.writeText(url);
              setSnackbar({
                open: true,
                message: t('toasts.linkCopied'),
                severity: 'success',
              });
            } catch {
              setSnackbar({ open: true, message: t('toasts.copyFailed'), severity: 'error' });
            }
          } else {
            setSnackbar({
              open: true,
              message: t('toasts.copyManually'),
              severity: 'warning',
            });
          }
        }
      }
    } else {
      if (navigator.clipboard && window.isSecureContext) {
        try {
          await navigator.clipboard.writeText(url);
          setSnackbar({ open: true, message: t('toasts.linkCopied'), severity: 'success' });
        } catch {
          setSnackbar({ open: true, message: t('toasts.copyFailed'), severity: 'error' });
        }
      } else {
        setSnackbar({
          open: true,
          message: t('toasts.copyManually'),
          severity: 'warning',
        });
      }
    }
  };

  const handleImageClick = (url: string, alt: string) => {
    setSelectedImage({ url, alt });
    setImageViewerOpen(true);
  };

  const handleImageViewerClose = () => {
    setImageViewerOpen(false);
    setTimeout(() => setSelectedImage(null), 300); // Clear after animation
  };

  // The `force` parameter is intentional UX: when a user doesn't have all ingredients
  // in their pantry, they are shown a confirmation dialog and can explicitly confirm
  // they want to mark the recipe as cooked anyway. This is a deliberate design choice,
  // not a security bypass. Rate limiting is handled by the middleware.
  /** Ask what cooking this would take out of the pantry, and show it before doing it. */
  const openCookDialog = async () => {
    if (!user) {
      setSnackbar({ open: true, message: t('toasts.loginToCook'), severity: 'error' });
      return;
    }

    try {
      setCookedLoading(true);
      const response = await fetch(`/api/recipes/${recipeId}/cook-plan`, {
        headers: { 'X-Requested-With': 'fetch' },
      });
      const data = await response.json();

      if (!response.ok) {
        setSnackbar({
          open: true,
          message: apiErrorMessage(data, t('toasts.cookFailed')),
          severity: 'error',
        });
        return;
      }

      setCookPlan(data.plan);
      setCookDialogOpen(true);
    } catch (error) {
      console.error('Error planning the cook:', error);
      setSnackbar({ open: true, message: t('toasts.cookFailed'), severity: 'error' });
    } finally {
      setCookedLoading(false);
    }
  };

  const confirmCook = async () => {
    try {
      setCookedLoading(true);
      const response = await fetch('/api/cooked-recipes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'fetch' },
        // `force` is honest here: the shortfall was on screen and the reader said yes.
        body: JSON.stringify({ postId: recipeId, force: true }),
      });
      const data = await response.json();

      if (!response.ok) {
        setSnackbar({
          open: true,
          message: apiErrorMessage(data, t('toasts.cookFailed')),
          severity: 'error',
        });
        return;
      }

      setCookDialogOpen(false);
      patchCachedRecipe((cached) => ({
        ...cached,
        viewer: cached.viewer
          ? {
              ...cached.viewer,
              timesCooked: data.timesCooked ?? cached.viewer.timesCooked + 1,
              lastCookedAt: new Date().toISOString(),
            }
          : cached.viewer,
      }));

      const missing = (data.shortfall ?? []).map((i: { name: string }) => i.name);
      setSnackbar({
        open: true,
        message: missing.length
          ? t('toasts.cookedShort', { names: missing.join(', ') })
          : t('toasts.cooked'),
        severity: 'success',
      });
    } catch (error) {
      console.error('Error marking recipe as cooked:', error);
      setSnackbar({ open: true, message: t('toasts.cookFailed'), severity: 'error' });
    } finally {
      setCookedLoading(false);
    }
  };

  /** Undo the most recent cook, putting the pantry back when it is still possible. */
  const undoCook = async () => {
    try {
      setCookedLoading(true);
      const response = await fetch(`/api/cooked-recipes?postId=${recipeId}`, {
        method: 'DELETE',
        headers: { 'X-Requested-With': 'fetch' },
      });
      const data = await response.json();

      if (!response.ok) {
        setSnackbar({
          open: true,
          message: apiErrorMessage(data, t('toasts.undoFailed')),
          severity: 'error',
        });
        return;
      }

      patchCachedRecipe((cached) => ({
        ...cached,
        viewer: cached.viewer
          ? { ...cached.viewer, timesCooked: Math.max(0, cached.viewer.timesCooked - 1) }
          : cached.viewer,
      }));

      setSnackbar({
        open: true,
        // Putting the pantry back is only possible for an hour, and saying so is the
        // difference between a clean undo and one that quietly left the pantry short.
        message: data.restorationSkipped ? t('toasts.cookUndoneNoRestore') : t('toasts.cookUndone'),
        severity: data.restorationSkipped ? 'warning' : 'success',
      });
    } catch (error) {
      console.error('Error undoing the cook:', error);
      setSnackbar({ open: true, message: t('toasts.undoFailed'), severity: 'error' });
    } finally {
      setCookedLoading(false);
    }
  };

  const totalTime = recipe ? recipe.prepTime + recipe.cookingTime : 0;

  // Page-level animation for smooth transitions
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: 'spring', stiffness: 300, damping: 30 }}
    >
      {/* The `pb: { xs: 10 }` here was clearance for the bottom bar, which the shell has
          owned since it was introduced; the two stacked. The background was repainted on
          top of the column that already had it. */}
      <>
        {/* The same skeleton the route's loading.tsx shows, so the hand-over is seamless.
            It used to be an empty box a screen tall: no shift, but nothing to look at. */}
        {loading && !recipe && <RecipeSkeleton />}

        {/* A private account's recipe: not an error, so not red, and it says where to go —
            the author's profile, where following them is (or will be) the way in. */}
        {privateAuthor && (
          <PageFrame width="reading">
            <Alert severity="info" sx={{ mb: { xs: 1.5, md: 2 } }}>
              {error}
            </Alert>
            <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
              <Button component={NextLink} href={`/profile/${privateAuthor}`} variant="contained">
                {t('states.viewAuthor')}
              </Button>
              <Button onClick={handleBack} startIcon={<ArrowBack />}>
                {tCommon('actions.goBack')}
              </Button>
            </Box>
          </PageFrame>
        )}

        {/* Error state */}
        {!privateAuthor && (error || (!loading && !recipe)) && (
          <PageFrame width="reading">
            <Alert
              severity="error"
              sx={{ mb: { xs: 1.5, md: 2 }, fontSize: { xs: '0.875rem', md: '1rem' } }}
            >
              {error || t('states.notFound')}
            </Alert>
            <Button
              onClick={handleBack}
              startIcon={<ArrowBack />}
              size={isMobile ? 'large' : 'medium'}
            >
              {tCommon('actions.goBack')}
            </Button>
          </PageFrame>
        )}

        {/* Recipe content */}
        {recipe && (
          <PageFrame sx={{ position: 'relative' }}>
            {/* Recipe Image */}
            <MotionBox
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4 }}
              sx={{
                position: 'relative',
                cursor: 'pointer',
                '&:hover .zoom-icon': { opacity: 1 },
                borderRadius: 2,
                overflow: 'hidden',
              }}
              onClick={() => handleImageClick(recipe.imageUrl, recipe.title)}
            >
              <Box
                component="img"
                // The cover, bounded rather than cropped. The full-size original is still
                // what the zoom viewer opens, which is the one place it is warranted.
                src={cloudinaryImage(recipe.imageUrl, 'hero')}
                alt={recipe.title}
                sx={{
                  width: '100%',
                  maxHeight: { xs: '300px', sm: '400px', md: '500px' },
                  objectFit: 'cover',
                  display: 'block',
                }}
              />
              <Box
                className="zoom-icon"
                sx={{
                  position: 'absolute',
                  top: 16,
                  right: 16,
                  // On the photo, not on the page: the scrim and its light ink are the
                  // same in both modes, which is what these two tokens are for.
                  backgroundColor: tokens.surface.overlay,
                  color: tokens.text.onOverlay,
                  borderRadius: '50%',
                  width: 40,
                  height: 40,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  opacity: 0,
                  transition: 'opacity 0.3s',
                }}
              >
                <ZoomIn />
              </Box>
            </MotionBox>

            {/* Recipe Header */}
            <MotionBox
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.1 }}
              sx={{ mt: { xs: 2, md: 3 } }}
            >
              {/* Title and Tags */}
              <Box sx={{ mb: { xs: 1.5, md: 2 } }}>
                <Typography
                  variant="h3"
                  component="h1"
                  gutterBottom
                  sx={{
                    fontWeight: 700,
                    color: 'text.primary',
                    fontSize: { xs: '1.75rem', sm: '2.25rem', md: '3rem' },
                  }}
                >
                  {recipe.title}
                </Typography>

                {/* Rating Display */}
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: { xs: 1.5, md: 2 } }}>
                  {recipe.averageRating !== undefined && recipe.averageRating > 0 ? (
                    <>
                      <Rating
                        value={recipe.averageRating}
                        precision={0.1}
                        size={isMobile ? 'medium' : 'large'}
                        readOnly
                      />
                      <Typography
                        variant="body1"
                        color="text.secondary"
                        sx={{ fontSize: { xs: '0.875rem', md: '1rem' } }}
                      >
                        {t('meta.ratingSummary', {
                          average: format.number(recipe.averageRating, {
                            minimumFractionDigits: 1,
                            maximumFractionDigits: 1,
                          }),
                          count: recipe.totalRatings ?? 0,
                        })}
                      </Typography>
                    </>
                  ) : (
                    <Typography variant="body2" color="text.secondary" sx={{ fontStyle: 'italic' }}>
                      {t('meta.noRatings')}
                    </Typography>
                  )}
                </Box>

                {recipe.ratingBreakdown && (
                  <RatingBreakdown
                    breakdown={recipe.ratingBreakdown}
                    total={recipe.totalRatings ?? 0}
                  />
                )}

                {/* Your own score, next to everyone else's. Rating used to be something
                    you could only do by writing a comment — there was no endpoint for it
                    and `viewer.myRating` travelled with every recipe unread. */}
                {user && (
                  <Box
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 1,
                      flexWrap: 'wrap',
                      mb: { xs: 1.5, md: 2 },
                    }}
                  >
                    <Typography variant="body2" color="text.secondary">
                      {t('meta.yourRating')}
                    </Typography>
                    <Rating
                      value={myRating}
                      size={isMobile ? 'medium' : 'large'}
                      disabled={ratingLoading}
                      onChange={(_event, value) => saveMyRating(value)}
                      aria-label={t('meta.yourRating')}
                    />
                    {myRating !== null && (
                      <Button
                        size="small"
                        onClick={() => saveMyRating(null)}
                        disabled={ratingLoading}
                      >
                        {t('actions.clearRating')}
                      </Button>
                    )}
                  </Box>
                )}

                <Box
                  sx={{
                    display: 'flex',
                    gap: { xs: 0.5, md: 1 },
                    flexWrap: 'wrap',
                    mb: { xs: 1.5, md: 2 },
                  }}
                >
                  <DifficultyChip
                    difficulty={recipe.difficulty}
                    size={isMobile ? 'small' : 'medium'}
                    sx={{ fontSize: { xs: '0.75rem', md: '0.8125rem' } }}
                  />
                  <Chip
                    icon={<Person sx={{ fontSize: { xs: '1rem', md: '1.25rem' } }} />}
                    label={t('meta.servings', { count: recipe.servings })}
                    variant="outlined"
                    size={isMobile ? 'small' : 'medium'}
                    sx={{ fontSize: { xs: '0.75rem', md: '0.8125rem' } }}
                  />
                  <Chip
                    icon={<AccessTime sx={{ fontSize: { xs: '1rem', md: '1.25rem' } }} />}
                    label={t('meta.totalTime', { minutes: totalTime })}
                    variant="outlined"
                    size={isMobile ? 'small' : 'medium'}
                    sx={{ fontSize: { xs: '0.75rem', md: '0.8125rem' } }}
                  />
                </Box>
              </Box>

              {/* Author Info */}
              {recipe.author && (
                <Box
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: { xs: 1.5, md: 2 },
                    mb: { xs: 2, md: 3 },
                    cursor: 'pointer',
                    '&:hover': {
                      opacity: 0.8,
                    },
                  }}
                  onClick={() => router.push(`/profile/${recipe.author?.username}`)}
                >
                  <Avatar
                    src={cloudinaryImage(recipe.author.avatar, 'avatar')}
                    alt={recipe.author.username}
                    sx={{ width: { xs: 40, md: 48 }, height: { xs: 40, md: 48 } }}
                  >
                    {recipe.author.username.charAt(0).toUpperCase()}
                  </Avatar>
                  <Box>
                    <Typography
                      variant="subtitle1"
                      sx={{
                        fontWeight: 600,
                        lineHeight: 1.2,
                        color: 'text.primary',
                        fontSize: { xs: '0.9375rem', md: '1rem' },
                      }}
                    >
                      {recipe.author.fullName || recipe.author.username}
                    </Typography>
                    <Typography
                      variant="body2"
                      color="text.secondary"
                      sx={{ fontSize: { xs: '0.8125rem', md: '0.875rem' } }}
                    >
                      @{recipe.author.username}
                    </Typography>
                  </Box>
                </Box>
              )}

              {/* Description */}
              <Typography
                variant="body1"
                color="text.secondary"
                paragraph
                sx={{
                  fontSize: { xs: '0.9375rem', sm: '1rem', md: '1.1rem' },
                  // Line breaks typed by the author survive
                  whiteSpace: 'pre-line',
                }}
              >
                {recipe.description}
              </Typography>

              {/* Action Buttons */}
              <Box
                sx={{
                  display: 'flex',
                  gap: { xs: 1, md: 2 },
                  my: { xs: 2, md: 3 },
                  alignItems: 'center',
                  flexWrap: 'wrap',
                }}
              >
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                  {/* No `disabled` while the request is in flight, and that is the change
                      rather than an omission: the heart has already moved, so greying it
                      out would be telling the reader to wait for something that already
                      happened. A second tap simply sends the state they now want — the
                      route takes an intent, not a flip, so it cannot oscillate. */}
                  <IconButton
                    onClick={() => likeToggle.toggle(recipeId)}
                    color={liked ? 'error' : 'default'}
                    size={isMobile ? 'medium' : 'large'}
                  >
                    {liked ? <Favorite /> : <FavoriteBorder />}
                  </IconButton>
                  {likeCount > 0 && (
                    <Typography
                      variant="body2"
                      fontWeight={600}
                      sx={{ color: 'text.primary', fontSize: { xs: '0.875rem', md: '1rem' } }}
                    >
                      {likeCount}
                    </Typography>
                  )}
                </Box>
                <IconButton
                  onClick={() => saveToggle.toggle(recipeId)}
                  color={saved ? 'primary' : 'default'}
                  size={isMobile ? 'medium' : 'large'}
                >
                  {saved ? <Bookmark /> : <BookmarkBorder />}
                </IconButton>
                {!isMobile && (
                  <IconButton onClick={handleShare} size="large">
                    <Share />
                  </IconButton>
                )}
                {/* The button used to read "Mark as Cooked" whether you had cooked this
                    nought times or ten — the count was queried on every request and
                    rendered nowhere. It says which now, and offers the other move. */}
                <Button
                  variant={timesCooked > 0 ? 'contained' : 'outlined'}
                  startIcon={<Restaurant />}
                  onClick={openCookDialog}
                  disabled={cookedLoading}
                  size={isMobile ? 'medium' : 'large'}
                  fullWidth={isMobile}
                >
                  {cookedLoading
                    ? t('actions.marking')
                    : timesCooked > 0
                      ? t('actions.cookAgain')
                      : t('actions.markAsCooked')}
                </Button>
                {isOwner && (
                  <>
                    {/* Icon-only: the name is the aria-label, the Tooltip shows it. The hover
                        ink is the palette's contrast colour - dark on the dark theme's teal */}
                    <Tooltip title={t('actions.edit')}>
                      <IconButton
                        onClick={handleEdit}
                        color="primary"
                        aria-label={t('actions.edit')}
                        size={isMobile ? 'medium' : 'large'}
                        sx={{
                          border: 1,
                          borderColor: 'primary.main',
                          '&:hover': {
                            backgroundColor: 'primary.main',
                            color: 'primary.contrastText',
                            '& .MuiSvgIcon-root': {
                              color: 'primary.contrastText',
                            },
                          },
                        }}
                      >
                        <Edit />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title={t('actions.delete')}>
                      <IconButton
                        onClick={handleDelete}
                        color="error"
                        aria-label={t('actions.delete')}
                        size={isMobile ? 'medium' : 'large'}
                        sx={{
                          border: 1,
                          borderColor: 'error.main',
                          '&:hover': {
                            backgroundColor: 'error.main',
                            color: 'error.contrastText',
                            '& .MuiSvgIcon-root': {
                              color: 'error.contrastText',
                            },
                          },
                        }}
                      >
                        <Delete />
                      </IconButton>
                    </Tooltip>
                  </>
                )}
              </Box>

              {/* Your own cooking history with this recipe. It was recorded from the start
                  — soft-deletable, with a pantry restore window — and never shown. */}
              {timesCooked > 0 && (
                <Box
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    flexWrap: 'wrap',
                    gap: 1,
                    mt: 1.5,
                  }}
                >
                  <Typography variant="body2" color="text.secondary">
                    {timesCooked === 1
                      ? t('actions.cookedOnce')
                      : t('actions.cookedTimes', { count: timesCooked })}
                  </Typography>
                  <Button size="small" onClick={undoCook} disabled={cookedLoading}>
                    {t('actions.undoCook')}
                  </Button>
                </Box>
              )}

              <Divider sx={{ my: { xs: 2, md: 3 } }} />

              {/* Time Breakdown */}
              <RecipeTimeStrip
                prepTime={recipe.prepTime}
                cookingTime={recipe.cookingTime}
                sx={{
                  mb: { xs: 2, md: 3 },
                  // This page's type scale; the block itself uses the theme defaults
                  '& .MuiTypography-caption': { fontSize: { xs: '0.7rem', md: '0.75rem' } },
                  '& .MuiTypography-h6': { fontSize: { xs: '1.125rem', md: '1.25rem' } },
                }}
              />
            </MotionBox>

            {/* Ingredients Section */}
            <MotionCard
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.2 }}
              sx={{ mb: 3 }}
            >
              <CardContent>
                <Typography variant="h5" gutterBottom sx={{ fontWeight: 600, mb: 3 }}>
                  {t('ingredients.title')}
                </Typography>
                <Box component="ul" sx={{ pl: 2 }}>
                  {/* Seeded and legacy rows store numeric amounts: IngredientLine coerces them */}
                  {recipe.ingredients.map((ingredient: StoredIngredient, index: number) => (
                    <IngredientLine key={index} ingredient={ingredient} />
                  ))}
                </Box>
              </CardContent>
            </MotionCard>

            {/* Instructions Section */}
            <MotionCard
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.3 }}
              sx={{ mb: 3 }}
            >
              <CardContent>
                <Typography variant="h5" gutterBottom sx={{ fontWeight: 600, mb: 3 }}>
                  {t('instructions.title')}
                </Typography>
                <Box>
                  {recipe.instructions.map(
                    (
                      instruction: { step: number; description: string; image?: string },
                      index: number
                    ) => (
                      <Box key={index} sx={{ mb: 3, display: 'flex', gap: 2 }}>
                        <StepNumber
                          number={instruction.step}
                          responsive={false}
                          decorative={false}
                        />
                        <Box sx={{ flex: 1 }}>
                          <Typography
                            variant="body1"
                            sx={{ lineHeight: 1.8, whiteSpace: 'pre-line' }}
                          >
                            {instruction.description}
                          </Typography>
                          {instruction.image && isCloudinaryUrl(instruction.image) && (
                            <Box
                              sx={{
                                position: 'relative',
                                maxWidth: 400,
                                cursor: 'pointer',
                                '&:hover .zoom-icon': { opacity: 1 },
                              }}
                              onClick={() =>
                                handleImageClick(
                                  instruction.image!,
                                  t('instructions.stepAlt', { number: instruction.step })
                                )
                              }
                            >
                              <Box
                                component="img"
                                src={instruction.image}
                                alt={t('instructions.stepAlt', { number: instruction.step })}
                                sx={{
                                  width: '100%',
                                  borderRadius: 2,
                                  mt: 2,
                                }}
                              />
                              <Box
                                className="zoom-icon"
                                sx={{
                                  position: 'absolute',
                                  top: 24,
                                  right: 8,
                                  // Over the step photo, like the cover's zoom icon
                                  backgroundColor: tokens.surface.overlay,
                                  color: tokens.text.onOverlay,
                                  borderRadius: '50%',
                                  width: 32,
                                  height: 32,
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  opacity: 0,
                                  transition: 'opacity 0.3s',
                                }}
                              >
                                <ZoomIn sx={{ fontSize: 20 }} />
                              </Box>
                            </Box>
                          )}
                        </Box>
                      </Box>
                    )
                  )}
                </Box>
              </CardContent>
            </MotionCard>

            {/* Caption Section (if exists) */}
            {recipe.caption && (
              <MotionBox
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.4 }}
                sx={{ mb: 3 }}
              >
                <CaptionQuote caption={recipe.caption} />
              </MotionBox>
            )}

            {/* Comments Section */}
            <MotionBox
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.5 }}
            >
              <CommentsSection
                recipeId={recipeId}
                recipeAuthorId={recipe.userId}
                onImageClick={handleImageClick}
                myRating={myRating}
              />
            </MotionBox>
          </PageFrame>
        )}

        {/* Edit Recipe Modal */}
        <EditRecipeModal
          open={editModalOpen}
          recipe={recipe ? toEditableRecipe(recipe) : null}
          onClose={() => setEditModalOpen(false)}
          onSuccess={handleEditSuccess}
        />

        {/* Delete Confirmation Dialog */}
        <Dialog open={deleteDialogOpen} onClose={() => !deleting && setDeleteDialogOpen(false)}>
          <DialogTitle>{t('deleteDialog.title')}</DialogTitle>
          <DialogContent>
            <DialogContentText>
              {t('deleteDialog.message', { title: recipe?.title ?? '' })}
            </DialogContentText>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setDeleteDialogOpen(false)} disabled={deleting}>
              {tCommon('actions.cancel')}
            </Button>
            <Button onClick={confirmDelete} color="error" disabled={deleting} autoFocus>
              {deleting ? tCommon('status.deleting') : tCommon('actions.delete')}
            </Button>
          </DialogActions>
        </Dialog>

        <CookConfirmDialog
          open={cookDialogOpen}
          plan={cookPlan}
          busy={cookedLoading}
          onCancel={() => setCookDialogOpen(false)}
          onConfirm={confirmCook}
        />

        {/* Snackbar for notifications */}
        <Snackbar
          open={snackbar.open}
          autoHideDuration={6000}
          onClose={() => setSnackbar({ ...snackbar, open: false })}
        >
          <Alert
            severity={snackbar.severity}
            onClose={() => setSnackbar({ ...snackbar, open: false })}
          >
            {snackbar.message}
          </Alert>
        </Snackbar>

        {/* Fullscreen Image Viewer */}
        <Dialog
          open={imageViewerOpen}
          onClose={handleImageViewerClose}
          maxWidth={false}
          fullWidth
          onClick={handleImageViewerClose}
          slotProps={{
            backdrop: {
              sx: {
                // No colour here any more: the theme's backdrop is the scrim. Only the
                // blur and the click-to-close cursor are particular to this viewer.
                backdropFilter: 'blur(8px)',
                cursor: 'pointer',
              },
            },
            paper: {
              sx: {
                backgroundColor: 'transparent',
                boxShadow: 'none',
                // The theme gives dialog papers a border and a radius; this one is a
                // transparent frame around a photo and wants neither.
                border: 'none',
                borderRadius: 0,
                margin: 0,
                // 100% of the Dialog's fixed container, so the viewer never exceeds the
                // usable width; 100vw includes the scrollbar and overflowed by 8px
                maxWidth: '100%',
                maxHeight: '100vh',
                height: '100vh',
                pointerEvents: 'none',
              },
            },
          }}
        >
          <IconButton
            onClick={handleImageViewerClose}
            sx={{
              position: 'absolute',
              top: { xs: 72, sm: 16 },
              right: { xs: 16, sm: 16 },
              // Sits on the scrim over the photo, so the ink stays light in both modes
              color: tokens.text.onOverlay,
              // A translucent white wash for chrome resting on a photo. Not a token: it
              // is the same in both modes by definition, and the token layer has no name
              // for "slightly lighter than whatever is behind me". ImageUpload keeps two
              // of these for the same reason — if a third turns up, it earns a token.
              backgroundColor: 'rgba(255, 255, 255, 0.1)',
              '&:hover': {
                backgroundColor: 'rgba(255, 255, 255, 0.2)',
              },
              zIndex: 1,
            }}
          >
            <Close />
          </IconButton>
          {selectedImage && (
            <Box
              sx={{
                width: '100%',
                height: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                p: { xs: 2, md: 4 },
              }}
            >
              <Box
                component="img"
                src={selectedImage.url}
                alt={selectedImage.alt}
                sx={{
                  maxWidth: '100%',
                  maxHeight: '100%',
                  objectFit: 'contain',
                }}
              />
            </Box>
          )}
        </Dialog>
      </>
    </motion.div>
  );
}
