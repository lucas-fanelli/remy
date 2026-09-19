'use client';

import { Box, Container, Toolbar } from '@mui/material';
import { motion, useReducedMotion } from 'framer-motion';
import React from 'react';
import MatchedRecipes from '@/components/recipe/MatchedRecipes';
import RecipeFeed from '@/components/recipe/RecipeFeed';
import { useAuth } from '@/contexts/AuthContext';
import { useCreateRecipeDialog } from '@/contexts/CreateRecipeContext';

export default function Home() {
  const { isLoading } = useAuth();
  // The one 'New recipe' dialog lives in CreateRecipeProvider; this page only asks for it
  const { openCreate } = useCreateRecipeDialog();
  const shouldReduceMotion = useReducedMotion();

  if (isLoading) {
    return null;
  }

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
            <RecipeFeed onCreateRecipe={openCreate} />
          </motion.div>
        </Container>
      </Box>
    </motion.div>
  );
}
