'use client';

// Force dynamic rendering for this page
export const dynamic = 'force-dynamic';

import React, { useState, useEffect, useCallback } from 'react';
import {
  Container,
  Box,
  Typography,
  Chip,
  IconButton,
  Button,
  Divider,
  Avatar,
  Card,
  CardContent,
  Alert,
  Paper,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  Snackbar,
  Toolbar,
  Skeleton,
  useTheme,
  useMediaQuery,
  Rating,
} from '@mui/material';
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
import { useRouter, useParams } from 'next/navigation';
import { motion } from 'framer-motion';
import { Recipe } from '@/domain/types/recipe';
import { useAuth } from '@/contexts/AuthContext';
import EditRecipeModal from '@/components/recipe/EditRecipeModal';
import CommentsSection from '@/components/recipe/CommentsSection';

const MotionBox = motion.create(Box);
const MotionCard = motion.create(Card);

export default function RecipeDetailPage() {
  const router = useRouter();
  const params = useParams();
  const { user, token } = useAuth();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const isTablet = useMediaQuery(theme.breakpoints.down('md'));
  const [recipe, setRecipe] = useState<Recipe | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [liked, setLiked] = useState(false);
  const [likesCount, setLikesCount] = useState(0);
  const [saved, setSaved] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' as 'success' | 'error' });
  const [likeLoading, setLikeLoading] = useState(false);
  const [saveLoading, setSaveLoading] = useState(false);
  const [cookedLoading, setCookedLoading] = useState(false);
  const [imageViewerOpen, setImageViewerOpen] = useState(false);
  const [selectedImage, setSelectedImage] = useState<{ url: string; alt: string } | null>(null);

  const recipeId = params.id as string;
  const isOwner = user && recipe && user.id === recipe.userId;

  const loadRecipe = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch(`/api/recipes/${recipeId}`);

      if (!response.ok) {
        if (response.status === 404) {
          throw new Error('Recipe not found');
        }
        throw new Error('Failed to load recipe');
      }

      const data = await response.json();
      setRecipe(data.recipe);
    } catch (err) {
      console.error('Error loading recipe:', err);
      setError(err instanceof Error ? err.message : 'Failed to load recipe');
    } finally {
      setLoading(false);
    }
  }, [recipeId]);

  const loadLikeStatus = useCallback(async () => {
    if (!token) return;

    try {
      const response = await fetch(`/api/recipes/${recipeId}/like`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setLiked(data.liked);
        setLikesCount(data.likesCount);
      }
    } catch (error) {
      console.error('Error loading like status:', error);
    }
  }, [recipeId, token]);

  const loadSaveStatus = useCallback(async () => {
    if (!token) return;

    try {
      const response = await fetch(`/api/recipes/${recipeId}/save`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setSaved(data.saved);
      }
    } catch (error) {
      console.error('Error loading save status:', error);
    }
  }, [recipeId, token]);

  useEffect(() => {
    loadRecipe();
    if (token) {
      loadLikeStatus();
      loadSaveStatus();
    }
  }, [recipeId, token, loadRecipe, loadLikeStatus, loadSaveStatus]);

  const handleBack = () => {
    router.back();
  };

  const handleEdit = () => {
    setEditModalOpen(true);
  };

  const handleEditSuccess = (updatedRecipe: Recipe) => {
    setRecipe(updatedRecipe);
    setSnackbar({ open: true, message: 'Recipe updated successfully!', severity: 'success' });
  };

  const handleDelete = () => {
    setDeleteDialogOpen(true);
  };

  const confirmDelete = async () => {
    if (!token) return;

    try {
      setDeleting(true);
      const response = await fetch(`/api/recipes/${recipeId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to delete recipe');
      }

      setSnackbar({ open: true, message: 'Recipe deleted successfully!', severity: 'success' });

      // Navigate back to feed after a short delay
      setTimeout(() => {
        router.push('/');
      }, 1500);
    } catch (err) {
      console.error('Error deleting recipe:', err);
      setSnackbar({
        open: true,
        message: err instanceof Error ? err.message : 'Failed to delete recipe',
        severity: 'error'
      });
      setDeleteDialogOpen(false);
    } finally {
      setDeleting(false);
    }
  };

  const handleLike = async () => {
    if (!token) {
      setSnackbar({ open: true, message: 'Please login to like recipes', severity: 'error' });
      return;
    }

    try {
      setLikeLoading(true);
      const response = await fetch(`/api/recipes/${recipeId}/like`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
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
    if (!token) {
      setSnackbar({ open: true, message: 'Please login to save recipes', severity: 'error' });
      return;
    }

    try {
      setSaveLoading(true);
      const response = await fetch(`/api/recipes/${recipeId}/save`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
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

  const handleShare = () => {
    // TODO: Implement share functionality
    if (navigator.share) {
      navigator.share({
        title: recipe?.title,
        text: recipe?.description,
        url: window.location.href,
      });
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

  const handleMarkAsCooked = async () => {
    if (!token) {
      setSnackbar({ open: true, message: 'Please login to mark recipes as cooked', severity: 'error' });
      return;
    }

    try {
      setCookedLoading(true);
      const response = await fetch('/api/cooked-recipes', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          postId: recipeId,
        }),
      });

      if (response.ok) {
        setSnackbar({
          open: true,
          message: 'Recipe marked as cooked!',
          severity: 'success',
        });
      } else {
        const error = await response.json();
        setSnackbar({
          open: true,
          message: error.error || 'Failed to mark recipe as cooked',
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

  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty) {
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

  if (loading) {
    return (
      <Box sx={{ minHeight: '100vh', backgroundColor: 'background.default' }}>
        <Toolbar />
        <Container maxWidth="md" sx={{ pt: { xs: 2, md: 4 }, pb: { xs: 6, md: 8 }, px: { xs: 2, md: 3 } }}>
          {/* Recipe Image Skeleton */}
          <Skeleton variant="rectangular" width="100%" sx={{ height: { xs: 250, sm: 350, md: 400 }, borderRadius: 2, mb: { xs: 2, md: 3 } }} />

          {/* Title and Meta Skeleton */}
          <Box sx={{ mb: { xs: 2, md: 3 } }}>
            <Skeleton variant="text" sx={{ width: { xs: '90%', md: '80%' }, height: { xs: 36, md: 48 }, mb: { xs: 1.5, md: 2 } }} />
            <Box sx={{ display: 'flex', gap: { xs: 0.5, md: 1 }, mb: { xs: 1.5, md: 2 }, flexWrap: 'wrap' }}>
              <Skeleton variant="rectangular" width={80} height={32} sx={{ borderRadius: 2 }} />
              <Skeleton variant="rectangular" width={80} height={32} sx={{ borderRadius: 2 }} />
              <Skeleton variant="rectangular" width={100} height={32} sx={{ borderRadius: 2 }} />
            </Box>
          </Box>

          {/* Author Skeleton */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: { xs: 1.5, md: 2 }, mb: { xs: 2, md: 3 } }}>
            <Skeleton variant="circular" sx={{ width: { xs: 40, md: 48 }, height: { xs: 40, md: 48 } }} />
            <Box sx={{ flex: 1 }}>
              <Skeleton variant="text" width={150} height={24} />
              <Skeleton variant="text" width={100} height={20} />
            </Box>
          </Box>

          {/* Action Buttons Skeleton */}
          <Box sx={{ display: 'flex', gap: { xs: 1, md: 2 }, mb: { xs: 3, md: 4 }, flexWrap: 'wrap' }}>
            <Skeleton variant="rectangular" sx={{ width: { xs: '100%', sm: 120 }, height: 40, borderRadius: 1 }} />
            <Skeleton variant="rectangular" sx={{ width: { xs: '100%', sm: 120 }, height: 40, borderRadius: 1 }} />
            <Skeleton variant="rectangular" sx={{ width: { xs: '100%', sm: 150 }, height: 40, borderRadius: 1 }} />
          </Box>

          <Divider sx={{ my: { xs: 3, md: 4 } }} />

          {/* Details Cards Skeleton */}
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: { xs: 1.5, md: 2 }, mb: { xs: 3, md: 4 } }}>
            <Card><CardContent sx={{ p: { xs: 1.5, md: 2 } }}><Skeleton variant="text" width="60%" height={30} /><Skeleton variant="text" width="80%" height={24} /></CardContent></Card>
            <Card><CardContent sx={{ p: { xs: 1.5, md: 2 } }}><Skeleton variant="text" width="60%" height={30} /><Skeleton variant="text" width="80%" height={24} /></CardContent></Card>
          </Box>
        </Container>
      </Box>
    );
  }

  if (error || !recipe) {
    return (
      <Container maxWidth="md" sx={{ py: { xs: 3, md: 4 }, px: { xs: 2, md: 3 } }}>
        <Alert severity="error" sx={{ mb: { xs: 1.5, md: 2 }, fontSize: { xs: '0.875rem', md: '1rem' } }}>
          {error || 'Recipe not found'}
        </Alert>
        <Button onClick={handleBack} startIcon={<ArrowBack />} size={isMobile ? 'large' : 'medium'}>
          Go Back
        </Button>
      </Container>
    );
  }

  const totalTime = recipe.prepTime + recipe.cookingTime;

  return (
    <Box sx={{ minHeight: '100vh', pb: { xs: 10, sm: 11, md: 4 }, backgroundColor: 'background.default' }}>
      {/* Spacer for fixed AppBar - Material Design pattern */}
      <Toolbar />

      <Container maxWidth="lg" sx={{ pt: { xs: 1, md: 2 }, px: { xs: 2, md: 3 } }}>
        {/* Recipe Image */}
        <MotionBox
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          sx={{ position: 'relative', cursor: 'pointer', '&:hover .zoom-icon': { opacity: 1 } }}
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
              borderRadius: 2,
              boxShadow: 3,
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
              {(recipe.averageRating !== undefined && recipe.averageRating > 0) ? (
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
                    {recipe.averageRating.toFixed(1)} ({recipe.totalRatings} {recipe.totalRatings === 1 ? 'review' : 'reviews'})
                  </Typography>
                </>
              ) : (
                <Typography
                  variant="body2"
                  color="text.secondary"
                  sx={{ fontStyle: 'italic' }}
                >
                  No ratings yet
                </Typography>
              )}
            </Box>

            <Box sx={{ display: 'flex', gap: { xs: 0.5, md: 1 }, flexWrap: 'wrap', mb: { xs: 1.5, md: 2 } }}>
              <Chip
                label={recipe.difficulty}
                color={getDifficultyColor(recipe.difficulty) as any}
                size={isMobile ? 'small' : 'medium'}
                sx={{
                  textTransform: 'capitalize',
                  fontWeight: 600,
                  fontSize: { xs: '0.75rem', md: '0.8125rem' },
                  color: 'common.white',
                  '& .MuiChip-label': {
                    color: 'common.white',
                  },
                }}
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
                  opacity: 0.8
                }
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
                <Typography variant="subtitle1" sx={{ fontWeight: 600, lineHeight: 1.2, color: 'text.primary', fontSize: { xs: '0.9375rem', md: '1rem' } }}>
                  {recipe.author.fullName || recipe.author.username}
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ fontSize: { xs: '0.8125rem', md: '0.875rem' } }}>
                  @{recipe.author.username}
                </Typography>
              </Box>
            </Box>
          )}

          {/* Description */}
          <Typography variant="body1" color="text.secondary" paragraph sx={{ fontSize: { xs: '0.9375rem', sm: '1rem', md: '1.1rem' } }}>
            {recipe.description}
          </Typography>

          {/* Action Buttons */}
          <Box sx={{ display: 'flex', gap: { xs: 1, md: 2 }, my: { xs: 2, md: 3 }, alignItems: 'center', flexWrap: 'wrap' }}>
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
                <Typography variant="body2" fontWeight={600} sx={{ color: 'text.primary', fontSize: { xs: '0.875rem', md: '1rem' } }}>
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
                <IconButton
                  onClick={handleEdit}
                  color="primary"
                  size={isMobile ? 'medium' : 'large'}
                  sx={{
                    border: 1,
                    borderColor: 'primary.main',
                    '&:hover': {
                      backgroundColor: 'primary.main',
                      color: 'white',
                      '& .MuiSvgIcon-root': {
                        color: 'white',
                      },
                    },
                  }}
                >
                  <Edit />
                </IconButton>
                <IconButton
                  onClick={handleDelete}
                  color="error"
                  size={isMobile ? 'medium' : 'large'}
                  sx={{
                    border: 1,
                    borderColor: 'error.main',
                    '&:hover': {
                      backgroundColor: 'error.main',
                      color: 'white',
                      '& .MuiSvgIcon-root': {
                        color: 'white',
                      },
                    },
                  }}
                >
                  <Delete />
                </IconButton>
              </>
            )}
          </Box>

          <Divider sx={{ my: { xs: 2, md: 3 } }} />

          {/* Time Breakdown */}
          <Box sx={{ display: 'flex', gap: { xs: 2, sm: 3, md: 4 }, mb: { xs: 2, md: 3 }, flexWrap: 'wrap' }}>
            <Box>
              <Typography variant="caption" color="text.secondary" display="block" sx={{ fontSize: { xs: '0.7rem', md: '0.75rem' } }}>
                PREP TIME
              </Typography>
              <Typography variant="h6" sx={{ fontWeight: 600, color: 'text.primary', fontSize: { xs: '1.125rem', md: '1.25rem' } }}>
                {recipe.prepTime} min
              </Typography>
            </Box>
            <Box>
              <Typography variant="caption" color="text.secondary" display="block" sx={{ fontSize: { xs: '0.7rem', md: '0.75rem' } }}>
                COOK TIME
              </Typography>
              <Typography variant="h6" sx={{ fontWeight: 600, color: 'text.primary', fontSize: { xs: '1.125rem', md: '1.25rem' } }}>
                {recipe.cookingTime} min
              </Typography>
            </Box>
            <Box>
              <Typography variant="caption" color="text.secondary" display="block" sx={{ fontSize: { xs: '0.7rem', md: '0.75rem' } }}>
                TOTAL TIME
              </Typography>
              <Typography variant="h6" sx={{ fontWeight: 600, color: 'text.primary', fontSize: { xs: '1.125rem', md: '1.25rem' } }}>
                {totalTime} min
              </Typography>
            </Box>
          </Box>
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
              {recipe.ingredients.map((ingredient, index) => (
                <Box
                  component="li"
                  key={index}
                  sx={{
                    mb: 1.5,
                    typography: 'body1',
                    '&::marker': { color: 'primary.main' },
                  }}
                >
                  <strong>{ingredient.amount} {ingredient.unit}</strong> {ingredient.name}
                </Box>
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
              {recipe.instructions.map((instruction, index) => (
                <Box key={index} sx={{ mb: 3, display: 'flex', gap: 2 }}>
                  <Box
                    sx={{
                      minWidth: 40,
                      height: 40,
                      borderRadius: '50%',
                      backgroundColor: 'primary.main',
                      color: 'white',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontWeight: 700,
                      fontSize: '1.1rem',
                    }}
                  >
                    {instruction.step}
                  </Box>
                  <Box sx={{ flex: 1 }}>
                    <Typography variant="body1" sx={{ lineHeight: 1.8 }}>
                      {instruction.description}
                    </Typography>
                    {instruction.image && (
                      <Box
                        sx={{
                          position: 'relative',
                          maxWidth: 400,
                          cursor: 'pointer',
                          '&:hover .zoom-icon': { opacity: 1 },
                        }}
                        onClick={() => handleImageClick(instruction.image!, `Step ${instruction.step}`)}
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
              ))}
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
            <Paper sx={{
              p: 3,
              backgroundColor: (theme) => theme.palette.mode === 'dark' ? 'grey.900' : 'grey.50'
            }}>
              <Typography variant="body1" sx={{ fontStyle: 'italic' }}>
                &ldquo;{recipe.caption}&rdquo;
              </Typography>
            </Paper>
          </MotionBox>
        )}

        {/* Comments Section */}
        <MotionBox
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.5 }}
        >
          <CommentsSection recipeId={recipeId} recipeAuthorId={recipe.userId} onImageClick={handleImageClick} />
        </MotionBox>
      </Container>

      {/* Edit Recipe Modal */}
      <EditRecipeModal
        open={editModalOpen}
        recipe={recipe}
        onClose={() => setEditModalOpen(false)}
        onSuccess={handleEditSuccess}
      />

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={deleteDialogOpen}
        onClose={() => !deleting && setDeleteDialogOpen(false)}
      >
        <DialogTitle>Delete Recipe?</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Are you sure you want to delete &ldquo;{recipe?.title}&rdquo;? This action cannot be undone.
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

      {/* Snackbar for notifications */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={6000}
        onClose={() => setSnackbar({ ...snackbar, open: false })}
      >
        <Alert severity={snackbar.severity} onClose={() => setSnackbar({ ...snackbar, open: false })}>
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
  );
}
