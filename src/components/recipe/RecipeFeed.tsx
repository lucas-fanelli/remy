'use client';
import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Grid,
  Typography,
  Button,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Chip,
  Stack,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  Snackbar,
  Alert,
  Card,
  CardContent,
  useTheme,
  useMediaQuery,
} from '@mui/material';
import { Add as AddIcon, FilterList } from '@mui/icons-material';
import { motion } from 'framer-motion';
import { useRouter } from 'next/navigation';
import RecipeCard from './RecipeCard';
import EditRecipeModal from './EditRecipeModal';
import { Recipe, DifficultyLevel } from '@/domain/types/recipe';
import { useAuth } from '@/contexts/AuthContext';

const MotionBox = motion.create(Box);

interface RecipeFeedProps {
  onCreateRecipe?: () => void;
  onEditRecipe?: (recipe: Recipe) => void;
}

export default function RecipeFeed({ onCreateRecipe, onEditRecipe }: RecipeFeedProps) {
  const router = useRouter();
  const { user, token } = useAuth();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const isTablet = useMediaQuery(theme.breakpoints.down('md'));
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [page, setPage] = useState(0);

  // Filters
  const [difficultyFilter, setDifficultyFilter] = useState<string>('all');
  const [timeFilter, setTimeFilter] = useState<string>('any'); // 'any', 'under30', 'under60', 'over60'
  const [sortOrder, setSortOrder] = useState<string>('newest');

  // Like and comment states
  const [recipeLikes, setRecipeLikes] = useState<Record<string, { liked: boolean; count: number }>>({});
  const [recipeComments, setRecipeComments] = useState<Record<string, number>>({});

  // Delete confirmation dialog
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [recipeToDelete, setRecipeToDelete] = useState<Recipe | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Edit modal
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [recipeToEdit, setRecipeToEdit] = useState<Recipe | null>(null);

  // Snackbar for notifications
  const [snackbar, setSnackbar] = useState<{
    open: boolean;
    message: string;
    severity: 'success' | 'error' | 'info';
  }>({
    open: false,
    message: '',
    severity: 'info',
  });


  // Fetch like and comment data for recipes
  const fetchRecipeEngagement = useCallback(async (recipeIds: string[]) => {
    if (!recipeIds.length) return;

    try {
      // Fetch likes and comments in parallel for all recipes
      const likePromises = recipeIds.map(async (id) => {
        const headers: HeadersInit = {};
        if (token) {
          headers['Authorization'] = `Bearer ${token}`;
        }
        const response = await fetch(`/api/recipes/${id}/like`, { headers });
        if (response.ok) {
          const data = await response.json();
          return { id, data };
        }
        return { id, data: { liked: false, likesCount: 0 } };
      });

      const commentPromises = recipeIds.map(async (id) => {
        const response = await fetch(`/api/recipes/${id}/comments`);
        if (response.ok) {
          const data = await response.json();
          return { id, count: data.comments?.length || 0 };
        }
        return { id, count: 0 };
      });

      const [likeResults, commentResults] = await Promise.all([
        Promise.all(likePromises),
        Promise.all(commentPromises),
      ]);

      // Update state
      const newLikes: Record<string, { liked: boolean; count: number }> = {};
      likeResults.forEach(({ id, data }) => {
        newLikes[id] = { liked: data.liked, count: data.likesCount };
      });
      setRecipeLikes((prev) => ({ ...prev, ...newLikes }));

      const newComments: Record<string, number> = {};
      commentResults.forEach(({ id, count }) => {
        newComments[id] = count;
      });
      setRecipeComments((prev) => ({ ...prev, ...newComments }));
    } catch (error) {
      console.error('Error fetching recipe engagement:', error);
    }
  }, [token]);

  const loadRecipes = useCallback(async (reset = false) => {
    if (loading) return;

    setLoading(true);
    try {
      const queryParams = new URLSearchParams({
        limit: '12',
        offset: String(reset ? 0 : page * 12),
      });

      if (difficultyFilter !== 'all') {
        queryParams.append('difficulty', difficultyFilter);
      }
      // Handle time filter - can be maxTime or minTime
      if (timeFilter === 'under30') {
        queryParams.append('maxTime', '30');
      } else if (timeFilter === 'under60') {
        queryParams.append('maxTime', '60');
      } else if (timeFilter === 'over60') {
        queryParams.append('minTime', '60');
      }
      if (sortOrder !== 'newest') {
        queryParams.append('sort', sortOrder);
      }

      const response = await fetch(`/api/recipes?${queryParams}`);
      if (!response.ok) throw new Error('Failed to load recipes');

      const data = await response.json();

      if (reset) {
        setRecipes(data.recipes);
        setPage(1);
      } else {
        setRecipes((prev) => {
          // Prevent duplicate keys by filtering out recipes that already exist
          const existingIds = new Set(prev.map(r => r.id));
          const newRecipes = data.recipes.filter((r: Recipe) => !existingIds.has(r.id));
          return [...prev, ...newRecipes];
        });
        setPage((prev) => prev + 1);
      }

      setHasMore(data.recipes.length === 12);

      // Fetch engagement data for new recipes
      const recipeIds = data.recipes.map((r: Recipe) => r.id);
      await fetchRecipeEngagement(recipeIds);
    } catch (error) {
      console.error('Error loading recipes:', error);
    } finally {
      setLoading(false);
    }
  }, [loading, page, difficultyFilter, timeFilter, sortOrder, fetchRecipeEngagement]);

  useEffect(() => {
    loadRecipes(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [difficultyFilter, timeFilter, sortOrder]);

  const handleScroll = useCallback(() => {
    if (
      window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 500 &&
      hasMore &&
      !loading
    ) {
      loadRecipes();
    }
  }, [hasMore, loading, loadRecipes]);

  useEffect(() => {
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, [handleScroll]);

  const clearFilters = () => {
    setDifficultyFilter('all');
    setTimeFilter('any');
    setSortOrder('newest');
  };

  const hasActiveFilters = difficultyFilter !== 'all' || timeFilter !== 'any' || sortOrder !== 'newest';

  const handleDeleteClick = (recipe: Recipe) => {
    setRecipeToDelete(recipe);
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!recipeToDelete || !token) return;

    setDeleting(true);
    try {
      const response = await fetch(`/api/recipes/${recipeToDelete.id}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to delete recipe');
      }

      // Remove recipe from list
      setRecipes((prev) => prev.filter((r) => r.id !== recipeToDelete.id));

      setSnackbar({
        open: true,
        message: 'Recipe deleted successfully',
        severity: 'success',
      });
    } catch (error) {
      console.error('Error deleting recipe:', error);
      setSnackbar({
        open: true,
        message: error instanceof Error ? error.message : 'Failed to delete recipe',
        severity: 'error',
      });
    } finally {
      setDeleting(false);
      setDeleteDialogOpen(false);
      setRecipeToDelete(null);
    }
  };

  const handleDeleteCancel = () => {
    setDeleteDialogOpen(false);
    setRecipeToDelete(null);
  };

  const handleEditClick = (recipe: Recipe) => {
    setRecipeToEdit(recipe);
    setEditModalOpen(true);
  };

  const handleEditSuccess = (updatedRecipe: Recipe) => {
    // Update recipe in list
    setRecipes((prev) =>
      prev.map((r) => (r.id === updatedRecipe.id ? updatedRecipe : r))
    );

    setSnackbar({
      open: true,
      message: 'Recipe updated successfully',
      severity: 'success',
    });
  };

  const handleSnackbarClose = () => {
    setSnackbar((prev) => ({ ...prev, open: false }));
  };

  const handleLike = async (recipeId: string) => {
    if (!token) {
      setSnackbar({
        open: true,
        message: 'Please log in to like recipes',
        severity: 'info',
      });
      return;
    }

    // Optimistic update
    const currentLikeState = recipeLikes[recipeId] || { liked: false, count: 0 };
    const optimisticLiked = !currentLikeState.liked;
    const optimisticCount = optimisticLiked
      ? currentLikeState.count + 1
      : Math.max(0, currentLikeState.count - 1);

    setRecipeLikes((prev) => ({
      ...prev,
      [recipeId]: { liked: optimisticLiked, count: optimisticCount },
    }));

    try {
      const response = await fetch(`/api/recipes/${recipeId}/like`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        // Update with server response
        setRecipeLikes((prev) => ({
          ...prev,
          [recipeId]: { liked: data.liked, count: data.likesCount },
        }));
      } else {
        // Revert on error
        setRecipeLikes((prev) => ({
          ...prev,
          [recipeId]: currentLikeState,
        }));
        setSnackbar({
          open: true,
          message: 'Failed to update like',
          severity: 'error',
        });
      }
    } catch (error) {
      console.error('Error toggling like:', error);
      // Revert on error
      setRecipeLikes((prev) => ({
        ...prev,
        [recipeId]: currentLikeState,
      }));
      setSnackbar({
        open: true,
        message: 'Failed to update like',
        severity: 'error',
      });
    }
  };

  return (
    <Box>
      {/* Header with Create Button */}
      <Box
        sx={{
          display: 'flex',
          flexDirection: { xs: 'column', sm: 'row' },
          justifyContent: 'space-between',
          alignItems: { xs: 'stretch', sm: 'center' },
          gap: { xs: 1.5, sm: 0 },
          mb: { xs: 2, md: 3 },
        }}
      >
        <Typography
          variant="h5"
          sx={{
            fontWeight: 600,
            color: 'text.primary',
            fontSize: { xs: '1.25rem', sm: '1.5rem' },
          }}
        >
          Discover Recipes
        </Typography>
        {onCreateRecipe && (
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={onCreateRecipe}
            fullWidth={isMobile}
            size={isMobile ? 'large' : 'medium'}
            sx={{ borderRadius: 2 }}
          >
            Share Recipe
          </Button>
        )}
      </Box>

      {/* Filters */}
      <Box
        sx={{
          mb: { xs: 2, md: 3 },
          p: { xs: 1.5, md: 2 },
          backgroundColor: 'background.paper',
          borderRadius: 2,
          border: 1,
          borderColor: 'divider',
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: { xs: 0.75, md: 1 }, mb: { xs: 1.5, md: 2 } }}>
          <FilterList sx={{ color: 'text.primary', fontSize: { xs: '1.25rem', md: '1.5rem' } }} />
          <Typography
            variant="subtitle1"
            sx={{
              fontWeight: 600,
              color: 'text.primary',
              fontSize: { xs: '0.9375rem', md: '1rem' },
            }}
          >
            Filters
          </Typography>
          {hasActiveFilters && (
            <Chip
              label="Clear"
              size="small"
              onClick={clearFilters}
              onDelete={clearFilters}
              sx={{ ml: 'auto', fontSize: { xs: '0.7rem', md: '0.8125rem' } }}
            />
          )}
        </Box>

        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={{ xs: 1.5, md: 2 }} alignItems={{ xs: 'stretch', sm: 'center' }}>
          <FormControl size="small" fullWidth={isMobile} sx={{ minWidth: { xs: 'auto', sm: 150 } }}>
            <InputLabel>Difficulty</InputLabel>
            <Select
              value={difficultyFilter}
              label="Difficulty"
              onChange={(e) => setDifficultyFilter(e.target.value)}
            >
              <MenuItem value="all">All Levels</MenuItem>
              <MenuItem value="easy">Easy</MenuItem>
              <MenuItem value="medium">Medium</MenuItem>
              <MenuItem value="hard">Hard</MenuItem>
            </Select>
          </FormControl>

          <FormControl size="small" fullWidth={isMobile} sx={{ minWidth: { xs: 'auto', sm: 150 } }}>
            <InputLabel>Duration</InputLabel>
            <Select
              value={timeFilter}
              label="Duration"
              onChange={(e) => setTimeFilter(e.target.value)}
            >
              <MenuItem value="any">Any Duration</MenuItem>
              <MenuItem value="under30">Under 30 min</MenuItem>
              <MenuItem value="under60">Under 1 hour</MenuItem>
              <MenuItem value="over60">Over 1 hour</MenuItem>
            </Select>
          </FormControl>

          {/* Sort By Dropdown */}
          <FormControl size="small" fullWidth={isMobile} sx={{ minWidth: { xs: 'auto', sm: 150 } }}>
            <InputLabel>Sort By</InputLabel>
            <Select
              value={sortOrder}
              label="Sort By"
              onChange={(e) => setSortOrder(e.target.value)}
            >
              <MenuItem value="newest">Newest</MenuItem>
              <MenuItem value="rating_desc">Highest Rated</MenuItem>
              <MenuItem value="rating_asc">Lowest Rated</MenuItem>
              <MenuItem value="most_reviewed">Most Reviewed</MenuItem>
            </Select>
          </FormControl>
        </Stack>
      </Box>

      {/* Recipe Grid */}
      {recipes.length > 0 ? (
        <Grid container spacing={{ xs: 2, sm: 2.5, md: 3 }}>
          {recipes.map((recipe, index) => (
            <Grid item xs={12} sm={6} md={4} key={recipe.id}>
              <MotionBox
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
              >
                <RecipeCard
                  recipe={recipe}
                  currentUserId={user?.id}
                  showActions={true}
                  liked={recipeLikes[recipe.id]?.liked || false}
                  likeCount={recipeLikes[recipe.id]?.count || 0}
                  commentCount={recipeComments[recipe.id] || 0}
                  onClick={() => router.push(`/recipe/${recipe.id}`)}
                  onLike={() => handleLike(recipe.id)}
                  onComment={() => router.push(`/recipe/${recipe.id}#comments`)}
                  onEdit={() => handleEditClick(recipe)}
                  onDelete={() => handleDeleteClick(recipe)}
                />
              </MotionBox>
            </Grid>
          ))}
        </Grid>
      ) : (
        !loading && (
          <Box sx={{ textAlign: 'center', py: { xs: 6, md: 8 } }}>
            <Typography
              variant="h6"
              color="text.secondary"
              gutterBottom
              sx={{ fontSize: { xs: '1.125rem', md: '1.25rem' } }}
            >
              No recipes found
            </Typography>
            <Typography
              variant="body2"
              color="text.secondary"
              sx={{ mb: { xs: 2, md: 3 }, fontSize: { xs: '0.875rem', md: '1rem' } }}
            >
              Try adjusting your filters or be the first to share a recipe!
            </Typography>
            {onCreateRecipe && (
              <Button
                variant="contained"
                startIcon={<AddIcon />}
                onClick={onCreateRecipe}
                size={isMobile ? 'large' : 'medium'}
              >
                Share Your First Recipe
              </Button>
            )}
          </Box>
        )
      )}

      {/* Loading state - render nothing */}
      {loading && recipes.length === 0 && null}

      {/* End of Feed Message */}
      {!loading && !hasMore && recipes.length > 0 && (
        <Box sx={{ textAlign: 'center', py: { xs: 3, md: 4 } }}>
          <Typography variant="body2" color="text.secondary" sx={{ fontSize: { xs: '0.875rem', md: '1rem' } }}>
            You&apos;ve reached the end! 🍽️
          </Typography>
        </Box>
      )}

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={deleteDialogOpen}
        onClose={handleDeleteCancel}
        maxWidth="xs"
        aria-labelledby="delete-dialog-title"
        aria-describedby="delete-dialog-description"
      >
        <DialogTitle id="delete-dialog-title">
          Delete selected recipe?
        </DialogTitle>
        <DialogContent>
          <DialogContentText id="delete-dialog-description">
            Recipe will be permanently removed from your account and all synced devices.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button
            onClick={handleDeleteCancel}
            disabled={deleting}
          >
            Cancel
          </Button>
          <Button
            onClick={handleDeleteConfirm}
            color="error"
            variant="contained"
            disabled={deleting}
            autoFocus
          >
            {deleting ? 'Deleting...' : 'Delete'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Edit Recipe Modal */}
      <EditRecipeModal
        open={editModalOpen}
        recipe={recipeToEdit}
        onClose={() => setEditModalOpen(false)}
        onSuccess={handleEditSuccess}
      />

      {/* Snackbar for notifications */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={6000}
        onClose={handleSnackbarClose}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert
          onClose={handleSnackbarClose}
          severity={snackbar.severity}
          variant="filled"
          sx={{ width: '100%' }}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
}
