import { Box } from '@mui/material';
import { useCallback } from 'react';
import { useTextDescriptor } from '@/i18n/text';
import { counterEmphasisSx, type FieldCounter } from './formTokens';
import type { TextDescriptor } from '@/i18n/text';
import type { ReactNode } from 'react';

/**
 * Content for a field's `helperText` slot (S2 / S3): the error message on the left and the
 * 'n/max' counter right-aligned. Nothing at rest - undefined keeps MUI from rendering an
 * empty helper line. Spans only: the slot is a <p>.
 */
export function fieldHelper(message?: string, counter?: FieldCounter): ReactNode {
  const visibleCounter = counter?.visible ? counter : undefined;
  if (!message && !visibleCounter) return undefined;

  return (
    <Box component="span" sx={{ display: 'flex', gap: 1 }}>
      {message && <Box component="span">{message}</Box>}
      {visibleCounter && (
        <Box
          component="span"
          sx={{ ml: 'auto', flexShrink: 0, ...(visibleCounter.emphasised && counterEmphasisSx) }}
        >
          {visibleCounter.text}
        </Box>
      )}
    </Box>
  );
}

/**
 * `useTextDescriptor()` for the descriptors that may not be there: `errors.title` when the
 * title is fine, a row note the parser did not raise. Keeps `undefined` undefined, so the
 * helper line and the aria-describedby stay off exactly as they did with plain strings.
 */
export function useOptionalText(): (descriptor?: TextDescriptor) => string | undefined {
  const renderText = useTextDescriptor();

  return useCallback(
    (descriptor?: TextDescriptor) => (descriptor ? renderText(descriptor) : undefined),
    [renderText]
  );
}
