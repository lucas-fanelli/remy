import { Box } from '@mui/material';

interface StepNumberBadgeProps {
  number: number;
  /** The 'Add step' row: shows the number the next step would get, at half opacity */
  ghost?: boolean;
}

/**
 * The numbered circle of the published page (src/app/recipe/[id]/page.tsx), so a step in
 * the editor reads like the step it becomes. Decorative: the textarea is named 'Step N'.
 *
 * S9 extracts the same circle as src/components/recipe/display/StepNumber; that folder
 * belongs to another slice, so this private copy stands in until both are on the base.
 */
export default function StepNumberBadge({ number, ghost = false }: StepNumberBadgeProps) {
  return (
    <Box
      aria-hidden="true"
      sx={{
        flexShrink: 0,
        width: { xs: 32, sm: 40 },
        height: { xs: 32, sm: 40 },
        borderRadius: '50%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        bgcolor: 'primary.main',
        color: 'primary.contrastText',
        typography: 'subtitle1',
        fontWeight: 700,
        opacity: ghost ? 0.5 : 1,
      }}
    >
      {number}
    </Box>
  );
}
