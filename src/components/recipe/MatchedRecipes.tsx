'use client';
import { CheckCircle, Circle, Kitchen } from '@mui/icons-material';
import {
  Box,
  Card,
  Typography,
  CardMedia,
  CardContent,
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
  type Theme,
} from '@mui/material';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import React, { useState, useEffect, useCallback } from 'react';
import { MotionCard } from '@/components/motion';
import { useAuth } from '@/contexts/AuthContext';
import { getDifficultyColor } from '@/lib/utils/recipe';

interface MatchedRecipe {
  id: string;
  title: string;
  description: string;
  imageUrl: string;
  difficulty: string;
  matchPercentage: number;
  matchedIngredients: number;
  totalIngredients: number;
  missingIngredients: string[];
}

export default function MatchedRecipes() {
  const t = useTranslations('feed');
  // The difficulty label belongs to the recipe itself, so it lives in the recipe namespace
  const tRecipe = useTranslations('recipe');
  const tCommon = useTranslations('common');
  const { isAuthenticated } = useAuth();
  const router = useRouter();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState(0);
  const [readyToCook, setReadyToCook] = useState<MatchedRecipe[]>([]);
  const [almostThere, setAlmostThere] = useState<MatchedRecipe[]>([]);
  const [pantryItemsCount, setPantryItemsCount] = useState(0);
  const [loadFailed, setLoadFailed] = useState(false);

  const loadMatchedRecipes = useCallback(async () => {
    try {
      setLoading(true);
      setLoadFailed(false);
      const response = await fetch('/api/recipes/match');

      if (response.ok) {
        const data = await response.json();
        setReadyToCook(data.readyToCook);
        setAlmostThere(data.almostThere);
        setPantryItemsCount(data.pantryItemsCount);
      } else {
        // Don't fall through to the "pantry is empty" state — that hides server errors
        setLoadFailed(true);
      }
    } catch (error) {
      console.error('Error loading matched recipes:', error);
      setLoadFailed(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isAuthenticated) {
      loadMatchedRecipes();
    }
  }, [isAuthenticated, loadMatchedRecipes]);

  const handleRecipeClick = (recipeId: string) => {
    router.push(`/recipe/${recipeId}`);
  };

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
                <Grid item xs={12} sm={6} md={4} key={recipe.id}>
                  <MotionCard
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.1 }}
                    sx={{
                      backgroundColor: (theme: Theme) => theme.palette.background.paper,
                      cursor: 'pointer',
                      height: '100%',
                      transition: 'all 0.2s',
                      '&:hover': {
                        // No shadow here any more: the theme gives Card its own elevation,
                        // and the black one this used to draw was invisible in dark mode.
                        // The lift is the transform.
                        transform: 'translateY(-4px)',
                      },
                    }}
                    onClick={() => handleRecipeClick(recipe.id)}
                  >
                    <CardMedia
                      component="img"
                      sx={{ height: { xs: 160, sm: 180, md: 200 } }}
                      image={recipe.imageUrl}
                      alt={recipe.title}
                    />
                    <CardContent sx={{ p: { xs: 1.5, md: 2 } }}>
                      <Chip
                        icon={<CheckCircle sx={{ fontSize: { xs: '1rem', md: '1.25rem' } }} />}
                        label={t('matches.match', { percent: 100 })}
                        color="success"
                        size="small"
                        sx={{
                          mb: { xs: 0.75, md: 1 },
                          fontSize: { xs: '0.7rem', md: '0.8125rem' },
                        }}
                      />
                      <Typography
                        variant="h6"
                        gutterBottom
                        sx={{ fontSize: { xs: '1rem', sm: '1.125rem', md: '1.25rem' } }}
                      >
                        {recipe.title}
                      </Typography>
                      <Typography
                        variant="body2"
                        color="text.secondary"
                        sx={{
                          mb: { xs: 1.5, md: 2 },
                          fontSize: { xs: '0.8125rem', md: '0.875rem' },
                        }}
                      >
                        {recipe.description}
                      </Typography>
                      <Box sx={{ display: 'flex', gap: { xs: 0.5, md: 1 }, flexWrap: 'wrap' }}>
                        <Chip
                          label={tRecipe('meta.difficulty', { level: recipe.difficulty })}
                          size="small"
                          color={getDifficultyColor(recipe.difficulty)}
                          sx={{
                            fontSize: { xs: '0.7rem', md: '0.8125rem' },
                            textTransform: 'capitalize',
                          }}
                        />
                      </Box>
                    </CardContent>
                  </MotionCard>
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
                <Grid item xs={12} sm={6} md={4} key={recipe.id}>
                  <MotionCard
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.1 }}
                    sx={{
                      backgroundColor: (theme: Theme) => theme.palette.background.paper,
                      cursor: 'pointer',
                      height: '100%',
                      transition: 'all 0.2s',
                      '&:hover': {
                        // No shadow here any more: the theme gives Card its own elevation,
                        // and the black one this used to draw was invisible in dark mode.
                        // The lift is the transform.
                        transform: 'translateY(-4px)',
                      },
                    }}
                    onClick={() => handleRecipeClick(recipe.id)}
                  >
                    <CardMedia
                      component="img"
                      sx={{ height: { xs: 160, sm: 180, md: 200 } }}
                      image={recipe.imageUrl}
                      alt={recipe.title}
                    />
                    <CardContent sx={{ p: { xs: 1.5, md: 2 } }}>
                      <Box sx={{ mb: { xs: 1.5, md: 2 } }}>
                        <Box
                          sx={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            mb: { xs: 0.75, md: 1 },
                            gap: 1,
                          }}
                        >
                          <Chip
                            label={t('matches.match', { percent: recipe.matchPercentage })}
                            color={recipe.matchPercentage >= 80 ? 'warning' : 'default'}
                            size="small"
                            sx={{ fontSize: { xs: '0.7rem', md: '0.8125rem' } }}
                          />
                          <Typography
                            variant="caption"
                            color="text.secondary"
                            sx={{ fontSize: { xs: '0.7rem', md: '0.75rem' } }}
                          >
                            {t('matches.ingredientsRatio', {
                              matched: recipe.matchedIngredients,
                              total: recipe.totalIngredients,
                            })}
                          </Typography>
                        </Box>
                        <LinearProgress
                          variant="determinate"
                          value={recipe.matchPercentage}
                          sx={{ height: { xs: 5, md: 6 }, borderRadius: 1 }}
                        />
                      </Box>
                      <Typography
                        variant="h6"
                        gutterBottom
                        sx={{ fontSize: { xs: '1rem', sm: '1.125rem', md: '1.25rem' } }}
                      >
                        {recipe.title}
                      </Typography>
                      <Typography
                        variant="body2"
                        color="text.secondary"
                        sx={{
                          mb: { xs: 1.5, md: 2 },
                          fontSize: { xs: '0.8125rem', md: '0.875rem' },
                        }}
                      >
                        {recipe.description}
                      </Typography>
                      <Box sx={{ mb: { xs: 1.5, md: 2 } }}>
                        <Typography
                          variant="caption"
                          color="error"
                          sx={{ fontWeight: 600, fontSize: { xs: '0.7rem', md: '0.75rem' } }}
                        >
                          {t('matches.missing', {
                            names: recipe.missingIngredients.join(', '),
                            // Spanish conjugates the verb; English ignores the count
                            count: recipe.missingIngredients.length,
                          })}
                        </Typography>
                      </Box>
                      <Box sx={{ display: 'flex', gap: { xs: 0.5, md: 1 }, flexWrap: 'wrap' }}>
                        <Chip
                          label={tRecipe('meta.difficulty', { level: recipe.difficulty })}
                          size="small"
                          color={getDifficultyColor(recipe.difficulty)}
                          sx={{
                            fontSize: { xs: '0.7rem', md: '0.8125rem' },
                            textTransform: 'capitalize',
                          }}
                        />
                      </Box>
                    </CardContent>
                  </MotionCard>
                </Grid>
              ))}
            </Grid>
          )}
        </Box>
      )}
    </Box>
  );
}
