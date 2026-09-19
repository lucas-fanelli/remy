'use client';
import { ExpandMore } from '@mui/icons-material';
import { Box, ButtonBase, Typography } from '@mui/material';
import React, { useId, useState } from 'react';

export interface ParsedReadoutProps {
  /** '8 ingredients - 1 to check' */
  summary: string;
  /** The `<li>` rows: what Remy understood, printed the way it will be published */
  children: React.ReactNode;
}

/**
 * The quiet frame under a text box of the 'Write' tab: it reads as feedback, not as a second
 * form. On phones the rows fold behind the summary line so the screen is not doubled; from
 * `sm` they are always visible and the summary is plain text. Both by CSS, no width flag:
 * `display: none` also takes the control that does not apply out of the tab order.
 */
export default function ParsedReadout({ summary, children }: ParsedReadoutProps) {
  const listId = useId();
  const [expanded, setExpanded] = useState(false);

  return (
    <Box
      sx={{
        bgcolor: 'action.hover',
        borderLeft: 2,
        borderColor: 'divider',
        borderRadius: 1,
        px: 1.5,
        py: 1,
        color: 'text.secondary',
      }}
    >
      <ButtonBase
        type="button"
        aria-expanded={expanded}
        aria-controls={listId}
        onClick={() => setExpanded((open) => !open)}
        sx={{
          display: { xs: 'flex', sm: 'none' },
          width: '100%',
          justifyContent: 'space-between',
          textAlign: 'left',
          borderRadius: 1,
          typography: 'body2',
          '&:focus-visible': { outline: '2px solid', outlineColor: 'primary.main' },
        }}
      >
        {summary}
        <ExpandMore
          fontSize="small"
          sx={{
            transform: expanded ? 'rotate(180deg)' : 'none',
            transition: (theme) => theme.transitions.create('transform'),
          }}
        />
      </ButtonBase>
      <Typography variant="body2" sx={{ display: { xs: 'none', sm: 'block' } }}>
        {summary}
      </Typography>

      {/* Rows appear without animation: they change on every keystroke */}
      <Box
        component="ul"
        id={listId}
        sx={{
          display: { xs: expanded ? 'block' : 'none', sm: 'block' },
          listStyle: 'none',
          m: 0,
          mt: 0.5,
          p: 0,
        }}
      >
        {children}
      </Box>
    </Box>
  );
}
