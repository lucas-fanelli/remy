'use client';
import { Box } from '@mui/material';
import { useCallback, useState } from 'react';

/**
 * The one visually hidden polite live region of a list editor (S14): 'Ingredient 5 added',
 * 'Step 3 removed'. Errors never go through it - they are role=alert in FormStatus.
 */

// Pixel STRINGS: in sx a bare 1 is a fraction (width: 100%), and a full-size absolute box
// - clipped or not - adds its height to the scrollable overflow of the dialog or the page
const visuallyHiddenSx = {
  position: 'absolute',
  width: '1px',
  height: '1px',
  m: '-1px',
  p: 0,
  border: 0,
  overflow: 'hidden',
  clip: 'rect(0 0 0 0)',
  whiteSpace: 'nowrap',
} as const;

export function useAnnouncer() {
  const [message, setMessage] = useState('');

  // The same sentence twice in a row ('Step 2 removed', again) must still be announced:
  // a trailing no-break space makes the second one a change
  const announce = useCallback((text: string) => {
    setMessage((previous) => (previous === text ? `${text} ` : text));
  }, []);

  return { message, announce };
}

export default function EditorLiveRegion({ message }: { message: string }) {
  return (
    <Box role="status" aria-live="polite" aria-atomic="true" sx={visuallyHiddenSx}>
      {message}
    </Box>
  );
}
