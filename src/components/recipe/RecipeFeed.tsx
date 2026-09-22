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
import { useQueryClient, type InfiniteData } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { MotionBox } from '@/components/motion';
import { useAuth } from '@/contexts/AuthContext';
import { Recipe } from '@/domain/types/recipe';
import {
  useFeed,
  FEED_PAGE_SIZE,
  FEED_MAX_PAGES,
  type FeedPage,
  type FeedRecipe,
} from '@/hooks/useFeed';
import { useLike } from '@/hooks/useViewerMutation';
import { useApiErrorMessage } from '@/lib/api/translateApiError';
import { removeRecipeEverywhere } from '@/lib/query/patchRecipeEverywhere';
import EditRecipeModal from './EditRecipeModal';
import RecipeCard from './RecipeCard';

/**
 * The page size, the page ceiling, the row type and the null-viewer fallback all moved:
 * the first three to `hooks/useFeed`, which owns the read, and the fallback to
 * `lib/engagement/specs`, which owns what an optimistic patch does when a card arrives
 * without a viewer. Keeping second copies here is how the two would drift.
 */

interface RecipeFeedProps {
  onCreateRecipe?: () => void;
}

export default function RecipeFeed({ onCreateRecipe }: RecipeFeedProps) {
  const t = useTranslations('feed');
  const tCommon = useTranslations('common');
  const apiErrorMessage = useApiErrorMessage();
  const queryClient = useQueryClient();
  const router = useRouter();
  const { user } = useAuth();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  // Filters come first now: they are part of the cache key, so they have to exist before
  // the read that uses them.
  const [difficultyFilter, setDifficultyFilter] = useState<string>('all');
  const [timeFilter, setTimeFilter] = useState<string>('any'); // 'any', 'under30', 'under60', 'over60'
  const [sortOrder, setSortOrder] = useState<string>('newest');

  const filters = useMemo(
    () => ({ difficulty: difficultyFilter, time: timeFilter, sort: sortOrder }),
    [difficultyFilter, timeFilter, sortOrder]
  );

  /**
   * The list lives in the cache now rather than here.
   *
   * What went with the old local state is the interesting part: an AbortController, a
   * monotonic request id and two length refs, described in their own comment as a
   * "double-guard against filter change races". They existed because the filters and the
   * list were separate pieces of state that had to be kept in agreement by hand.
   *
   * With the filters IN the key, a filter change is a different query. React Query cancels
   * the old one through the signal it passes the fetcher, and a late answer lands in the
   * cache entry it belongs to instead of overwriting the current one. The `existingIds`
   * de-duplication goes too: pages are separate entries here, so a recipe cannot be
   * appended to a list that already holds it.
   */
  const feed = useFeed(filters);
  const recipes = useMemo(
    () => feed.data?.pages.flatMap((page) => page.recipes) ?? [],
    [feed.data]
  );
  const loading = feed.isPending || feed.isFetchingNextPage;
  const hasMore = feed.hasNextPage;

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

  // Infinite scroll via IntersectionObserver on a sentinel element
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const lastLoadTimeRef = useRef(0);
  const rafPendingRef = useRef(false);

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;

    const observer = new IntersectionObserver(
      (entries) => {
        // `isFetchingNextPage` replaces the old `loadingRef`, and the page ceiling moved
        // into `getNextPageParam` — once 25 pages are in, `hasNextPage` is false and this
        // stops asking, so the observer no longer needs to know the count.
        if (!entries[0].isIntersecting || !hasMore || feed.isFetchingNextPage) return;

        // These two guards do NOT come for free and are kept by hand: the observer can
        // fire twice inside one frame, and a fast scroll through the sentinel can ask
        // again before the first answer is anywhere near.
        if (rafPendingRef.current) return;
        rafPendingRef.current = true;
        requestAnimationFrame(() => {
          rafPendingRef.current = false;
          const now = Date.now();
          if (now - lastLoadTimeRef.current > 500) {
            lastLoadTimeRef.current = now;
            feed.fetchNextPage();
          }
        });
      },
      { rootMargin: '500px' }
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [hasMore, feed]);

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

      // Out of every cached list, not just the one on screen: every feed filter set, and
      // the matches beside it, a profile, a search. This used to reach the feed's filter
      // sets only, so the recipe stayed on its author's profile and in the pantry matches
      // on this very page.
      removeRecipeEverywhere(queryClient, recipeToDelete.id);

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
    patchFeedCache((list) =>
      list.map((r) => (r.id === updatedRecipe.id ? { ...r, ...updatedRecipe } : r))
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

  /**
   * Apply an edit to every cached feed page, across every filter set, so the card on
   * screen shows it at once.
   *
   * Only the feed's copy: every other list was marked stale by useUpdateRecipe and
   * refetches when shown. Deleting used to go through here too and so reached the feed
   * alone; it goes through `removeRecipeEverywhere` now.
   */
  const patchFeedCache = useCallback(
    (update: (recipes: FeedRecipe[]) => FeedRecipe[]) => {
      queryClient.setQueriesData<InfiniteData<FeedPage>>(
        { queryKey: ['recipes', 'feed'] },
        (data) =>
          data && {
            ...data,
            pages: data.pages.map((page) => ({ ...page, recipes: update(page.recipes) })),
          }
      );
    },
    [queryClient]
  );

  /**
   * The like is the shared layer now.
   *
   * Sixty lines went: an optimistic patch, a snapshot to roll back to, the fetch, the
   * reconcile, two revert paths and four snackbars. That handler was the ONE correct
   * implementation in the app and it is the model the layer was built from — which is
   * exactly why it should not survive as a second copy of the same policy.
   *
   * Two behaviours it had are now the layer’s, and both are worth checking in review:
   * the signed-out nudge (which was severity `info`, not `error` — not being logged in is
   * not a failure), and keeping the optimistic state when a 200 arrives with a body that
   * will not parse. The layer treats an unparseable 200 as success and settles with
   * `undefined`, which the specs fall back through rather than blanking the flag.
   */
  const likeToggle = useLike();

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
                transition={{ delay: (index % FEED_PAGE_SIZE) * 0.05 }}
                // The card asks for `height: '100%'` so a row of cards lines up. It was
                // resolving against this box, which had no height of its own, so it
                // collapsed to content and the cards never equalised.
                sx={{ height: '100%' }}
              >
                <RecipeCard
                  recipe={recipe}
                  currentUserId={user?.id}
                  viewer={recipe.viewer}
                  // No `onClick`: the title is a real anchor to this same place now, so
                  // the card opens in a new tab, takes keyboard focus and has an href.
                  onLike={() => likeToggle.toggle(recipe.id)}
                  onComment={() => router.push(`/recipe/${recipe.id}#comments`)}
                  onEdit={() => handleEditClick(recipe)}
                  onDelete={() => handleDeleteClick(recipe)}
                />
              </MotionBox>
            </Grid>
          ))}
        </Grid>
      ) : feed.isError ? (
        /* A feed that could not be read is not a feed with no recipes in it. Without this
           branch a 500 rendered "no recipes yet" and invited you to create the first one —
           the same lie the pantry, the search and the comment thread were telling, and one
           I reintroduced here while moving the read before a test caught it. */
        <Box sx={{ py: { xs: 3, md: 4 } }}>
          <Alert
            severity="error"
            action={
              <Button color="inherit" size="small" onClick={() => feed.refetch()}>
                {tCommon('actions.retry')}
              </Button>
            }
          >
            {t('states.loadFailed')}
          </Alert>
        </Box>
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
            {(feed.data?.pages.length ?? 0) >= FEED_MAX_PAGES
              ? t('end.capped', { count: FEED_MAX_PAGES * FEED_PAGE_SIZE })
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
