import { Box } from '@mui/material';
import { counterEmphasisSx, type FieldCounter } from './formTokens';
import type { ReactNode } from 'react';

/**
 * Content for a field's `helperText` slot (S2 / S3): the error message on the left and the
 * 'n/max' counter right-aligned. Nothing at rest - undefined keeps MUI from rendering an
 * empty helper line. Spans only: the slot is a <p>.
 */
export function fieldHelper(message?: string, counter?: FieldCounter): ReactNode {
  const showCounter = Boolean(counter?.visible);
  if (!message && !showCounter) return undefined;

  return (
    <Box component="span" sx={{ display: 'flex', gap: 1 }}>
      {message && <Box component="span">{message}</Box>}
      {counter && showCounter && (
        <Box
          component="span"
          sx={{ ml: 'auto', flexShrink: 0, ...(counter.emphasised && counterEmphasisSx) }}
        >
          {counter.text}
        </Box>
      )}
    </Box>
  );
}
