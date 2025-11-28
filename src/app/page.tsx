'use client';
import React, { useEffect, useState } from 'react';
import { Box, Container, useTheme, useMediaQuery, Dialog, DialogTitle, DialogContent, Toolbar, Skeleton, Card, CardContent, Grid } from '@mui/material';
import { useRouter } from 'next/navigation';
import RecipeFeed from '@/components/recipe/RecipeFeed';
import CreateRecipeForm from '@/components/recipe/CreateRecipeForm';
import MatchedRecipes from '@/components/recipe/MatchedRecipes';
import { motion } from 'framer-motion';
import { useAuth } from '@/contexts/AuthContext';
import { CreateRecipeDTO } from '@/domain/types/recipe';

export default function Home() {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const { isAuthenticated, isLoading, user } = useAuth();
  const router = useRouter();
  const [createDialogOpen, setCreateDialogOpen] = useState(false);

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push('/auth');
    }
  }, [isAuthenticated, isLoading, router]);

  if (isLoading) {
    return (
      <Box
        sx={{
          minHeight: '100vh',
          backgroundColor: 'background.default',
        }}
      >
        <Toolbar />
        <Container maxWidth="lg" sx={{ pt: { xs: 1, md: 2 }, pb: { xs: 10, sm: 11, md: 4 }, px: { xs: 2, md: 3 } }}>
          {/* Matched Recipes Section Skeleton */}
          <Box sx={{ mb: { xs: 4, md: 6 } }}>
            <Skeleton variant="text" sx={{ width: { xs: 200, md: 250 }, height: { xs: 32, md: 40 }, mb: { xs: 1.5, md: 2 } }} />
            <Grid container spacing={{ xs: 2, sm: 2.5, md: 3 }}>
              {[1, 2, 3].map((item) => (
                <Grid item xs={12} sm={6} md={4} key={item}>
                  <Card>
                    <Skeleton variant="rectangular" width="100%" sx={{ height: { xs: 160, sm: 180, md: 200 } }} />
                    <CardContent sx={{ p: { xs: 1.5, md: 2 } }}>
                      <Skeleton variant="text" width="80%" height={30} />
                      <Skeleton variant="text" width="60%" height={24} sx={{ mt: 1 }} />
                      <Box sx={{ display: 'flex', gap: { xs: 0.5, md: 1 }, mt: { xs: 1.5, md: 2 } }}>
                        <Skeleton variant="rectangular" width={80} height={24} sx={{ borderRadius: 2 }} />
                        <Skeleton variant="rectangular" width={80} height={24} sx={{ borderRadius: 2 }} />
                      </Box>
                    </CardContent>
                  </Card>
                </Grid>
              ))}
            </Grid>
          </Box>

          {/* Recipe Feed Section Skeleton */}
          <Box>
            <Box sx={{ display: 'flex', flexDirection: { xs: 'column', sm: 'row' }, justifyContent: 'space-between', alignItems: { xs: 'stretch', sm: 'center' }, gap: { xs: 1.5, sm: 0 }, mb: { xs: 2, md: 3 } }}>
              <Skeleton variant="text" sx={{ width: { xs: '60%', md: 200 }, height: 40 }} />
              <Skeleton variant="rectangular" sx={{ width: { xs: '100%', sm: 150 }, height: 40, borderRadius: 1 }} />
            </Box>
            <Grid container spacing={{ xs: 2, sm: 2.5, md: 3 }}>
              {[1, 2, 3, 4, 5, 6].map((item) => (
                <Grid item xs={12} sm={6} md={4} key={item}>
                  <Card>
                    <Skeleton variant="rectangular" width="100%" sx={{ height: { xs: 180, sm: 200, md: 240 } }} />
                    <CardContent sx={{ p: { xs: 1.5, md: 2 } }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: { xs: 0.75, md: 1 }, mb: { xs: 1.5, md: 2 } }}>
                        <Skeleton variant="circular" sx={{ width: { xs: 32, md: 40 }, height: { xs: 32, md: 40 } }} />
                        <Skeleton variant="text" width={120} height={24} />
                      </Box>
                      <Skeleton variant="text" width="90%" height={28} />
                      <Skeleton variant="text" width="70%" height={20} sx={{ mt: 1 }} />
                      <Box sx={{ display: 'flex', gap: { xs: 0.5, md: 1 }, mt: { xs: 1.5, md: 2 } }}>
                        <Skeleton variant="rectangular" width={70} height={24} sx={{ borderRadius: 2 }} />
                        <Skeleton variant="rectangular" width={70} height={24} sx={{ borderRadius: 2 }} />
                      </Box>
                    </CardContent>
                  </Card>
                </Grid>
              ))}
            </Grid>
          </Box>
        </Container>
      </Box>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  const handleCreateRecipe = async (data: CreateRecipeDTO) => {
    try {
      const token = localStorage.getItem('auth_token');
      if (!token) throw new Error('No authentication token');

      const response = await fetch('/api/recipes', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to create recipe');
      }

      // Close dialog and refresh feed
      setCreateDialogOpen(false);
      window.location.reload(); // Refresh to show new recipe
    } catch (error) {
      console.error('Error creating recipe:', error);
      throw error;
    }
  };

  return (
    <Box sx={{ minHeight: '100vh', backgroundColor: 'background.default' }}>
      {/* Spacer for fixed AppBar - Material Design pattern */}
      <Toolbar />

      {/* Main Content */}
      <Container maxWidth="lg" sx={{ pt: { xs: 1, md: 2 }, pb: { xs: 10, sm: 11, md: 4 }, px: { xs: 2, md: 3 } }}>
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5 }}
        >
          {/* Recipe Matching based on pantry */}
          <MatchedRecipes />

          {/* Divider */}
          <Box sx={{ my: { xs: 4, md: 6 } }} />

          {/* All Recipes Feed */}
          <RecipeFeed onCreateRecipe={() => setCreateDialogOpen(true)} />
        </motion.div>
      </Container>

      {/* Create Recipe Dialog */}
      <Dialog
        open={createDialogOpen}
        onClose={() => setCreateDialogOpen(false)}
        maxWidth="md"
        fullWidth
        fullScreen={isMobile}
      >
        <DialogTitle sx={{ fontSize: { xs: '1.25rem', md: '1.5rem' } }}>Create New Recipe</DialogTitle>
        <DialogContent>
          <Box sx={{ pt: { xs: 1, md: 2 } }}>
            <CreateRecipeForm
              onSubmit={handleCreateRecipe}
              onCancel={() => setCreateDialogOpen(false)}
            />
          </Box>
        </DialogContent>
      </Dialog>
    </Box>
  );
}
