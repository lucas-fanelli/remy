'use client';
import { Add as AddIcon, FilterList } from '@mui/icons-material';
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
  useTheme,
  useMediaQuery,
} from '@mui/material';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { MotionBox } from '@/components/motion';
import { useAuth } from '@/contexts/AuthContext';
import { Recipe, ViewerState } from '@/domain/types/recipe';
import { useApiErrorMessage } from '@/lib/api/translateApiError';
import EditRecipeModal from './EditRecipeModal';
import RecipeCard from './RecipeCard';

interface FeedRecipe extends Recipe {
  likeCount: number;
  commentCount: number;
  viewer: ViewerState | null;
}

/**
 * Only reached if a signed-in reader somehow holds a card whose `viewer` is null, which
 * the API does not produce. It keeps the optimistic update from having to invent the other
 * three fields — and, unlike the old default, it is never what gets rendered.
 */
const UNTOUCHED_VIEWER: ViewerState = {
  liked: false,
  saved: false,
  timesCooked: 0,
  lastCookedAt: null,
  myRating: null,
};

const PAGE_SIZE = 12;
const MAX_PAGES = 25;

interface RecipeFeedProps {
  onCreateRecipe?: () => void;
}

export default function RecipeFeed({ onCreateRecipe }: RecipeFeedProps) {
  const t = useTranslations('feed');
  const tCommon = useTranslations('common');
  const apiErrorMessage = useApiErrorMessage();
  const router = useRouter();
  const { user } = useAuth();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const [recipes, setRecipes] = useState<FeedRecipe[]>([]);
  const [loading, setLoading] = useState(false);
  const loadingRef = useRef(false);
  const abortControllerRef = useRef<AbortController | null>(null);
  const requestIdRef = useRef(0);
  const [hasMore, setHasMore] = useState(true);
  const pageRef = useRef(0);
  const recipesLengthRef = useRef(0);

  // Filters
  const [difficultyFilter, setDifficultyFilter] = useState<string>('all');
  const [timeFilter, setTimeFilter] = useState<string>('any'); // 'any', 'under30', 'under60', 'over60'
  const [sortOrder, setSortOrder] = useState<string>('newest');

  // There is no separate engagement state. There used to be two maps kept alongside the
  // recipes — one for likes, one for comment counts — seeded with `liked: false` for every
  // recipe because the API did not say otherwise, and then spread over the real data. A
  // reader who had already liked a recipe saw an empty heart, and clicking it sent the
  // server an unlike. The recipe carries its own `viewer` now, and it is the only copy.

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
    severity: 'success' | 'error' | 'info' | 'warning';
  }>({
    open: false,
    message: '',
    severity: 'info',
  });

  const loadRecipes = useCallback(
    async (reset = false) => {
      if (loadingRef.current && !reset) return;
      abortControllerRef.current?.abort();

      loadingRef.current = true;
      if (reset) {
        pageRef.current = 0;
      }
      const controller = new AbortController();
      abortControllerRef.current = controller;
      // Double-guard against filter change races:
      // 1. AbortController cancels in-flight HTTP requests
      // 2. requestIdRef detects stale responses that arrived before abort took effect
      // Together they ensure only the latest filter combination's response updates state.
      // Three layers of dedup protection:
      // 1. existingIds Set — filters out recipes already rendered (prevents duplicate React keys)
      // 2. requestIdRef — discards stale responses from superseded filter changes
      // 3. AbortController — cancels in-flight HTTP requests on filter change or unmount
      requestIdRef.current++;
      const thisRequestId = requestIdRef.current;
      setLoading(true);
      try {
        const offset = reset ? 0 : recipesLengthRef.current;
        const queryParams = new URLSearchParams({
          limit: String(PAGE_SIZE),
          offset: String(offset),
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

        const response = await fetch(`/api/recipes?${queryParams}`, {
          signal: controller.signal,
        });
        if (!response.ok) throw new Error('Failed to load recipes');

        const data = await response.json();

        // Discard stale response if a newer request has been issued.
        // Check before ALL state updates to avoid partial state from outdated responses.
        if (thisRequestId !== requestIdRef.current) return;

        if (reset) {
          pageRef.current = 1;
          recipesLengthRef.current = data.recipes.length;
          setRecipes(data.recipes);
        } else {
          // Increment page inside the requestId guard to prevent stale responses from advancing the page
          pageRef.current += 1;
          setRecipes((prev) => {
            // Prevent duplicate keys by filtering out recipes that already exist
            const existingIds = new Set(prev.map((r) => r.id));
            const newRecipes = data.recipes.filter((r: FeedRecipe) => !existingIds.has(r.id));
            const updated = [...prev, ...newRecipes];
            recipesLengthRef.current = updated.length;
            return updated;
          });
        }

        setHasMore(data.hasMore ?? data.recipes.length === PAGE_SIZE);
      } catch (error) {
        // If the request was aborted (e.g., filter changed), return early without updating state
        if (error instanceof DOMException && error.name === 'AbortError') return;
        console.error('Error loading recipes:', error);
      } finally {
        loadingRef.current = false;
        setLoading(false);
      }
    },
    [difficultyFilter, timeFilter, sortOrder]
  );

  useEffect(() => {
    loadRecipes(true);
    return () => {
      abortControllerRef.current?.abort();
    };
  }, [difficultyFilter, timeFilter, sortOrder, loadRecipes]);

  // Infinite scroll via IntersectionObserver on a sentinel element
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const lastLoadTimeRef = useRef(0);
  const rafPendingRef = useRef(false);

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries[0].isIntersecting || !hasMore || loadingRef.current) return;
        if (pageRef.current >= MAX_PAGES) {
          setHasMore(false);
          return;
        }
        // Guard against the observer firing twice in the same frame
        if (rafPendingRef.current) return;
        rafPendingRef.current = true;
        requestAnimationFrame(() => {
          rafPendingRef.current = false;
          const now = Date.now();
          if (now - lastLoadTimeRef.current > 500) {
            lastLoadTimeRef.current = now;
            loadRecipes();
          }
        });
      },
      { rootMargin: '500px' }
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [hasMore, loadRecipes]);

  // Note: Removed visibilitychange handler that was resetting recipes on tab switch.
  // This caused loss of scroll position and loaded recipes. Rating updates are
  // handled by React Query cache invalidation when navigating back.

  const clearFilters = () => {
    setDifficultyFilter('all');
    setTimeFilter('any');
    setSortOrder('newest');
  };

  const hasActiveFilters =
    difficultyFilter !== 'all' || timeFilter !== 'any' || sortOrder !== 'newest';

  const handleDeleteClick = (recipe: Recipe) => {
    setRecipeToDelete(recipe);
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!recipeToDelete || !user) return;

    setDeleting(true);
    try {
      const response = await fetch(`/api/recipes/${recipeToDelete.id}`, {
        method: 'DELETE',
        headers: { 'X-Requested-With': 'fetch' },
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(apiErrorMessage(error, t('toasts.deleteFailed')));
      }

      // Remove recipe from list
      setRecipes((prev) => {
        const updated = prev.filter((r) => r.id !== recipeToDelete.id);
        recipesLengthRef.current = updated.length;
        return updated;
      });

      setSnackbar({
        open: true,
        message: t('toasts.deleted'),
        severity: 'success',
      });
    } catch (error) {
      console.error('Error deleting recipe:', error);
      setSnackbar({
        open: true,
        message: error instanceof Error ? error.message : t('toasts.deleteFailed'),
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
    // The edit response carries the recipe, not the reader's relationship to it, so keep
    // the card's existing engagement rather than letting an edit blank out its heart.
    setRecipes((prev) =>
      prev.map((r) => (r.id === updatedRecipe.id ? { ...r, ...updatedRecipe } : r))
    );

    setSnackbar({
      open: true,
      message: t('toasts.updated'),
      severity: 'success',
    });
  };

  const handleSnackbarClose = () => {
    setSnackbar((prev) => ({ ...prev, open: false }));
  };

  /** Replace one recipe in the feed, leaving the rest of the list untouched. */
  const patchRecipe = useCallback((recipeId: string, patch: Partial<FeedRecipe>) => {
    setRecipes((prev) => prev.map((r) => (r.id === recipeId ? { ...r, ...patch } : r)));
  }, []);

  const handleLike = async (recipeId: string) => {
    if (!user) {
      setSnackbar({
        open: true,
        message: t('toasts.loginToLike'),
        severity: 'info',
      });
      return;
    }

    const current = recipes.find((r) => r.id === recipeId);
    if (!current) return;

    // The card shows what `viewer.liked` says, so "the opposite of what is on screen" is
    // now the same thing as "the opposite of the truth" — which is what makes this safe.
    const previous = { viewer: current.viewer, likeCount: current.likeCount };
    const nextLiked = !(current.viewer?.liked ?? false);
    const nextCount = nextLiked ? current.likeCount + 1 : Math.max(0, current.likeCount - 1);

    patchRecipe(recipeId, {
      viewer: { ...(current.viewer ?? UNTOUCHED_VIEWER), liked: nextLiked },
      likeCount: nextCount,
    });

    try {
      const response = await fetch(`/api/recipes/${recipeId}/like`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'fetch' },
        // State the intent rather than asking for a flip: if this is retried, or if it
        // races another tab, it still lands on what the reader asked for.
        body: JSON.stringify({ liked: nextLiked }),
      });

      if (response.ok) {
        try {
          const data = await response.json();
          patchRecipe(recipeId, {
            viewer: { ...(current.viewer ?? UNTOUCHED_VIEWER), liked: data.liked },
            likeCount: data.likeCount,
          });
        } catch (parseError) {
          console.warn('Like response parse failed, keeping optimistic state:', parseError);
          // Server returned 200 — the like was processed. Keep optimistic state.
        }
      } else {
        patchRecipe(recipeId, previous);
        setSnackbar({
          open: true,
          message: t('toasts.likeFailed'),
          severity: 'error',
        });
      }
    } catch (error) {
      console.error('Error setting like:', error);
      patchRecipe(recipeId, previous);
      setSnackbar({
        open: true,
        message: t('toasts.likeFailed'),
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
          {t('title')}
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
            {t('actions.create')}
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
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: { xs: 0.75, md: 1 },
            mb: { xs: 1.5, md: 2 },
          }}
        >
          <FilterList sx={{ color: 'text.primary', fontSize: { xs: '1.25rem', md: '1.5rem' } }} />
          <Typography
            variant="subtitle1"
            sx={{
              fontWeight: 600,
              color: 'text.primary',
              fontSize: { xs: '0.9375rem', md: '1rem' },
            }}
          >
            {t('filters.title')}
          </Typography>
          {hasActiveFilters && (
            <Chip
              label={tCommon('actions.clear')}
              size="small"
              onClick={clearFilters}
              onDelete={clearFilters}
              sx={{ ml: 'auto', fontSize: { xs: '0.7rem', md: '0.8125rem' } }}
            />
          )}
        </Box>

        <Stack
          direction={{ xs: 'column', sm: 'row' }}
          spacing={{ xs: 1.5, md: 2 }}
          alignItems={{ xs: 'stretch', sm: 'center' }}
        >
          <FormControl size="small" fullWidth={isMobile} sx={{ minWidth: { xs: 'auto', sm: 150 } }}>
            <InputLabel>{t('filters.difficulty.label')}</InputLabel>
            <Select
              value={difficultyFilter}
              label={t('filters.difficulty.label')}
              onChange={(e) => setDifficultyFilter(e.target.value)}
            >
              <MenuItem value="all">{t('filters.difficulty.all')}</MenuItem>
              <MenuItem value="easy">{t('filters.difficulty.easy')}</MenuItem>
              <MenuItem value="medium">{t('filters.difficulty.medium')}</MenuItem>
              <MenuItem value="hard">{t('filters.difficulty.hard')}</MenuItem>
            </Select>
          </FormControl>

          <FormControl size="small" fullWidth={isMobile} sx={{ minWidth: { xs: 'auto', sm: 150 } }}>
            <InputLabel>{t('filters.duration.label')}</InputLabel>
            <Select
              value={timeFilter}
              label={t('filters.duration.label')}
              onChange={(e) => setTimeFilter(e.target.value)}
            >
              <MenuItem value="any">{t('filters.duration.any')}</MenuItem>
              <MenuItem value="under30">{t('filters.duration.under30')}</MenuItem>
              <MenuItem value="under60">{t('filters.duration.under60')}</MenuItem>
              <MenuItem value="over60">{t('filters.duration.over60')}</MenuItem>
            </Select>
          </FormControl>

          {/* Sort By Dropdown */}
          <FormControl size="small" fullWidth={isMobile} sx={{ minWidth: { xs: 'auto', sm: 150 } }}>
            <InputLabel>{t('filters.sort.label')}</InputLabel>
            <Select
              value={sortOrder}
              label={t('filters.sort.label')}
              onChange={(e) => setSortOrder(e.target.value)}
            >
              <MenuItem value="newest">{t('filters.sort.newest')}</MenuItem>
              <MenuItem value="rating_desc">{t('filters.sort.ratingDesc')}</MenuItem>
              <MenuItem value="rating_asc">{t('filters.sort.ratingAsc')}</MenuItem>
              <MenuItem value="most_reviewed">{t('filters.sort.mostReviewed')}</MenuItem>
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
                transition={{ delay: (index % PAGE_SIZE) * 0.05 }}
              >
                <RecipeCard
                  recipe={recipe}
                  currentUserId={user?.id}
                  showActions={true}
                  viewer={recipe.viewer}
                  likeCount={recipe.likeCount}
                  commentCount={recipe.commentCount}
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
              {t('empty.title')}
            </Typography>
            <Typography
              variant="body2"
              color="text.secondary"
              sx={{ mb: { xs: 2, md: 3 }, fontSize: { xs: '0.875rem', md: '1rem' } }}
            >
              {t('empty.body')}
            </Typography>
            {onCreateRecipe && (
              <Button
                variant="contained"
                startIcon={<AddIcon />}
                onClick={onCreateRecipe}
                size={isMobile ? 'large' : 'medium'}
              >
                {t('actions.createFirst')}
              </Button>
            )}
          </Box>
        )
      )}

      {/* Loading state - render nothing */}
      {loading && recipes.length === 0 && null}

      {/* Sentinel element for IntersectionObserver infinite scroll */}
      <div ref={sentinelRef} />

      {/* End of Feed Message */}
      {!loading && !hasMore && recipes.length > 0 && (
        <Box sx={{ textAlign: 'center', py: { xs: 3, md: 4 } }}>
          <Typography
            variant="body2"
            color="text.secondary"
            sx={{ fontSize: { xs: '0.875rem', md: '1rem' } }}
          >
            {pageRef.current >= MAX_PAGES
              ? t('end.capped', { count: MAX_PAGES * PAGE_SIZE })
              : t('end.reached')}
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
        <DialogTitle id="delete-dialog-title">{t('deleteDialog.title')}</DialogTitle>
        <DialogContent>
          <DialogContentText id="delete-dialog-description">
            {t('deleteDialog.message')}
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleDeleteCancel} disabled={deleting}>
            {tCommon('actions.cancel')}
          </Button>
          <Button
            onClick={handleDeleteConfirm}
            color="error"
            variant="contained"
            disabled={deleting}
            autoFocus
          >
            {deleting ? tCommon('status.deleting') : tCommon('actions.delete')}
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
