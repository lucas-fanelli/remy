'use client';

import { Box, ToggleButton, ToggleButtonGroup, Typography } from '@mui/material';
import { useRouter } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import React from 'react';
import { LOCALES, LOCALE_LABELS, isLocale, localeCookieString, type Locale } from '@/i18n/config';

interface LanguageSwitcherProps {
  /** Adds the 'Language' heading above the buttons. Off inside menus, which are tight. */
  showLabel?: boolean;
  /** Adds the one-line explanation under the heading (Settings page). Needs showLabel. */
  showDescription?: boolean;
  size?: 'small' | 'medium';
  /** Called after the language changed, so a menu or drawer can close itself. */
  onChanged?: () => void;
}

/**
 * Español / English.
 *
 * Writing the cookie and calling router.refresh() is the whole mechanism: the server
 * re-renders the current route in the new language and React reconciles it into the page,
 * so nothing reloads and no component state is lost. The cookie is what makes the choice
 * survive a refresh, a logout and a login - it is never tied to the session.
 */
export default function LanguageSwitcher({
  showLabel = false,
  showDescription = false,
  size = 'small',
  onChanged,
}: LanguageSwitcherProps) {
  const t = useTranslations('common');
  const locale = useLocale();
  const router = useRouter();

  const handleChange = (_event: React.MouseEvent<HTMLElement>, next: string | null) => {
    // ToggleButtonGroup reports null when the active button is clicked again
    if (!isLocale(next) || next === locale) return;

    document.cookie = localeCookieString(next);
    router.refresh();
    onChanged?.();
  };

  const group = (
    <ToggleButtonGroup
      exclusive
      size={size}
      value={locale}
      onChange={handleChange}
      aria-label={t('language.label')}
    >
      {LOCALES.map((option: Locale) => (
        <ToggleButton
          key={option}
          value={option}
          // The language names are written in their own language, so say so: a screen
          // reader then pronounces 'Español' in Spanish even on an English page.
          lang={option}
          sx={{ textTransform: 'none', px: 1.5 }}
        >
          {LOCALE_LABELS[option]}
        </ToggleButton>
      ))}
    </ToggleButtonGroup>
  );

  if (!showLabel) return group;

  return (
    <Box>
      <Typography variant="body1" sx={{ fontSize: { xs: '0.9375rem', md: '1rem' } }}>
        {t('language.label')}
      </Typography>
      {showDescription && (
        <Typography
          variant="caption"
          color="text.secondary"
          sx={{ display: 'block', mb: 1, fontSize: { xs: '0.75rem', md: '0.8125rem' } }}
        >
          {t('language.description')}
        </Typography>
      )}
      {group}
    </Box>
  );
}
