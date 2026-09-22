'use client';
import { CheckCircle, Circle, Kitchen } from '@mui/icons-material';
import {
  Box,
  Card,
  Typography,
  Chip,
  Button,
  Grid,
  Alert,
  Tabs,
  Tab,
  LinearProgress,
  Skeleton,
  useTheme,
  useMediaQuery,
} from '@mui/material';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import React, { useState } from 'react';
import { MotionBox } from '@/components/motion';
import { useAuth } from '@/contexts/AuthContext';
import { useMatches, type MatchedRecipe } from '@/hooks/useMatches';
import { useLike } from '@/hooks/useViewerMutation';
import RecipeCard, { type RecipeCardModel } from './RecipeCard';

/**
 * A matched recipe, narrowed to what a card can show.
 *
 * An earlier version of this comment claimed the route answered with five fields and no
 * viewer, and the mapper beneath it passed exactly five. Both halves were wrong the same
 * way: written from the client's own nine-field interface rather than from what the route
 * sends. The cards were sparse because the data was discarded here, and every heart on
 * the home page rendered as signed-out while the real answer was in the response.
 *
 * Everything the card can use now comes across. `user` becomes `author`, because this
 * route is the only one that calls it `user`, and a `null` stays absent on the card rather
 * than being invented.
 */
const toCardModel = (recipe: MatchedRecipe): RecipeCardModel => ({
  id: recipe.id,
  title: recipe.title,
  description: recipe.description ?? undefined,
  imageUrl: recipe.imageUrl,
  difficulty: recipe.difficulty ?? undefined,
  prepTime: recipe.prepTime ?? undefined,
  cookingTime: recipe.cookingTime ?? undefined,
  servings: recipe.servings,
  likeCount: recipe.likeCount,
  commentCount: recipe.commentCount,
  author: recipe.user ? { username: recipe.user.username, avatar: recipe.user.avatar } : undefined,
});

