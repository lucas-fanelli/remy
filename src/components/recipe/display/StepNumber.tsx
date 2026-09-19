'use client';
import { Box } from '@mui/material';
import { SxProps, Theme } from '@mui/material/styles';

export interface StepNumberProps {
  number: number;
  /**
   * true (default): 32px on xs, 40px from sm - the form and the preview.
   * false: 40px at every width - the published page.
   */
  responsive?: boolean;
  /** The 'Add step' row shows the NEXT number at half strength */
  ghost?: boolean;
  /**
   * true (default): hidden from assistive tech, because the step editor names its textarea
   * 'Step N'. Pass false where the circle is the only place the number is printed.
   */
  decorative?: boolean;
  sx?: SxProps<Theme>;
}

/** The numbered circle in front of a step, shared by the recipe page, the preview and the editor */
export default function StepNumber({
  number,
  responsive = true,
  ghost = false,
  decorative = true,
  sx,
}: StepNumberProps) {
  const size = responsive ? { xs: 32, sm: 40 } : 40;

  return (
    <Box
      aria-hidden={decorative ? true : undefined}
      sx={[
        {
          minWidth: size,
          width: size,
          height: size,
          flexShrink: 0,
          borderRadius: '50%',
          bgcolor: 'primary.main',
          color: 'primary.contrastText',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontWeight: 700,
          fontSize: '1.1rem',
          opacity: ghost ? 0.5 : 1,
        },
        ...(Array.isArray(sx) ? sx : [sx]),
      ]}
    >
      {number}
    </Box>
  );
}
