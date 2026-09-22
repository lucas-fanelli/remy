'use client';

import { Person, Restaurant } from '@mui/icons-material';
import {
  Box,
  Typography,
  Grid,
  Card,
  CardContent,
  Avatar,
  Paper,
  CircularProgress,
  Alert,
  Button,
  useTheme,
  useMediaQuery,
} from '@mui/material';
import { useRouter, useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import React, { useState, useEffect, Suspense } from 'react';
import PageFrame from '@/components/layout/PageFrame';
import RecipeCard from '@/components/recipe/RecipeCard';
import RecipeGridSkeleton from '@/components/recipe/RecipeGridSkeleton';
import AnimatedTabs from '@/components/ui/AnimatedTabs';
import TabPanelTransition from '@/components/ui/TabPanelTransition';
import { useSearch } from '@/hooks/useSearch';
import { useLike, useSave } from '@/hooks/useViewerMutation';
import { cloudinaryImage } from '@/lib/utils/cloudinary';

// Fallback loading component for Suspense (useSearchParams requires a Suspense boundary)
function SearchPageFallback() {
  return (
    <Box sx={{ p: 4, textAlign: 'center' }}>
      <CircularProgress />
    </Box>
  );
}

// Main search page content that uses useSearchParams
function SearchPageContent() {
  const t = useTranslations('search');
  const tCommon = useTranslations('common');
  const router = useRouter();
  const searchParams = useSearchParams();
  const query = searchParams.get('q') || '';
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  const [tabValue, setTabValue] = useState(0);

  /**
   * The search, from the cache, keyed by what was searched for.
   *
   * Reproduced before this: searching "tostadas" (made slow) and then "empanadas" left the
   * URL saying `empanadas` while the page showed five Tostadas. The old effect had no abort
   * and no stale check, so whichever answer arrived last won. With the query in the key
   * the two are separate cache entries and the page only ever reads the one it asked for.
   */
  const search = useSearch(query);
  const users = search.data?.users ?? [];
  const recipes = search.data?.recipes ?? [];
  const loading = search.isPending;
  /** A search that failed is not a search that found nothing. */
  const searchFailed = search.isError;
  const answered = search.isSuccess ? 'yes' : 'no';

  // Search results can be liked now. They could not before: this page had no mutation,
  // so it passed counts and no handler rather than render a heart that did nothing. The
  // list is in the cache now, so the shared layer can paint it.
  const likeToggle = useLike();
  const saveToggle = useSave();

  useEffect(() => {
    if (!query) router.push('/');
  }, [query, router]);

  const handleUserClick = (username: string) => {
    router.push(`/profile/${username}`);
  };

  if (!query) {
    return null;
  }

  return (
    <PageFrame>
      <Box sx={{ mb: 3 }}>
        <Typography variant={isMobile ? 'h5' : 'h4'} gutterBottom color="text.primary">
          {t('page.title')}
        </Typography>
        <Typography variant="body1" color="text.secondary">
          {t('page.resultsFor', { query })}
        </Typography>
      </Box>

      <Paper
        sx={{ mb: 3, width: 'fit-content', mx: 'auto', borderRadius: '20px', overflow: 'hidden' }}
      >
        <AnimatedTabs
          // A count only once there is an answer. They read "(0)" while the search was
          // still running and after it failed — the same claim the banner below refuses to
          // make, one line above it.
          tabs={[
            {
              key: 0,
              label: t('page.tabs.recipes', { known: answered, count: recipes.length }),
              icon: <Restaurant />,
            },
            {
              key: 1,
              label: t('page.tabs.users', { known: answered, count: users.length }),
              icon: <Person />,
            },
          ]}
          activeKey={tabValue}
          onChange={(key) => setTabValue(key as number)}
        />
      </Paper>

      {/* One banner above both tabs rather than the same branch inside each: the search
          either ran or it did not, and "no recipes" / "no users" are two claims this page
          has no business making when it never got an answer. */}
      {searchFailed ? (
        <Alert
          severity="error"
          action={
            <Button color="inherit" size="small" onClick={() => search.refetch()}>
              {tCommon('actions.retry')}
            </Button>
          }
        >
          {t('page.loadFailed')}
        </Alert>
      ) : loading ? (
        // Not nothing: an empty results area let the footer rise into the gap and drop
        // again when the cards arrived.
        <Box role="status" aria-label={tCommon('status.loading')} sx={{ py: 3 }}>
          <RecipeGridSkeleton />
        </Box>
      ) : (
        <TabPanelTransition activeKey={tabValue}>
          {/* Recipes Tab */}
          {tabValue === 0 && (
            <Box sx={{ py: 3 }}>
              {recipes.length === 0 ? (
                <Box sx={{ textAlign: 'center', py: 8 }}>
                  <Restaurant sx={{ fontSize: 64, color: 'text.disabled', mb: 2 }} />
                  <Typography variant="h6" color="text.secondary">
                    {t('page.noRecipes')}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {t('page.tryDifferent')}
                  </Typography>
                </Box>
              ) : (
                <Grid container spacing={{ xs: 2, sm: 2.5, md: 3 }}>
                  {recipes.map((recipe) => (
                    <Grid item xs={12} sm={6} md={4} key={recipe.id}>
                      <RecipeCard
                        // No more `ingredients: []`, `instructions: []` or a
                        // `createdAt: new Date()` invented on the spot to satisfy a type
                        // for fields the card never reads — and no `servings || 4`,
                        // which was answering a question the data had not answered.
                        recipe={{
                          id: recipe.id,
                          title: recipe.title,
                          description: recipe.description,
                          imageUrl: recipe.imageUrl,
                          difficulty: recipe.difficulty,
                          prepTime: recipe.prepTime,
                          cookingTime: recipe.cookingTime,
                          servings: recipe.servings,
                          userId: recipe.userId,
                          author: recipe.author,
                          averageRating: recipe.averageRating,
                          totalRatings: recipe.totalRatings,
                          likeCount: recipe.likeCount,
                          commentCount: recipe.commentCount,
                        }}
                        viewer={recipe.viewer}
                        // A handler at last. This page passed counts and no `onLike`
                        // because it had no mutation, and a heart that fills and then
                        // reverts is worse than one that plainly reports the count. The
                        // list is in the cache now, so the shared layer can paint it.
                        onLike={() => likeToggle.toggle(recipe.id)}
                        onSave={() => saveToggle.toggle(recipe.id)}
                      />
                    </Grid>
                  ))}
                </Grid>
              )}
            </Box>
          )}

          {/* Users Tab */}
          {tabValue === 1 && (
            <Box sx={{ py: 3 }}>
              {users.length === 0 ? (
                <Box sx={{ textAlign: 'center', py: 8 }}>
                  <Person sx={{ fontSize: 64, color: 'text.disabled', mb: 2 }} />
                  <Typography variant="h6" color="text.secondary">
                    {t('page.noUsers')}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {t('page.tryDifferent')}
                  </Typography>
                </Box>
              ) : (
                <Grid container spacing={2}>
                  {users.map((user) => (
                    <Grid item xs={12} sm={6} md={4} key={user.username}>
                      <Card
                        sx={{
                          backgroundColor: (theme) => theme.palette.background.paper,
                          cursor: 'pointer',
                          transition: 'transform 0.2s, box-shadow 0.2s',
                          '&:hover': {
                            transform: 'translateY(-4px)',
                            boxShadow: 4,
                          },
                        }}
                        onClick={() => handleUserClick(user.username)}
                      >
                        <CardContent>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                            <Avatar
                              src={cloudinaryImage(user.avatar, 'avatar')}
                              sx={{ width: 56, height: 56 }}
                            >
                              <Person />
                            </Avatar>
                            <Box sx={{ flexGrow: 1, minWidth: 0 }}>
                              <Typography variant="h6" noWrap>
                                {user.username}
                              </Typography>
                              <Typography variant="body2" color="text.secondary" noWrap>
                                {user.fullName || `@${user.username}`}
                              </Typography>
                            </Box>
                          </Box>
                        </CardContent>
                      </Card>
                    </Grid>
                  ))}
                </Grid>
              )}
            </Box>
          )}
        </TabPanelTransition>
      )}
    </PageFrame>
  );
}

// Wrapper component with Suspense boundary for useSearchParams
export default function SearchPage() {
  return (
    <Suspense fallback={<SearchPageFallback />}>
      <SearchPageContent />
    </Suspense>
  );
}