export default function MatchedRecipes() {
  const t = useTranslations('feed');
  const tCommon = useTranslations('common');
  const { isAuthenticated } = useAuth();
  const router = useRouter();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const [activeTab, setActiveTab] = useState(0);

  /**
   * The matches, from the cache rather than from `useState`.
   *
   * Moving them is what lets a heart here be tapped: the shared mutation layer paints
   * whatever is in the cache, and a list held in local state is invisible to it.
   */
  const matches = useMatches(isAuthenticated);
  const loading = matches.isPending;
  const loadFailed = matches.isError;
  const readyToCook = matches.data?.readyToCook ?? [];
  const almostThere = matches.data?.almostThere ?? [];
  const pantryItemsCount = matches.data?.pantryItemsCount ?? 0;
  const loadMatchedRecipes = () => matches.refetch();
  const likeToggle = useLike();

  const handleGoToPantry = () => {
    router.push('/pantry');
  };

  // Return null during loading - the global LoadingBar shows progress
  // If not authenticated, don't show this component (user not logged in)
  if (!isAuthenticated) {
    return null;
  }

  if (loading) {
    return (
      <Box sx={{ mb: 4 }}>
        <Skeleton variant="text" width={200} height={32} />
        {/* A grid, not a fixed-width row: three 280px boxes side by side were 872px wide
            and overflowed every phone. It went unnoticed because globals.css clipped the
            page horizontally — the same clip that made every overlay shift the layout. */}
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', md: 'repeat(3, 1fr)' },
            gap: 2,
            mt: 2,
          }}
        >
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} variant="rectangular" height={200} sx={{ borderRadius: 2 }} />
          ))}
        </Box>
      </Box>
    );
  }

  if (loadFailed) {
    return (
      <Alert
        severity="error"
        sx={{ mb: { xs: 3, md: 4 } }}
        action={
          <Button color="inherit" size="small" onClick={loadMatchedRecipes}>
            {tCommon('actions.retry')}
          </Button>
        }
      >
        {t('matches.loadFailed')}
      </Alert>
    );
  }

  if (!pantryItemsCount || pantryItemsCount === 0) {
    return (
      <Card sx={{ p: { xs: 3, sm: 4, md: 6 }, textAlign: 'center', mb: { xs: 3, md: 4 } }}>
        <Kitchen
          sx={{ fontSize: { xs: 60, md: 80 }, color: 'text.secondary', mb: { xs: 1.5, md: 2 } }}
        />
        <Typography variant="h5" gutterBottom sx={{ fontSize: { xs: '1.25rem', sm: '1.5rem' } }}>
          {t('matches.emptyPantry.title')}
        </Typography>
        <Typography
          variant="body1"
          color="text.secondary"
          sx={{ mb: { xs: 2, md: 3 }, fontSize: { xs: '0.875rem', md: '1rem' } }}
        >
          {t('matches.emptyPantry.body')}
        </Typography>
        <Button
          variant="contained"
          size={isMobile ? 'large' : 'medium'}
          onClick={handleGoToPantry}
          fullWidth={isMobile}
        >
          {t('matches.emptyPantry.action')}
        </Button>
      </Card>
    );
  }

  return (
    <Box>
      {/* Header */}
      <Box sx={{ mb: { xs: 3, md: 4 } }}>
        <Typography
          variant="h4"
          sx={{
            fontWeight: 600,
            mb: { xs: 0.75, md: 1 },
            color: 'text.primary',
            fontSize: { xs: '1.5rem', sm: '1.75rem', md: '2rem' },
          }}
        >
          {t('matches.title')}
        </Typography>
        <Typography
          variant="body1"
          color="text.secondary"
          sx={{ fontSize: { xs: '0.875rem', md: '1rem' } }}
        >
          {t.rich('matches.pantryCount', {
            count: pantryItemsCount,
            strong: (chunks) => (
              <Typography component="span" sx={{ fontWeight: 600, color: 'text.primary' }}>
                {chunks}
              </Typography>
            ),
          })}
        </Typography>
      </Box>

      {/* Tabs */}
      <Tabs
        value={activeTab}
        onChange={(e, newValue) => setActiveTab(newValue)}
        variant={isMobile ? 'fullWidth' : 'standard'}
        sx={{ mb: { xs: 2, md: 3 } }}
      >
        <Tab
          icon={!isMobile ? <CheckCircle /> : undefined}
          label={
            isMobile
              ? t('matches.tabs.readyShort', { count: readyToCook.length })
              : t('matches.tabs.ready', { count: readyToCook.length })
          }
          iconPosition="start"
          sx={{ fontSize: { xs: '0.8125rem', md: '0.875rem' } }}
        />
        <Tab
          icon={!isMobile ? <Circle /> : undefined}
          label={
            isMobile
              ? t('matches.tabs.almostShort', { count: almostThere.length })
              : t('matches.tabs.almost', { count: almostThere.length })
          }
          iconPosition="start"
          sx={{ fontSize: { xs: '0.8125rem', md: '0.875rem' } }}
        />
      </Tabs>

      {/* Ready to Cook Tab */}
      {activeTab === 0 && (
        <Box>
          {readyToCook.length === 0 ? (
            <Alert
              severity="info"
              sx={{ mb: { xs: 1.5, md: 2 }, fontSize: { xs: '0.8125rem', md: '0.875rem' } }}
            >
              {t('matches.noReady')}
            </Alert>
          ) : (
            <Grid container spacing={{ xs: 2, sm: 2.5, md: 3 }}>
              {readyToCook.map((recipe, index) => (
                <Grid item xs={12} sm={6} md={4} key={recipe.id} sx={{ display: 'flex' }}>
                  <MotionBox
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.1 }}
                    sx={{ width: '100%' }}
                  >
                    <RecipeCard
                      recipe={toCardModel(recipe)}
                      viewer={recipe.viewer}
                      onLike={() => likeToggle.toggle(recipe.id)}
                      overlay={
                        <Chip
                          icon={<CheckCircle sx={{ fontSize: '1rem' }} />}
                          label={t('matches.match', { percent: recipe.matchPercentage })}
                          color="success"
                          size="small"
                          sx={{ fontSize: '0.75rem', fontWeight: 600 }}
                        />
                      }
                    />
                  </MotionBox>
                </Grid>
              ))}
            </Grid>
          )}
        </Box>
      )}

      {/* Almost There Tab */}
      {activeTab === 1 && (
        <Box>
          {almostThere.length === 0 ? (
            <Alert
              severity="info"
              sx={{ mb: { xs: 1.5, md: 2 }, fontSize: { xs: '0.8125rem', md: '0.875rem' } }}
            >
              {t('matches.noAlmost')}
            </Alert>
          ) : (
            <Grid container spacing={{ xs: 2, sm: 2.5, md: 3 }}>
              {almostThere.map((recipe, index) => (
                <Grid item xs={12} sm={6} md={4} key={recipe.id} sx={{ display: 'flex' }}>
                  <MotionBox
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.1 }}
                    sx={{ width: '100%' }}
                  >
                    <RecipeCard
                      recipe={toCardModel(recipe)}
                      viewer={recipe.viewer}
                      onLike={() => likeToggle.toggle(recipe.id)}
                      overlay={
                        <Chip
                          label={t('matches.match', { percent: recipe.matchPercentage })}
                          color={recipe.matchPercentage >= 80 ? 'warning' : 'default'}
                          size="small"
                          sx={{ fontSize: '0.75rem', fontWeight: 600 }}
                        />
                      }
                      // The meter and what is missing stay here rather than becoming card
                      // props: nothing else in the app shows pantry match, and the 80%
                      // threshold above belongs beside the thing it thresholds.
                      footer={
                        <Box sx={{ mt: 1.5 }}>
                          <Typography
                            variant="caption"
                            color="text.secondary"
                            sx={{ display: 'block', mb: 0.5, fontSize: '0.75rem' }}
                          >
                            {t('matches.ingredientsRatio', {
                              matched: recipe.matchedIngredients,
                              total: recipe.totalIngredients,
                            })}
                          </Typography>
                          <LinearProgress
                            variant="determinate"
                            value={recipe.matchPercentage}
                            sx={{ height: 6, borderRadius: 1, mb: 1 }}
                          />
                          <Typography
                            variant="caption"
                            color="error"
                            sx={{ fontWeight: 600, fontSize: '0.75rem' }}
                          >
                            {t('matches.missing', {
                              names: recipe.missingIngredients.join(', '),
                              // Spanish conjugates the verb; English ignores the count
                              count: recipe.missingIngredients.length,
                            })}
                          </Typography>
                        </Box>
                      }
                    />
                  </MotionBox>
                </Grid>
              ))}
            </Grid>
          )}
        </Box>
      )}
    </Box>
  );
}
