'use client';
import React, { useEffect, useState } from 'react';
import { Box, Container, useTheme, useMediaQuery, CircularProgress, Dialog, DialogTitle, DialogContent, Toolbar, Skeleton, Card, CardContent, Grid } from '@mui/material';
import { useRouter } from 'next/navigation';
import RecipeFeed from '@/components/recipe/RecipeFeed';
import CreateRecipeForm from '@/components/recipe/CreateRecipeForm';
import MatchedRecipes from '@/components/recipe/MatchedRecipes';
import { motion } from 'framer-motion';
import { useAuth } from '@/contexts/AuthContext';
import { CreateRecipeDTO } from '@/domain/types/recipe';
import LoadingWithProgress from '@/components/common/LoadingWithProgress';

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
        <Container maxWidth="lg" sx={{ pt: 2, pb: 8 }}>
          <LoadingWithProgress color="primary" inline />

          {/* Matched Recipes Section Skeleton */}
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

          {/* Recipe Feed Section Skeleton */}
          <Box>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
              <Skeleton variant="text" width={200} height={40} />
              <Skeleton variant="rectangular" width={150} height={40} sx={{ borderRadius: 1 }} />
            </Box>
            <Grid container spacing={3}>
              {[1, 2, 3, 4, 5, 6].map((item) => (
                <Grid item xs={12} sm={6} md={4} key={item}>
                  <Card>
                    <Skeleton variant="rectangular" width="100%" height={240} />
                    <CardContent>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                        <Skeleton variant="circular" width={40} height={40} />
                        <Skeleton variant="text" width={120} height={24} />
                      </Box>
                      <Skeleton variant="text" width="90%" height={28} />
                      <Skeleton variant="text" width="70%" height={20} sx={{ mt: 1 }} />
                      <Box sx={{ display: 'flex', gap: 1, mt: 2 }}>
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
      <Container maxWidth="lg" sx={{ pt: 2, pb: isMobile ? 8 : 4 }}>
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5 }}
        >
          {/* Recipe Matching based on pantry */}
          <MatchedRecipes />

          {/* Divider */}
          <Box sx={{ my: 6 }} />

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
        <DialogTitle>Create New Recipe</DialogTitle>
        <DialogContent>
          <Box sx={{ pt: 2 }}>
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
