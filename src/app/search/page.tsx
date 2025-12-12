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
  CardMedia,
  Avatar,
  Skeleton,
  Paper,
  useTheme,
  useMediaQuery,
  Chip,
} from '@mui/material';
import { Person, Restaurant, AccessTime } from '@mui/icons-material';
import { useRouter, useSearchParams } from 'next/navigation';
import AnimatedTabs from '@/components/ui/AnimatedTabs';
import TabPanelTransition from '@/components/ui/TabPanelTransition';

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

const getDifficultyColor = (difficulty: string) => {
  switch (difficulty.toLowerCase()) {
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

// Fallback loading component for Suspense
function SearchPageFallback() {
  return (
    <Box sx={{ minHeight: '100vh', bgcolor: 'background.default', pt: 4 }}>
      <Container maxWidth="lg">
        <Skeleton variant="text" width={200} height={40} sx={{ mb: 2 }} />
        <Skeleton variant="rectangular" height={48} sx={{ mb: 3, borderRadius: 1 }} />
        <Grid container spacing={2}>
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <Grid item xs={12} sm={6} md={4} key={i}>
              <Skeleton variant="rectangular" height={200} sx={{ borderRadius: 2 }} />
            </Grid>
          ))}
        </Grid>
      </Container>
    </Box>
  );
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

        <Paper sx={{ mb: 3 }}>
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
          <Grid container spacing={3}>
            {[...Array(6)].map((_, index) => (
              <Grid item xs={12} sm={6} md={4} key={`skeleton-${index}`}>
                <Card>
                  <Skeleton variant="rectangular" sx={{ height: 200 }} />
                  <CardContent>
                    <Skeleton variant="text" width="70%" height={28} sx={{ mb: 1 }} />
                    <Skeleton variant="text" width="100%" />
                    <Skeleton variant="text" width="90%" sx={{ mb: 2 }} />
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Skeleton variant="circular" width={24} height={24} />
                      <Skeleton variant="text" width={100} />
                    </Box>
                  </CardContent>
                </Card>
              </Grid>
            ))}
          </Grid>
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
                        <Card
                          sx={{
                            backgroundColor: (theme) => theme.palette.background.paper,
                            cursor: 'pointer',
                            height: '100%',
                            display: 'flex',
                            flexDirection: 'column',
                            transition: 'transform 0.2s, box-shadow 0.2s',
                            '&:hover': {
                              transform: 'translateY(-4px)',
                              boxShadow: 4,
                            },
                          }}
                          onClick={() => handleRecipeClick(recipe.id)}
                        >
                          <Box sx={{ position: 'relative' }}>
                            <CardMedia
                              component="img"
                              height="200"
                              image={recipe.imageUrl}
                              alt={recipe.title}
                              sx={{ objectFit: 'cover' }}
                            />
                            <Box sx={{ position: 'absolute', top: 12, right: 12 }}>
                              <Chip
                                label={recipe.difficulty}
                                size="small"
                                color={getDifficultyColor(recipe.difficulty) as any}
                                sx={{
                                  fontWeight: 600,
                                  textTransform: 'capitalize',
                                  backdropFilter: 'blur(10px)',
                                  color: 'white',
                                  '& .MuiChip-label': { color: 'white' },
                                }}
                              />
                            </Box>
                            <Box sx={{ position: 'absolute', bottom: 12, left: 12 }}>
                              <Chip
                                icon={<AccessTime sx={{ fontSize: 14 }} />}
                                label={`${recipe.prepTime + recipe.cookingTime} min`}
                                size="small"
                                sx={{
                                  backdropFilter: 'blur(10px)',
                                  backgroundColor: (theme) =>
                                    theme.palette.mode === 'dark'
                                      ? 'rgba(255,255,255,0.9)'
                                      : 'rgba(0,0,0,0.7)',
                                  color: (theme) =>
                                    theme.palette.mode === 'dark' ? 'black' : 'white',
                                  '& .MuiChip-icon': {
                                    color: (theme) =>
                                      theme.palette.mode === 'dark' ? 'black' : 'white',
                                  },
                                }}
                              />
                            </Box>
                          </Box>
                          <CardContent sx={{ flexGrow: 1 }}>
                            <Typography variant="h6" gutterBottom noWrap>
                              {recipe.title}
                            </Typography>
                            <Typography
                              variant="body2"
                              color="text.secondary"
                              sx={{
                                mb: 2,
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                display: '-webkit-box',
                                WebkitLineClamp: 2,
                                WebkitBoxOrient: 'vertical',
                              }}
                            >
                              {recipe.description}
                            </Typography>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                              <Avatar
                                src={recipe.author.avatar}
                                sx={{ width: 24, height: 24 }}
                              >
                                {recipe.author.username.charAt(0).toUpperCase()}
                              </Avatar>
                              <Typography variant="caption" color="text.secondary">
                                by {recipe.author.username}
                              </Typography>
                            </Box>
                          </CardContent>
                        </Card>
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
