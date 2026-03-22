'use client';

import { Box, Dialog, DialogTitle, DialogContent, useMediaQuery, useTheme } from '@mui/material';
import React from 'react';
import { CreateRecipeDTO } from '@/domain/types/recipe';
import CreateRecipeForm from '../recipe/CreateRecipeForm';

interface CreateRecipeDialogProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (data: CreateRecipeDTO) => Promise<void>;
}

export default function CreateRecipeDialog({ open, onClose, onSubmit }: CreateRecipeDialogProps) {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth fullScreen={isMobile}>
      <DialogTitle sx={{ fontSize: { xs: '1.25rem', md: '1.5rem' } }}>
        Create New Recipe
      </DialogTitle>
      <DialogContent>
        <Box sx={{ pt: { xs: 1, md: 2 } }}>
          <CreateRecipeForm onSubmit={onSubmit} onCancel={onClose} />
        </Box>
      </DialogContent>
    </Dialog>
  );
}
