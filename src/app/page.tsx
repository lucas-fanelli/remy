'use client';

// Force dynamic rendering for this page
export const dynamic = 'force-dynamic';

import React, { useEffect, useState } from 'react';
import {
  Box,
  Container,
  useTheme,
  useMediaQuery,
  Dialog,
  DialogTitle,
  DialogContent,
  Toolbar,
  Typography,
} from '@mui/material';
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

  // Return null during loading - the global LoadingBar shows progress
  if (isLoading) {
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
          Authorization: `Bearer ${token}`,
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
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: 'spring', stiffness: 300, damping: 30 }}
    >
      <Box sx={{ minHeight: '100vh', backgroundColor: 'background.default' }}>
        {/* Spacer for fixed AppBar - Material Design pattern */}
        <Toolbar />

        {/* Main Content */}
        <Container
          maxWidth="lg"
          sx={{ pt: { xs: 1, md: 2 }, pb: { xs: 10, sm: 11, md: 4 }, px: { xs: 2, md: 3 } }}
        >
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
            <RecipeFeed
              onCreateRecipe={() => {
                if (!isAuthenticated) {
                  router.push('/auth');
                  return;
                }
                setCreateDialogOpen(true);
              }}
            />
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
          <DialogTitle sx={{ fontSize: { xs: '1.25rem', md: '1.5rem' } }}>
            Create New Recipe
          </DialogTitle>
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
    </motion.div>
  );
}
