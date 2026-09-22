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
import AnimatedTabs from '@/components/ui/AnimatedTabs';
import TabPanelTransition from '@/components/ui/TabPanelTransition';
import { cloudinaryImage } from '@/lib/utils/cloudinary';
import type { ViewerState } from '@/domain/types/recipe';

interface User {
  username: string;
  fullName?: string | null;
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
  servings: number;
  userId: string;
  likeCount?: number;
  commentCount?: number;
  averageRating?: number;
  totalRatings?: number;
  viewer: ViewerState | null;
  author: {
    username: string;
    avatar?: string;
  };
}

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
  const [users, setUsers] = useState<User[]>([]);
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [loading, setLoading] = useState(true);
  /** A search that failed is not a search that found nothing. */
  const [searchFailed, setSearchFailed] = useState(false);

  useEffect(() => {
    if (!query) {
      router.push('/');
      return;
    }

    const fetchResults = async () => {
      setLoading(true);
      try {
        const response = await fetch(`/api/search?q=${encodeURIComponent(query)}`);

        if (!response.ok) {
          // Was silent, and the empty state is a confident claim: "we found no recipes
          // matching". A 500 said the thing you searched for does not exist.
          setSearchFailed(true);
          return;
        }

        setSearchFailed(false);
        const data = await response.json();
        setUsers(data.users || []);
        setRecipes(data.recipes || []);
      } catch (error) {
        console.error('Error fetching search results:', error);
        setSearchFailed(true);
      } finally {
        setLoading(false);
      }
    };

    fetchResults();
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
          tabs={[
            {
              key: 0,
              label: t('page.tabs.recipes', { count: recipes.length }),
              icon: <Restaurant />,
            },
            { key: 1, label: t('page.tabs.users', { count: users.length }), icon: <Person /> },
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
            <Button color="inherit" size="small" onClick={() => router.refresh()}>
              {tCommon('actions.retry')}
            </Button>
          }
        >
          {t('page.loadFailed')}
        </Alert>
      ) : loading ? null : (
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
                        // The counts show here for the first time — they were fetched
                        // and then discarded. No `onLike`/`onComment` on purpose: this
                        // page has no like mutation, and a heart that fills and then
                        // reverts is worse than one that plainly reports the count.
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
