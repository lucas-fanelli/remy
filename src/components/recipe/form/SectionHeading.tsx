import { Typography, type TypographyProps } from '@mui/material';
import { forwardRef } from 'react';

export interface SectionHeadingProps extends Omit<TypographyProps, 'variant' | 'component'> {
  /** h2 directly under the dialog / page title, h3 when the shell nests sections */
  component?: 'h2' | 'h3';
}

/** Air left above the heading when it is scrolled into view */
const SCROLL_MARGIN_TOP = '16px';

/**
 * Every section starts with one (S14) and it is the focus target after every section
 * change: `ref.current?.focus()` moves a screen reader to the new section without putting
 * a tab stop in the page (`tabIndex={-1}`), so there is no focus ring to draw.
 */
const SectionHeading = forwardRef<HTMLHeadingElement, SectionHeadingProps>(function SectionHeading(
  { component = 'h2', sx, children, ...other },
  ref
) {
  return (
    <Typography
      ref={ref}
      component={component}
      variant="h6"
      tabIndex={-1}
      sx={[
        { outline: 'none', scrollMarginTop: SCROLL_MARGIN_TOP },
        ...(Array.isArray(sx) ? sx : [sx]),
      ]}
      {...other}
    >
      {children}
    </Typography>
  );
});

export default SectionHeading;
