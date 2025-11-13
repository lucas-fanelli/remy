'use client';
import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Card,
  CardMedia,
  CardContent,
  Chip,
  Button,
  Grid,
  CircularProgress,
  Alert,
  Tabs,
  Tab,
  LinearProgress,
  Skeleton,
} from '@mui/material';
import {
  CheckCircle,
  Circle,
  Restaurant,
  ShoppingCart,
  Kitchen,
} from '@mui/icons-material';
import { motion } from 'framer-motion';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';

const MotionCard = motion.create(Card);

interface MatchedRecipe {
  id: string;
  title: string;
  description: string;
  imageUrl: string;
  cuisine: string;
  difficulty: string;
  matchPercentage: number;
  matchedIngredients: number;
  totalIngredients: number;
  missingIngredients: Array<{ name: string; amount: number; unit: string }>;
}

export default function MatchedRecipes() {
  const { token } = useAuth();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState(0);
  const [readyToCook, setReadyToCook] = useState<MatchedRecipe[]>([]);
  const [almostThere, setAlmostThere] = useState<MatchedRecipe[]>([]);
  const [pantryItemsCount, setPantryItemsCount] = useState(0);

  useEffect(() => {
    if (token) {
      loadMatchedRecipes();
    }
  }, [token]);

  const loadMatchedRecipes = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/recipes/match', {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

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
  };

  const handleRecipeClick = (recipeId: string) => {
    router.push(`/recipe/${recipeId}`);
  };

  const handleGoToPantry = () => {
    router.push('/pantry');
  };

  if (loading) {
    return (
      <Box sx={{ mb: 6 }}>
        <Skeleton variant="text" width={250} height={40} sx={{ mb: 2 }} />
        <Grid container spacing={2}>
          {[1, 2, 3].map((item) => (
            <Grid item xs={12} sm={6} md={4} key={item}>
              <Card>
                <Skeleton variant="rectangular" width="100%" height={200} />
                <CardContent>
                  <Skeleton variant="text" width="80%" height={30} />
                  <Skeleton variant="text" width="60%" height={24} sx={{ mt: 1 }} />
                  <Box sx={{ display: 'flex', gap: 1, mt: 2 }}>
                    <Skeleton variant="rectangular" width={80} height={24} sx={{ borderRadius: 2 }} />
                    <Skeleton variant="rectangular" width={80} height={24} sx={{ borderRadius: 2 }} />
                  </Box>
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>
      </Box>
    );
  }

  if (pantryItemsCount === 0) {
    return (
      <Card sx={{ p: 6, textAlign: 'center', mb: 4 }}>
        <Kitchen sx={{ fontSize: 80, color: 'text.secondary', mb: 2 }} />
        <Typography variant="h5" gutterBottom>
          Your pantry is empty
        </Typography>
        <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
          Add ingredients to your pantry and we'll show you recipes you can make!
        </Typography>
        <Button variant="contained" size="large" onClick={handleGoToPantry}>
          Go to My Pantry
        </Button>
      </Card>
    );
  }

  return (
    <Box>
      {/* Header */}
      <Box sx={{ mb: 4 }}>
        <Typography variant="h4" sx={{ fontWeight: 600, mb: 1, color: 'text.primary' }}>
          Recipes Based on Your Pantry
        </Typography>
        <Typography variant="body1" color="text.secondary">
          You have <Typography component="span" sx={{ fontWeight: 600, color: 'text.primary' }}>{pantryItemsCount} ingredients</Typography> in your pantry
        </Typography>
      </Box>

      {/* Tabs */}
      <Tabs value={activeTab} onChange={(e, newValue) => setActiveTab(newValue)} sx={{ mb: 3 }}>
        <Tab
          icon={<CheckCircle />}
          label={`Ready to Cook (${readyToCook.length})`}
          iconPosition="start"
        />
        <Tab
          icon={<Circle />}
          label={`Almost There (${almostThere.length})`}
          iconPosition="start"
        />
      </Tabs>

      {/* Ready to Cook Tab */}
      {activeTab === 0 && (
        <Box>
          {readyToCook.length === 0 ? (
            <Alert severity="info" sx={{ mb: 2 }}>
              No recipes match 100% with your pantry yet. Check the "Almost There" tab for recipes you're close to making!
            </Alert>
          ) : (
            <Grid container spacing={3}>
              {readyToCook.map((recipe, index) => (
                <Grid item xs={12} sm={6} md={4} key={recipe.id}>
                  <MotionCard
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.1 }}
                    sx={{ cursor: 'pointer', height: '100%' }}
                    onClick={() => handleRecipeClick(recipe.id)}
                    whileHover={{ y: -4, boxShadow: '0 8px 24px rgba(0,0,0,0.15)' }}
                  >
                    <CardMedia
                      component="img"
                      height="200"
                      image={recipe.imageUrl}
                      alt={recipe.title}
                    />
                    <CardContent>
                      <Chip
                        icon={<CheckCircle />}
                        label="100% Match"
                        color="success"
                        size="small"
                        sx={{ mb: 1 }}
                      />
                      <Typography variant="h6" gutterBottom>
                        {recipe.title}
                      </Typography>
                      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                        {recipe.description}
                      </Typography>
                      <Box sx={{ display: 'flex', gap: 1 }}>
                        <Chip label={recipe.cuisine} size="small" variant="outlined" />
                        <Chip label={recipe.difficulty} size="small" color="primary" />
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
            <Alert severity="info" sx={{ mb: 2 }}>
              No recipes are close to matching. Add more ingredients to your pantry!
            </Alert>
          ) : (
            <Grid container spacing={3}>
              {almostThere.map((recipe, index) => (
                <Grid item xs={12} sm={6} md={4} key={recipe.id}>
                  <MotionCard
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.1 }}
                    sx={{ cursor: 'pointer', height: '100%' }}
                    onClick={() => handleRecipeClick(recipe.id)}
                    whileHover={{ y: -4, boxShadow: '0 8px 24px rgba(0,0,0,0.15)' }}
                  >
                    <CardMedia
                      component="img"
                      height="200"
                      image={recipe.imageUrl}
                      alt={recipe.title}
                    />
                    <CardContent>
                      <Box sx={{ mb: 2 }}>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                          <Chip
                            label={`${recipe.matchPercentage}% Match`}
                            color={recipe.matchPercentage >= 80 ? 'warning' : 'default'}
                            size="small"
                          />
                          <Typography variant="caption" color="text.secondary">
                            {recipe.matchedIngredients}/{recipe.totalIngredients} ingredients
                          </Typography>
                        </Box>
                        <LinearProgress
                          variant="determinate"
                          value={recipe.matchPercentage}
                          sx={{ height: 6, borderRadius: 1 }}
                        />
                      </Box>
                      <Typography variant="h6" gutterBottom>
                        {recipe.title}
                      </Typography>
                      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                        {recipe.description}
                      </Typography>
                      <Box sx={{ mb: 2 }}>
                        <Typography variant="caption" color="error" sx={{ fontWeight: 600 }}>
                          Missing: {recipe.missingIngredients.map(ing => ing.name).join(', ')}
                        </Typography>
                      </Box>
                      <Box sx={{ display: 'flex', gap: 1 }}>
                        <Chip label={recipe.cuisine} size="small" variant="outlined" />
                        <Chip label={recipe.difficulty} size="small" color="primary" />
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
