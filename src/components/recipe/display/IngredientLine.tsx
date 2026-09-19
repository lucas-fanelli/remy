'use client';
import { Box } from '@mui/material';
import { useTranslations } from 'next-intl';
import { useUnitLabels } from '@/i18n/units';
import { StoredIngredient, getIngredientParts } from './displayFormat';

export interface IngredientLineProps {
  /** A domain `Ingredient`, or a stored row whose amount is a number / whose unit is null */
  ingredient: StoredIngredient;
  /** Tighter line for the form's compact preview */
  dense?: boolean;
  /** 'span' when the caller owns the list item (a row that is also a button). Default 'li' */
  component?: 'li' | 'span';
}

/**
 * One `<li>` of the ingredient list: '<strong>200 g</strong> flour', '<strong>2</strong> eggs',
 * 'salt, to taste'. Render it inside a `<ul>` (`<Box component="ul" sx={{ pl: 2 }}>`).
 */
export default function IngredientLine({
  ingredient,
  dense = false,
  component = 'li',
}: IngredientLineProps) {
  const t = useTranslations('recipe');
  // The row keeps its stored 'cups'; the line prints 'tazas'
  const units = useUnitLabels();
  const { quantity, name, toTaste } = getIngredientParts(ingredient, units.label);

  return (
    <Box
      component={component}
      sx={{
        mb: component === 'li' ? (dense ? 0.75 : 1.5) : 0,
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
      {toTaste && t('ingredients.toTaste')}
    </Box>
  );
}
