'use client';

import {
  Box,
  Container,
  useTheme,
  useMediaQuery,
  Dialog,
  DialogTitle,
  DialogContent,
  Toolbar,
} from '@mui/material';
import { motion, useReducedMotion } from 'framer-motion';
import { useRouter } from 'next/navigation';
import React, { useState } from 'react';
import CreateRecipeForm from '@/components/recipe/CreateRecipeForm';
import MatchedRecipes from '@/components/recipe/MatchedRecipes';
import RecipeFeed from '@/components/recipe/RecipeFeed';
import { useAuth } from '@/contexts/AuthContext';
import { CreateRecipeDTO } from '@/domain/types/recipe';
import { useCreateRecipe } from '@/hooks/useCreateRecipe';

export default function Home() {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const { isAuthenticated, isLoading } = useAuth();
  const router = useRouter();
  const createRecipe = useCreateRecipe();
  const shouldReduceMotion = useReducedMotion();
  const [createDialogOpen, setCreateDialogOpen] = useState(false);

  if (isLoading) {
    return null;
  }

  const handleCreateRecipe = async (data: CreateRecipeDTO) => {
    if (!isAuthenticated) throw new Error('Not authenticated');
    await createRecipe(data);
    setCreateDialogOpen(false);
  };

  return (
    <motion.div
      initial={shouldReduceMotion ? undefined : { opacity: 0, y: 20 }}
      animate={shouldReduceMotion ? undefined : { opacity: 1, y: 0 }}
      transition={shouldReduceMotion ? undefined : { type: 'spring', stiffness: 300, damping: 30 }}
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
            initial={shouldReduceMotion ? undefined : { opacity: 0 }}
            animate={shouldReduceMotion ? undefined : { opacity: 1 }}
            transition={shouldReduceMotion ? undefined : { duration: 0.5 }}
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
