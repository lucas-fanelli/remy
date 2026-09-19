'use client';
import { Box } from '@mui/material';
import { Ingredient } from '@/domain/types/recipe';
import { getIngredientParts } from './displayFormat';

export interface IngredientLineProps {
  ingredient: Ingredient;
  /** Tighter line for the form's compact preview */
  dense?: boolean;
}

/**
 * One `<li>` of the ingredient list: '<strong>200 g</strong> flour', '<strong>2</strong> eggs',
 * 'salt, to taste'. Render it inside a `<ul>` (`<Box component="ul" sx={{ pl: 2 }}>`).
 */
export default function IngredientLine({ ingredient, dense = false }: IngredientLineProps) {
  const { quantity, name, toTaste } = getIngredientParts(ingredient);

  return (
    <Box
      component="li"
      sx={{
        mb: dense ? 0.75 : 1.5,
        typography: dense ? 'body2' : 'body1',
        '&::marker': { color: 'primary.main' },
      }}
    >
      {quantity && (
        <>
          <strong>{quantity}</strong>{' '}
        </>
      )}
      {name}
      {toTaste && ', to taste'}
    </Box>
  );
}
