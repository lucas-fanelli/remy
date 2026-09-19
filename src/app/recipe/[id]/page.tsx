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
  Container,
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
  Toolbar,
  useTheme,
  useMediaQuery,
  Rating,
  Tooltip,
} from '@mui/material';
import { useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { useRouter, useParams } from 'next/navigation';
import React, { useState, useEffect } from 'react';
import { MotionBox, MotionCard } from '@/components/motion';
import CommentsSection from '@/components/recipe/CommentsSection';
import CaptionQuote from '@/components/recipe/display/CaptionQuote';
import DifficultyChip from '@/components/recipe/display/DifficultyChip';
import { StoredIngredient } from '@/components/recipe/display/displayFormat';
import IngredientLine from '@/components/recipe/display/IngredientLine';
import RecipeTimeStrip from '@/components/recipe/display/RecipeTimeStrip';
import StepNumber from '@/components/recipe/display/StepNumber';
import EditRecipeModal from '@/components/recipe/EditRecipeModal';
import { useAuth } from '@/contexts/AuthContext';
import { Recipe as DomainRecipe, DifficultyLevel } from '@/domain/types/recipe';
import { useRecipe, useRecipeLikeStatus, useRecipeSaveStatus, ApiRecipe } from '@/hooks/useRecipe';
import { isCloudinaryUrl } from '@/lib/utils/cloudinary';

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
  const router = useRouter();
  const params = useParams();
  const { user } = useAuth();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const queryClient = useQueryClient();

  const recipeId = params.id as string;

  // React Query hooks - with keepPreviousData for smooth transitions
  const { data: recipe, isLoading: loading, error: queryError } = useRecipe(recipeId);
  const { data: likeStatus } = useRecipeLikeStatus(recipeId, user?.id ?? null);
  const { data: saveStatus } = useRecipeSaveStatus(recipeId, user?.id ?? null);

  // Derived state from queries
  const error = queryError?.message || null;

  // Local state for mutations and UI
  const [liked, setLiked] = useState(likeStatus?.liked ?? false);
  const [likesCount, setLikesCount] = useState(likeStatus?.likesCount ?? 0);
  const [saved, setSaved] = useState(saveStatus?.saved ?? false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [snackbar, setSnackbar] = useState({
    open: false,
    message: '',
    severity: 'success' as 'success' | 'error' | 'warning',
  });
  const [likeLoading, setLikeLoading] = useState(false);
  const [saveLoading, setSaveLoading] = useState(false);
  const [cookedLoading, setCookedLoading] = useState(false);
  const [forceDialogOpen, setForceDialogOpen] = useState(false);
  const [insufficientList, setInsufficientList] = useState<
    Array<{ name: string; required: number; available: number; unit: string }>
  >([]);
  const [imageViewerOpen, setImageViewerOpen] = useState(false);
  const [selectedImage, setSelectedImage] = useState<{ url: string; alt: string } | null>(null);

  const isOwner = user && recipe && user.id === recipe.userId;

  // Sync like/save status from query to local state
  useEffect(() => {
    if (likeStatus) {
      setLiked(likeStatus.liked);
      setLikesCount(likeStatus.likesCount);
    }
  }, [likeStatus]);

  useEffect(() => {
    if (saveStatus) {
      setSaved(saveStatus.saved);
    }
  }, [saveStatus]);

  const handleBack = () => {
    router.back();
  };

  const handleEdit = () => {
    setEditModalOpen(true);
  };

  const handleEditSuccess = (_updatedRecipe: DomainRecipe) => {
    // Invalidate the cache to refetch with updated data
    queryClient.invalidateQueries({ queryKey: ['recipe', recipeId] });
    setSnackbar({ open: true, message: 'Recipe updated successfully!', severity: 'success' });
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
        throw new Error(errorData.error || 'Failed to delete recipe');
      }

      setSnackbar({ open: true, message: 'Recipe deleted successfully!', severity: 'success' });

      // Navigate back to feed after a short delay
      router.push('/');
    } catch (err) {
      console.error('Error deleting recipe:', err);
      setSnackbar({
        open: true,
        message: err instanceof Error ? err.message : 'Failed to delete recipe',
        severity: 'error',
      });
      setDeleteDialogOpen(false);
    } finally {
      setDeleting(false);
    }
  };

  const handleLike = async () => {
    if (!user) {
      setSnackbar({ open: true, message: 'Please login to like recipes', severity: 'error' });
      return;
    }

    try {
      setLikeLoading(true);
      const response = await fetch(`/api/recipes/${recipeId}/like`, {
        method: 'POST',
        headers: { 'X-Requested-With': 'fetch' },
      });

      if (response.ok) {
        const data = await response.json();
        setLiked(data.liked);
        setLikesCount(data.likesCount);
        setSnackbar({
          open: true,
          message: data.liked ? 'Recipe liked!' : 'Recipe unliked',
          severity: 'success',
        });
      }
    } catch (error) {
      console.error('Error toggling like:', error);
      setSnackbar({ open: true, message: 'Failed to like recipe', severity: 'error' });
    } finally {
      setLikeLoading(false);
    }
  };

  const handleSave = async () => {
    if (!user) {
      setSnackbar({ open: true, message: 'Please login to save recipes', severity: 'error' });
      return;
    }

    try {
      setSaveLoading(true);
      const response = await fetch(`/api/recipes/${recipeId}/save`, {
        method: 'POST',
        headers: { 'X-Requested-With': 'fetch' },
      });

      if (response.ok) {
        const data = await response.json();
        setSaved(data.saved);
        setSnackbar({
          open: true,
          message: data.saved ? 'Recipe saved!' : 'Recipe removed from saved',
          severity: 'success',
        });
      }
    } catch (error) {
      console.error('Error toggling save:', error);
      setSnackbar({ open: true, message: 'Failed to save recipe', severity: 'error' });
    } finally {
      setSaveLoading(false);
    }
  };

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
                message: 'Link copied to clipboard!',
                severity: 'success',
              });
            } catch {
              setSnackbar({ open: true, message: 'Failed to copy link', severity: 'error' });
            }
          } else {
            setSnackbar({
              open: true,
              message: 'Cannot copy link — please copy the URL manually',
              severity: 'warning',
            });
          }
        }
      }
    } else {
      if (navigator.clipboard && window.isSecureContext) {
        try {
          await navigator.clipboard.writeText(url);
          setSnackbar({ open: true, message: 'Link copied to clipboard!', severity: 'success' });
        } catch {
          setSnackbar({ open: true, message: 'Failed to copy link', severity: 'error' });
        }
      } else {
        setSnackbar({
          open: true,
          message: 'Cannot copy link — please copy the URL manually',
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
  const sendCookRequest = async (force = false) => {
    const response = await fetch('/api/cooked-recipes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'fetch' },
      body: JSON.stringify({ postId: recipeId, ...(force && { force: true }) }),
    });

    return { response, data: await response.json() };
  };

  const handleMarkAsCooked = async () => {
    if (!user) {
      setSnackbar({
        open: true,
        message: 'Please login to mark recipes as cooked',
        severity: 'error',
      });
      return;
    }

    try {
      setCookedLoading(true);
      const { response, data } = await sendCookRequest();

      if (response.ok) {
        // Invalidate the recipe cache so rating updates from cooking are reflected
        try {
          queryClient.invalidateQueries({ queryKey: ['recipe', recipeId] });
        } catch {
          /* best-effort */
        }

        if (data.insufficientIngredients && data.insufficientIngredients.length > 0) {
          const names = data.insufficientIngredients
            .map((i: { name: string }) => i.name)
            .join(', ');
          setSnackbar({
            open: true,
            message: `Recipe marked as cooked! Note: insufficient pantry stock for: ${names}`,
            severity: 'success',
          });
        } else {
          setSnackbar({
            open: true,
            message: 'Recipe marked as cooked!',
            severity: 'success',
          });
        }
      } else if (response.status === 409 && data.insufficientIngredients) {
        setInsufficientList(data.insufficientIngredients);
        setForceDialogOpen(true);
      } else {
        setSnackbar({
          open: true,
          message: data.error || 'Failed to mark recipe as cooked',
          severity: 'error',
        });
      }
    } catch (error) {
      console.error('Error marking recipe as cooked:', error);
      setSnackbar({ open: true, message: 'Failed to mark recipe as cooked', severity: 'error' });
    } finally {
      setCookedLoading(false);
    }
  };

  const handleForceConfirm = async () => {
    setForceDialogOpen(false);
    try {
      setCookedLoading(true);
      const { response, data } = await sendCookRequest(true);
      if (response.ok) {
        try {
          queryClient.invalidateQueries({ queryKey: ['recipe', recipeId] });
        } catch {
          /* best-effort */
        }
        setSnackbar({ open: true, message: 'Recipe marked as cooked!', severity: 'success' });
      } else {
        setSnackbar({
          open: true,
          message: data.error || 'Failed to mark recipe as cooked',
          severity: 'error',
        });
      }
    } catch (error) {
      console.error('Error marking recipe as cooked:', error);
      setSnackbar({ open: true, message: 'Failed to mark recipe as cooked', severity: 'error' });
    } finally {
      setCookedLoading(false);
      setInsufficientList([]);
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
      <Box
        sx={{
          minHeight: '100vh',
          pb: { xs: 10, sm: 11, md: 4 },
          backgroundColor: 'background.default',
        }}
      >
        {/* Spacer for fixed AppBar - Material Design pattern */}
        <Toolbar />

        {/* Loading state - inside MotionBox for animation */}
        {loading && !recipe && (
          <Box sx={{ minHeight: 'calc(100vh - 64px)' }}>
            {/* Empty space with same structure to prevent layout shift */}
          </Box>
        )}

        {/* Error state */}
        {(error || (!loading && !recipe)) && (
          <Container maxWidth="md" sx={{ py: { xs: 3, md: 4 }, px: { xs: 2, md: 3 } }}>
            <Alert
              severity="error"
              sx={{ mb: { xs: 1.5, md: 2 }, fontSize: { xs: '0.875rem', md: '1rem' } }}
            >
              {error || 'Recipe not found'}
            </Alert>
            <Button
              onClick={handleBack}
              startIcon={<ArrowBack />}
              size={isMobile ? 'large' : 'medium'}
            >
              Go Back
            </Button>
          </Container>
        )}

        {/* Recipe content */}
        {recipe && (
          <Container
            maxWidth="lg"
            sx={{ pt: { xs: 1, md: 2 }, px: { xs: 2, md: 3 }, position: 'relative' }}
          >
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
                src={recipe.imageUrl}
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
                  backgroundColor: 'rgba(0, 0, 0, 0.6)',
                  color: 'white',
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
                        {recipe.averageRating.toFixed(1)} ({recipe.totalRatings}{' '}
                        {recipe.totalRatings === 1 ? 'review' : 'reviews'})
                      </Typography>
                    </>
                  ) : (
                    <Typography variant="body2" color="text.secondary" sx={{ fontStyle: 'italic' }}>
                      No ratings yet
                    </Typography>
                  )}
                </Box>

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
                    label={`${recipe.servings} servings`}
                    variant="outlined"
                    size={isMobile ? 'small' : 'medium'}
                    sx={{ fontSize: { xs: '0.75rem', md: '0.8125rem' } }}
                  />
                  <Chip
                    icon={<AccessTime sx={{ fontSize: { xs: '1rem', md: '1.25rem' } }} />}
                    label={`${totalTime} min total`}
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
                    src={recipe.author.avatar}
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
                  <IconButton
                    onClick={handleLike}
                    color={liked ? 'error' : 'default'}
                    size={isMobile ? 'medium' : 'large'}
                    disabled={likeLoading}
                  >
                    {liked ? <Favorite /> : <FavoriteBorder />}
                  </IconButton>
                  {likesCount > 0 && (
                    <Typography
                      variant="body2"
                      fontWeight={600}
                      sx={{ color: 'text.primary', fontSize: { xs: '0.875rem', md: '1rem' } }}
                    >
                      {likesCount}
                    </Typography>
                  )}
                </Box>
                <IconButton
                  onClick={handleSave}
                  color={saved ? 'primary' : 'default'}
                  size={isMobile ? 'medium' : 'large'}
                  disabled={saveLoading}
                >
                  {saved ? <Bookmark /> : <BookmarkBorder />}
                </IconButton>
                {!isMobile && (
                  <IconButton onClick={handleShare} size="large">
                    <Share />
                  </IconButton>
                )}
                <Button
                  variant="outlined"
                  startIcon={<Restaurant />}
                  onClick={handleMarkAsCooked}
                  disabled={cookedLoading}
                  size={isMobile ? 'medium' : 'large'}
                  fullWidth={isMobile}
                >
                  {cookedLoading ? 'Marking...' : 'Mark as Cooked'}
                </Button>
                {isOwner && (
                  <>
                    {/* Icon-only: the name is the aria-label, the Tooltip shows it. The hover
                        ink is the palette's contrast colour - dark on the dark theme's teal */}
                    <Tooltip title="Edit recipe">
                      <IconButton
                        onClick={handleEdit}
                        color="primary"
                        aria-label="Edit recipe"
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
                    <Tooltip title="Delete recipe">
                      <IconButton
                        onClick={handleDelete}
                        color="error"
                        aria-label="Delete recipe"
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
                  Ingredients
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
                  Instructions
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
                                handleImageClick(instruction.image!, `Step ${instruction.step}`)
                              }
                            >
                              <Box
                                component="img"
                                src={instruction.image}
                                alt={`Step ${instruction.step}`}
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
                                  backgroundColor: 'rgba(0, 0, 0, 0.6)',
                                  color: 'white',
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
              />
            </MotionBox>
          </Container>
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
          <DialogTitle>Delete Recipe?</DialogTitle>
          <DialogContent>
            <DialogContentText>
              Are you sure you want to delete &ldquo;{recipe?.title}&rdquo;? This action cannot be
              undone.
            </DialogContentText>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setDeleteDialogOpen(false)} disabled={deleting}>
              Cancel
            </Button>
            <Button onClick={confirmDelete} color="error" disabled={deleting} autoFocus>
              {deleting ? 'Deleting...' : 'Delete'}
            </Button>
          </DialogActions>
        </Dialog>

        {/* Insufficient Ingredients Confirmation Dialog */}
        <Dialog open={forceDialogOpen} onClose={() => setForceDialogOpen(false)}>
          <DialogTitle>Insufficient Ingredients</DialogTitle>
          <DialogContent>
            <DialogContentText>
              The following ingredients are insufficient in your pantry:
            </DialogContentText>
            <Box component="ul" sx={{ mt: 1, pl: 2 }}>
              {insufficientList.map((item, idx) => (
                <li key={idx}>
                  <Typography variant="body2">
                    {item.name}: need {item.required} {item.unit}, have {item.available} {item.unit}
                  </Typography>
                </li>
              ))}
            </Box>
            <DialogContentText sx={{ mt: 1 }}>
              Do you want to mark this recipe as cooked anyway?
            </DialogContentText>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setForceDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleForceConfirm} variant="contained" disabled={cookedLoading}>
              {cookedLoading ? 'Marking...' : 'Cook Anyway'}
            </Button>
          </DialogActions>
        </Dialog>

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
                backgroundColor: 'rgba(0, 0, 0, 0.7)',
                backdropFilter: 'blur(8px)',
                cursor: 'pointer',
              },
            },
            paper: {
              sx: {
                backgroundColor: 'transparent',
                boxShadow: 'none',
                margin: 0,
                maxWidth: '100vw',
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
              color: 'white',
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
      </Box>
    </motion.div>
  );
}
