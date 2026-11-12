'use client';

import { Box } from '@mui/material';
import { motion, useReducedMotion } from 'framer-motion';
import React from 'react';
import PageFrame from '@/components/layout/PageFrame';
import MatchedRecipes from '@/components/recipe/MatchedRecipes';
import RecipeFeed from '@/components/recipe/RecipeFeed';
import { useCreateRecipeDialog } from '@/contexts/CreateRecipeContext';

export default function Home() {
  // The one 'New recipe' dialog lives in CreateRecipeProvider; this page only asks for it
  const { openCreate } = useCreateRecipeDialog();
  const shouldReduceMotion = useReducedMotion();

  // No waiting for the session. This used to render nothing until /api/auth/me answered,
  // so every app open and every reload made the PUBLIC feed wait one extra round trip —
  // measured from Spain, a whole trip to Washington — before it even asked for recipes.
  // The feed is the same for everyone (its hearts come from the server, which reads the
  // cookie itself), and the matches block keeps its own place: see MatchedRecipes.
  return (
    <motion.div
      initial={shouldReduceMotion ? undefined : { opacity: 0, y: 20 }}
      animate={shouldReduceMotion ? undefined : { opacity: 1, y: 0 }}
      transition={shouldReduceMotion ? undefined : { type: 'spring', stiffness: 300, damping: 30 }}
    >
      {/* The `pb: { xs: 10 }` that used to be here was clearance for the bottom bar, which
          the shell has owned since it was introduced — the two stacked into 152px of dead
          space under a 58px bar. The background was painted here too, on top of the column
          that already had it. */}
      <PageFrame>
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
      </PageFrame>
    </motion.div>
  );
}
