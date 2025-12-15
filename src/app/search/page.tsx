'use client';

export const dynamic = 'force-dynamic';

import React, { useState, useEffect, Suspense } from 'react';
import {
  Container,
  Box,
  Typography,
  Grid,
  Card,
  CardContent,
  Avatar,
  Paper,
  useTheme,
  useMediaQuery,
} from '@mui/material';
import { Person, Restaurant } from '@mui/icons-material';
import { useRouter, useSearchParams } from 'next/navigation';
import AnimatedTabs from '@/components/ui/AnimatedTabs';
import TabPanelTransition from '@/components/ui/TabPanelTransition';
import RecipeCard from '@/components/recipe/RecipeCard';

interface User {
  id: string;
  username: string;
  email: string;
  avatar?: string;
}

interface Recipe {
  id: string;
  title: string;
  description: string;
  imageUrl: string;
  difficulty: string;
  prepTime: number;
  cookingTime: number;
  author: {
    username: string;
    avatar?: string;
  };
}

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

// Fallback loading component for Suspense
function SearchPageFallback() {
  return null;
}

// Main search page content that uses useSearchParams
function SearchPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const query = searchParams.get('q') || '';
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  const [tabValue, setTabValue] = useState(0);
  const [users, setUsers] = useState<User[]>([]);
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!query) {
      router.push('/');
      return;
    }

    const fetchResults = async () => {
      setLoading(true);
      try {
        const response = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
        if (response.ok) {
          const data = await response.json();
          setUsers(data.users || []);
          setRecipes(data.recipes || []);
        }
      } catch (error) {
        console.error('Error fetching search results:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchResults();
  }, [query, router]);

  const handleTabChange = (_event: React.SyntheticEvent, newValue: number) => {
    setTabValue(newValue);
  };

  const handleUserClick = (username: string) => {
    router.push(`/profile/${username}`);
  };

  const handleRecipeClick = (recipeId: string) => {
    router.push(`/recipe/${recipeId}`);
  };

  if (!query) {
    return null;
  }

  return (
    <Box sx={{ minHeight: '100vh', backgroundColor: 'background.default' }}>
      <Container maxWidth="lg" sx={{ pt: { xs: 9, sm: 10, md: 12 }, pb: { xs: 12, sm: 13, md: 4 } }}>
        <Box sx={{ mb: 3 }}>
          <Typography variant={isMobile ? 'h5' : 'h4'} gutterBottom>
            Search Results
          </Typography>
          <Typography variant="body1" color="text.secondary">
            Results for &ldquo;{query}&rdquo;
          </Typography>
        </Box>

        <Paper sx={{ mb: 3, width: 'fit-content' }}>
          <AnimatedTabs
            tabs={[
              { key: 0, label: `Recipes (${recipes.length})`, icon: <Restaurant /> },
              { key: 1, label: `Users (${users.length})`, icon: <Person /> },
            ]}
            activeKey={tabValue}
            onChange={(key) => setTabValue(key as number)}
          />
        </Paper>

        {loading ? (
          null
        ) : (
          <TabPanelTransition activeKey={tabValue}>
            {/* Recipes Tab */}
            {tabValue === 0 && (
              <Box sx={{ py: 3 }}>
                {recipes.length === 0 ? (
                  <Box sx={{ textAlign: 'center', py: 8 }}>
                    <Restaurant sx={{ fontSize: 64, color: 'text.disabled', mb: 2 }} />
                    <Typography variant="h6" color="text.secondary">
                      No recipes found
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Try searching with different keywords
                    </Typography>
                  </Box>
                ) : (
                  <Grid container spacing={3}>
                    {recipes.map((recipe) => (
                      <Grid item xs={12} sm={6} md={4} key={recipe.id}>
                        <RecipeCard
                          recipe={{
                            id: recipe.id,
                            title: recipe.title,
                            description: recipe.description,
                            imageUrl: recipe.imageUrl,
                            difficulty: recipe.difficulty as 'easy' | 'medium' | 'hard',
                            prepTime: recipe.prepTime,
                            cookingTime: recipe.cookingTime,
                            servings: 0,
                            ingredients: [],
                            steps: [],
                            userId: recipe.author?.username || '',
                            author: recipe.author,
                            createdAt: new Date(),
                            updatedAt: new Date(),
                          }}
                          onClick={() => handleRecipeClick(recipe.id)}
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
                      No users found
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Try searching with different keywords
                    </Typography>
                  </Box>
                ) : (
                  <Grid container spacing={2}>
                    {users.map((user) => (
                      <Grid item xs={12} sm={6} md={4} key={user.id}>
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
                                src={user.avatar}
                                sx={{ width: 56, height: 56 }}
                              >
                                <Person />
                              </Avatar>
                              <Box sx={{ flexGrow: 1, minWidth: 0 }}>
                                <Typography variant="h6" noWrap>
                                  {user.username}
                                </Typography>
                                <Typography variant="body2" color="text.secondary" noWrap>
                                  {user.email}
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
      </Container>
    </Box>
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
