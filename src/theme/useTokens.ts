'use client';
import { useTheme } from '@mui/material/styles';
import { tokensFor, type ColorTokens } from './tokens';

/**
 * The colour tokens for whichever mode is showing.
 *
 * Most of the palette is reachable through MUI already — `'text.secondary'`,
 * `color="primary"`, `divider` — because `createAppTheme` maps the tokens onto those
 * slots. This is for the ones MUI has no slot for: `surface.sunken`, `border.strong`,
 * `text.onOverlay`, `shadow.card`, `accent.gold`.
 *
 * Prefer the palette where it exists; reach for this when it does not. What you should
 * not do is write a hex, which is how the app ended up rendering 32 neutral fills against
 * two declared surfaces.
 *
 * ```tsx
 * const tokens = useTokens();
 * <Box sx={{ backgroundColor: tokens.surface.sunken }} />
 * ```
 */
export function useTokens(): ColorTokens {
  const theme = useTheme();
  return tokensFor(theme.palette.mode === 'dark' ? 'dark' : 'light');
}
