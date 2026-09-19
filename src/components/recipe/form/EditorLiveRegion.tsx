'use client';
import { Box } from '@mui/material';
import { useCallback, useState } from 'react';

/**
 * The one visually hidden polite live region of a list editor (S14): 'Ingredient 5 added',
 * 'Step 3 removed'. Errors never go through it - they are role=alert in FormStatus.
 */

const visuallyHiddenSx = {
  position: 'absolute',
  width: 1,
  height: 1,
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
