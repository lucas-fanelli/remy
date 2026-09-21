'use client';
import { useTheme } from '@mui/material/styles';
import { BRANDING } from './branding';

/**
 * The logo that can be seen against the current background.
 *
 * The artwork is a dark rat on transparency, so on a dark page it was a white chef's hat
 * floating over nothing. Worse, one file served as the logo, the favicon, both PWA icons
 * and the recipe-image fallback — six paths, one byte-identical file — so there was no
 * way to change what the nav showed without changing the browser tab too.
 *
 * There are two drawings now. This picks between them; the browser and OS icons keep the
 * dark one, because those are baked once and cannot follow a toggle.
 */
export function useBrandLogo(): string {
  const theme = useTheme();
  return theme.palette.mode === 'dark' ? BRANDING.logoDark : BRANDING.logo;
}
