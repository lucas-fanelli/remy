'use client';
import React, { useState, useEffect } from 'react';
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
  CircularProgress,
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
  ShoppingCart,
} from '@mui/icons-material';
import { useRouter, useParams } from 'next/navigation';
import { motion } from 'framer-motion';
import { Recipe } from '@/domain/types/recipe';
import { useAuth } from '@/contexts/AuthContext';
import EditRecipeModal from '@/components/recipe/EditRecipeModal';
import CommentsSection from '@/components/recipe/CommentsSection';
import LoadingWithProgress from '@/components/common/LoadingWithProgress';

const MotionBox = motion.create(Box);
const MotionCard = motion.create(Card);

export default function RecipeDetailPage() {
  const router = useRouter();
  const params = useParams();
  const { user, token } = useAuth();
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
  const [shoppingListLoading, setShoppingListLoading] = useState(false);

  const recipeId = params.id as string;
  const isOwner = user && recipe && user.id === recipe.userId;

  useEffect(() => {
    loadRecipe();
    if (token) {
      loadLikeStatus();
      loadSaveStatus();
    }
  }, [recipeId, token]);

  const loadRecipe = async () => {
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
  };

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

  const loadLikeStatus = async () => {
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
  };

  const loadSaveStatus = async () => {
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

  const handleCreateShoppingList = async () => {
    if (!token) {
      setSnackbar({ open: true, message: 'Please login to create shopping lists', severity: 'error' });
      return;
    }

    try {
      setShoppingListLoading(true);
      const response = await fetch('/api/shopping-list', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          recipeId: recipeId,
          recipeName: recipe?.title,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        if (data.missingCount === 0) {
          setSnackbar({
            open: true,
            message: 'You have all ingredients for this recipe!',
            severity: 'success',
          });
        } else {
          setSnackbar({
            open: true,
            message: data.message || 'Shopping list created!',
            severity: 'success',
          });
        }
      } else {
        const error = await response.json();
        setSnackbar({
          open: true,
          message: error.error || 'Failed to create shopping list',
          severity: 'error',
        });
      }
    } catch (error) {
      console.error('Error creating shopping list:', error);
      setSnackbar({ open: true, message: 'Failed to create shopping list', severity: 'error' });
    } finally {
      setShoppingListLoading(false);
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
        <Container maxWidth="md" sx={{ pt: 4, pb: 8 }}>
          <LoadingWithProgress color="primary" inline />

          {/* Recipe Image Skeleton */}
          <Skeleton variant="rectangular" width="100%" height={400} sx={{ borderRadius: 2, mb: 3 }} />

          {/* Title and Meta Skeleton */}
          <Box sx={{ mb: 3 }}>
            <Skeleton variant="text" width="80%" height={48} sx={{ mb: 2 }} />
            <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
              <Skeleton variant="rectangular" width={80} height={32} sx={{ borderRadius: 2 }} />
              <Skeleton variant="rectangular" width={80} height={32} sx={{ borderRadius: 2 }} />
              <Skeleton variant="rectangular" width={100} height={32} sx={{ borderRadius: 2 }} />
            </Box>
          </Box>

          {/* Author Skeleton */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3 }}>
            <Skeleton variant="circular" width={48} height={48} />
            <Box sx={{ flex: 1 }}>
              <Skeleton variant="text" width={150} height={24} />
              <Skeleton variant="text" width={100} height={20} />
            </Box>
          </Box>

          {/* Action Buttons Skeleton */}
          <Box sx={{ display: 'flex', gap: 2, mb: 4 }}>
            <Skeleton variant="rectangular" width={120} height={40} sx={{ borderRadius: 1 }} />
            <Skeleton variant="rectangular" width={120} height={40} sx={{ borderRadius: 1 }} />
            <Skeleton variant="rectangular" width={150} height={40} sx={{ borderRadius: 1 }} />
          </Box>

          <Divider sx={{ my: 4 }} />

          {/* Details Cards Skeleton */}
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 2, mb: 4 }}>
            <Card><CardContent><Skeleton variant="text" width="60%" height={30} /><Skeleton variant="text" width="80%" height={24} /></CardContent></Card>
            <Card><CardContent><Skeleton variant="text" width="60%" height={30} /><Skeleton variant="text" width="80%" height={24} /></CardContent></Card>
          </Box>
        </Container>
      </Box>
    );
  }

  if (error || !recipe) {
    return (
      <Container maxWidth="md" sx={{ py: 4 }}>
        <Alert severity="error" sx={{ mb: 2 }}>
          {error || 'Recipe not found'}
        </Alert>
        <Button onClick={handleBack} startIcon={<ArrowBack />}>
          Go Back
        </Button>
      </Container>
    );
  }

  const totalTime = recipe.prepTime + recipe.cookingTime;

  return (
    <Box sx={{ minHeight: '100vh', pb: 8, backgroundColor: 'background.default' }}>
      {/* Spacer for fixed AppBar - Material Design pattern */}
      <Toolbar />

      <Container maxWidth="lg" sx={{ pt: 2 }}>
        {/* Recipe Image */}
        <MotionBox
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <Box
            component="img"
            src={recipe.imageUrl}
            alt={recipe.title}
            sx={{
              width: '100%',
              maxHeight: '500px',
              objectFit: 'cover',
              borderRadius: 2,
              boxShadow: 3,
            }}
          />
        </MotionBox>

        {/* Recipe Header */}
        <MotionBox
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          sx={{ mt: 3 }}
        >
          {/* Title and Tags */}
          <Box sx={{ mb: 2 }}>
            <Typography variant="h3" component="h1" gutterBottom sx={{ fontWeight: 700, color: 'text.primary' }}>
              {recipe.title}
            </Typography>
            <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mb: 2 }}>
              <Chip
                label={recipe.difficulty}
                color={getDifficultyColor(recipe.difficulty) as any}
                sx={{ textTransform: 'capitalize', fontWeight: 600 }}
              />
              <Chip icon={<Restaurant />} label={recipe.cuisine} variant="outlined" />
              <Chip icon={<Person />} label={`${recipe.servings} servings`} variant="outlined" />
              <Chip icon={<AccessTime />} label={`${totalTime} min total`} variant="outlined" />
            </Box>
          </Box>

          {/* Author Info */}
          {recipe.author && (
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 2,
                mb: 3,
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
                sx={{ width: 48, height: 48 }}
              >
                {recipe.author.username.charAt(0).toUpperCase()}
              </Avatar>
              <Box>
                <Typography variant="subtitle1" sx={{ fontWeight: 600, lineHeight: 1.2, color: 'text.primary' }}>
                  {recipe.author.fullName || recipe.author.username}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  @{recipe.author.username}
                </Typography>
              </Box>
            </Box>
          )}

          {/* Description */}
          <Typography variant="body1" color="text.secondary" paragraph sx={{ fontSize: '1.1rem' }}>
            {recipe.description}
          </Typography>

          {/* Action Buttons */}
          <Box sx={{ display: 'flex', gap: 2, my: 3, alignItems: 'center', flexWrap: 'wrap' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              <IconButton
                onClick={handleLike}
                color={liked ? 'error' : 'default'}
                size="large"
                disabled={likeLoading}
              >
                {liked ? <Favorite /> : <FavoriteBorder />}
              </IconButton>
              {likesCount > 0 && (
                <Typography variant="body2" fontWeight={600} sx={{ color: 'text.primary' }}>
                  {likesCount}
                </Typography>
              )}
            </Box>
            <IconButton
              onClick={handleSave}
              color={saved ? 'primary' : 'default'}
              size="large"
              disabled={saveLoading}
            >
              {saved ? <Bookmark /> : <BookmarkBorder />}
            </IconButton>
            <IconButton onClick={handleShare} size="large">
              <Share />
            </IconButton>
            <Button
              variant="outlined"
              startIcon={<ShoppingCart />}
              onClick={handleCreateShoppingList}
              disabled={shoppingListLoading}
              size="large"
            >
              {shoppingListLoading ? 'Creating...' : 'Shopping List'}
            </Button>
          </Box>

          <Divider sx={{ my: 3 }} />

          {/* Time Breakdown */}
          <Box sx={{ display: 'flex', gap: 4, mb: 3 }}>
            <Box>
              <Typography variant="caption" color="text.secondary" display="block">
                PREP TIME
              </Typography>
              <Typography variant="h6" sx={{ fontWeight: 600, color: 'text.primary' }}>
                {recipe.prepTime} min
              </Typography>
            </Box>
            <Box>
              <Typography variant="caption" color="text.secondary" display="block">
                COOK TIME
              </Typography>
              <Typography variant="h6" sx={{ fontWeight: 600, color: 'text.primary' }}>
                {recipe.cookingTime} min
              </Typography>
            </Box>
            <Box>
              <Typography variant="caption" color="text.secondary" display="block">
                TOTAL TIME
              </Typography>
              <Typography variant="h6" sx={{ fontWeight: 600, color: 'text.primary' }}>
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
                        component="img"
                        src={instruction.image}
                        alt={`Step ${instruction.step}`}
                        sx={{
                          width: '100%',
                          maxWidth: 400,
                          borderRadius: 2,
                          mt: 2,
                        }}
                      />
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
                "{recipe.caption}"
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
          <CommentsSection recipeId={recipeId} recipeAuthorId={recipe.userId} />
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
            Are you sure you want to delete "{recipe?.title}"? This action cannot be undone.
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
    </Box>
  );
}
