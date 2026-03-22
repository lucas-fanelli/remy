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
} from '@mui/material';
import { useRouter } from 'next/navigation';
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
  const { isAuthenticated } = useAuth();
  const router = useRouter();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState(0);
  const [readyToCook, setReadyToCook] = useState<MatchedRecipe[]>([]);
  const [almostThere, setAlmostThere] = useState<MatchedRecipe[]>([]);
  const [pantryItemsCount, setPantryItemsCount] = useState(0);

  const loadMatchedRecipes = useCallback(async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/recipes/match');

      if (response.ok) {
        const data = await response.json();
        setReadyToCook(data.readyToCook);
        setAlmostThere(data.almostThere);
        setPantryItemsCount(data.pantryItemsCount);
      }
    } catch (error) {
      console.error('Error loading matched recipes:', error);
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
        <Box sx={{ display: 'flex', gap: 2, mt: 2 }}>
          {[1, 2, 3].map((i) => (
            <Skeleton
              key={i}
              variant="rectangular"
              width={280}
              height={200}
              sx={{ borderRadius: 2 }}
            />
          ))}
        </Box>
      </Box>
    );
  }

  if (!pantryItemsCount || pantryItemsCount === 0) {
    return (
      <Card sx={{ p: { xs: 3, sm: 4, md: 6 }, textAlign: 'center', mb: { xs: 3, md: 4 } }}>
        <Kitchen
          sx={{ fontSize: { xs: 60, md: 80 }, color: 'text.secondary', mb: { xs: 1.5, md: 2 } }}
        />
        <Typography variant="h5" gutterBottom sx={{ fontSize: { xs: '1.25rem', sm: '1.5rem' } }}>
          Your pantry is empty
        </Typography>
        <Typography
          variant="body1"
          color="text.secondary"
          sx={{ mb: { xs: 2, md: 3 }, fontSize: { xs: '0.875rem', md: '1rem' } }}
        >
          Add ingredients to your pantry and we&apos;ll show you recipes you can make!
        </Typography>
        <Button
          variant="contained"
          size={isMobile ? 'large' : 'medium'}
          onClick={handleGoToPantry}
          fullWidth={isMobile}
        >
          Go to My Pantry
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
          Recipes Based on Your Pantry
        </Typography>
        <Typography
          variant="body1"
          color="text.secondary"
          sx={{ fontSize: { xs: '0.875rem', md: '1rem' } }}
        >
          You have{' '}
          <Typography component="span" sx={{ fontWeight: 600, color: 'text.primary' }}>
            {pantryItemsCount} ingredients
          </Typography>{' '}
          in your pantry
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
            isMobile ? `Ready (${readyToCook.length})` : `Ready to Cook (${readyToCook.length})`
          }
          iconPosition="start"
          sx={{ fontSize: { xs: '0.8125rem', md: '0.875rem' } }}
        />
        <Tab
          icon={!isMobile ? <Circle /> : undefined}
          label={
            isMobile ? `Almost (${almostThere.length})` : `Almost There (${almostThere.length})`
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
              No recipes match 100% with your pantry yet. Check the &ldquo;Almost There&rdquo; tab
              for recipes you&apos;re close to making!
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
                      backgroundColor: (theme) => theme.palette.background.paper,
                      cursor: 'pointer',
                      height: '100%',
                      transition: 'all 0.2s',
                      '&:hover': {
                        boxShadow: '0 8px 24px rgba(0,0,0,0.15)',
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
                        label="100% Match"
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
                          label={recipe.difficulty}
                          size="small"
                          color={getDifficultyColor(recipe.difficulty)}
                          sx={{
                            fontSize: { xs: '0.7rem', md: '0.8125rem' },
                            textTransform: 'capitalize',
                            color: 'white',
                            '& .MuiChip-label': {
                              color: 'white',
                            },
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
              No recipes are close to matching. Add more ingredients to your pantry!
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
                      backgroundColor: (theme) => theme.palette.background.paper,
                      cursor: 'pointer',
                      height: '100%',
                      transition: 'all 0.2s',
                      '&:hover': {
                        boxShadow: '0 8px 24px rgba(0,0,0,0.15)',
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
                            label={`${recipe.matchPercentage}% Match`}
                            color={recipe.matchPercentage >= 80 ? 'warning' : 'default'}
                            size="small"
                            sx={{ fontSize: { xs: '0.7rem', md: '0.8125rem' } }}
                          />
                          <Typography
                            variant="caption"
                            color="text.secondary"
                            sx={{ fontSize: { xs: '0.7rem', md: '0.75rem' } }}
                          >
                            {recipe.matchedIngredients}/{recipe.totalIngredients} ingredients
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
                          Missing: {recipe.missingIngredients.join(', ')}
                        </Typography>
                      </Box>
                      <Box sx={{ display: 'flex', gap: { xs: 0.5, md: 1 }, flexWrap: 'wrap' }}>
                        <Chip
                          label={recipe.difficulty}
                          size="small"
                          color={getDifficultyColor(recipe.difficulty)}
                          sx={{
                            fontSize: { xs: '0.7rem', md: '0.8125rem' },
                            textTransform: 'capitalize',
                            color: 'white',
                            '& .MuiChip-label': {
                              color: 'white',
                            },
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
