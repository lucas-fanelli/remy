'use client';

import {
  Security,
  Palette,
  VpnKey,
  ArrowBack,
  GetApp,
  PhoneIphone,
  CheckCircle,
  OpenInNew,
} from '@mui/icons-material';
import {
  Box,
  Typography,
  Divider,
  Switch,
  FormControlLabel,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Alert,
  Button,
  useTheme,
  useMediaQuery,
  IconButton,
} from '@mui/material';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import React, { useState, useEffect } from 'react';
import LanguageSwitcher from '@/components/common/LanguageSwitcher';
import PageFrame from '@/components/layout/PageFrame';
import { MotionPaper } from '@/components/motion';
import ChangePasswordDialog from '@/components/settings/ChangePasswordDialog';
import { BRANDING } from '@/config/branding';
import { useAuth } from '@/contexts/AuthContext';
import { usePwa } from '@/contexts/PwaContext';
import { useThemeMode } from '@/contexts/ThemeContext';
import { useToast } from '@/contexts/ToastContext';

export default function SettingsPage() {
  const t = useTranslations('settings');
  const router = useRouter();
  const { user, isLoading } = useAuth();
  const { mode, toggleTheme } = useThemeMode();
  const { showSuccess } = useToast();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  const [changePasswordOpen, setChangePasswordOpen] = useState(false);
  const {
    isInstalled,
    isRunningStandalone,
    isIOSSafari,
    isDesktopChrome,
    promptAvailable,
    triggerInstall,
    openApp,
  } = usePwa();

  useEffect(() => {
    if (!isLoading && !user) {
      router.push('/auth');
      return;
    }
  }, [user, isLoading, router]);

  const handleThemeToggle = () => {
    toggleTheme();
    showSuccess(t('appearance.themeChanged', { mode: mode === 'dark' ? 'light' : 'dark' }));
  };

  if (isLoading) {
    return null;
  }

  if (!user) {
    return null;
  }

  return (
    <>
      <PageFrame width="reading">
        {/* Header */}
        <Box sx={{ mb: { xs: 3, md: 4 } }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 1 }}>
            <IconButton onClick={() => router.back()} edge="start">
              <ArrowBack />
            </IconButton>
            <Typography
              variant="h4"
              component="h1"
              sx={{
                color: 'text.primary',
                fontSize: { xs: '1.75rem', sm: '2rem', md: '2.125rem' },
              }}
            >
              {t('title')}
            </Typography>
          </Box>
          <Typography
            variant="body2"
            color="text.secondary"
            sx={{ fontSize: { xs: '0.875rem', md: '1rem' }, ml: 7 }}
          >
            {t('subtitle')}
          </Typography>
        </Box>

        {/* Appearance Settings */}
        <MotionPaper
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          elevation={2}
          sx={{ p: { xs: 2, md: 3 }, mb: { xs: 2, md: 3 } }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', mb: { xs: 1.5, md: 2 } }}>
            <Palette
              sx={{
                mr: { xs: 0.75, md: 1 },
                color: 'primary.main',
                fontSize: { xs: '1.25rem', md: '1.5rem' },
              }}
            />
            <Typography variant="h6" sx={{ fontSize: { xs: '1.125rem', md: '1.25rem' } }}>
              {t('appearance.title')}
            </Typography>
          </Box>
          <Divider sx={{ mb: { xs: 1.5, md: 2 } }} />

          <FormControlLabel
            control={
              <Switch checked={mode === 'dark'} onChange={handleThemeToggle} color="primary" />
            }
            label={
              <Box>
                <Typography variant="body1" sx={{ fontSize: { xs: '0.9375rem', md: '1rem' } }}>
                  {t('appearance.darkMode')}
                </Typography>
                <Typography
                  variant="caption"
                  color="text.secondary"
                  sx={{ fontSize: { xs: '0.75rem', md: '0.8125rem' } }}
                >
                  {t('appearance.darkModeDescription')}
                </Typography>
              </Box>
            }
          />

          {/* Language sits with the other presentation choices, and is stored the same way:
              a cookie, so it survives logging out and back in */}
          <Box sx={{ mt: { xs: 2, md: 3 } }}>
            <LanguageSwitcher showLabel showDescription />
          </Box>
        </MotionPaper>

        {/* Privacy & Security */}
        <MotionPaper
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          elevation={2}
          sx={{ p: { xs: 2, md: 3 }, mb: { xs: 2, md: 3 } }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', mb: { xs: 1.5, md: 2 } }}>
            <Security
              sx={{
                mr: { xs: 0.75, md: 1 },
                color: 'primary.main',
                fontSize: { xs: '1.25rem', md: '1.5rem' },
              }}
            />
            <Typography variant="h6" sx={{ fontSize: { xs: '1.125rem', md: '1.25rem' } }}>
              {t('security.title')}
            </Typography>
          </Box>
          <Divider sx={{ mb: { xs: 1.5, md: 2 } }} />

          <List sx={{ px: { xs: 0, md: 0 } }}>
            <ListItem
              component="button"
              onClick={() => setChangePasswordOpen(true)}
              sx={{
                borderRadius: 1,
                mb: 1,
                cursor: 'pointer',
                border: 'none',
                background: 'transparent',
                width: '100%',
                textAlign: 'left',
                px: { xs: 0, md: 2 },
                '&:hover': {
                  backgroundColor: 'action.hover',
                },
              }}
            >
              <ListItemIcon>
                <VpnKey sx={{ fontSize: { xs: '1.25rem', md: '1.5rem' }, color: 'text.primary' }} />
              </ListItemIcon>
              <ListItemText
                primary={
                  <Typography
                    sx={{ fontSize: { xs: '0.9375rem', md: '1rem' }, color: 'text.primary' }}
                  >
                    {t('security.changePassword')}
                  </Typography>
                }
                secondary={
                  <Typography
                    variant="caption"
                    color="text.secondary"
                    sx={{ fontSize: { xs: '0.75rem', md: '0.8125rem' } }}
                  >
                    {t('security.changePasswordDescription')}
                  </Typography>
                }
              />
            </ListItem>
          </List>
        </MotionPaper>

        {/* App Installation */}
        <MotionPaper
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.3 }}
          elevation={2}
          sx={{ p: { xs: 2, md: 3 }, mb: { xs: 2, md: 3 } }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', mb: { xs: 1.5, md: 2 } }}>
            <PhoneIphone
              sx={{
                mr: { xs: 0.75, md: 1 },
                color: 'primary.main',
                fontSize: { xs: '1.25rem', md: '1.5rem' },
              }}
            />
            <Typography variant="h6" sx={{ fontSize: { xs: '1.125rem', md: '1.25rem' } }}>
              {t('install.title')}
            </Typography>
          </Box>
          <Divider sx={{ mb: { xs: 1.5, md: 2 } }} />

          {isRunningStandalone ? (
            // State A: Running in PWA/Standalone mode
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
              <CheckCircle sx={{ color: 'success.main', fontSize: '1.5rem' }} />
              <Typography variant="body1" sx={{ color: 'success.main', fontWeight: 500 }}>
                {t('install.running')}
              </Typography>
            </Box>
          ) : isInstalled ? (
            // State B: App is installed but viewing in browser - show Open App
            <>
              <Typography
                variant="body2"
                color="text.secondary"
                sx={{ mb: 2, fontSize: { xs: '0.875rem', md: '1rem' } }}
              >
                {t('install.installedIntro', { name: BRANDING.name })}
              </Typography>
              <Button
                variant="contained"
                startIcon={<OpenInNew />}
                onClick={openApp}
                fullWidth={isMobile}
                sx={{ textTransform: 'none' }}
              >
                {t('install.openApp')}
              </Button>
            </>
          ) : promptAvailable ? (
            // State C: Install prompt available
            <>
              <Typography
                variant="body2"
                color="text.secondary"
                sx={{ mb: 2, fontSize: { xs: '0.875rem', md: '1rem' } }}
              >
                {t('install.installIntro', { name: BRANDING.name })}
              </Typography>
              <Button
                variant="contained"
                startIcon={<GetApp />}
                onClick={triggerInstall}
                fullWidth={isMobile}
                sx={{ textTransform: 'none' }}
              >
                {t('install.installApp')}
              </Button>
            </>
          ) : isIOSSafari ? (
            // iOS Safari instructions
            <>
              <Typography
                variant="body2"
                color="text.secondary"
                sx={{ mb: 2, fontSize: { xs: '0.875rem', md: '1rem' } }}
              >
                {t('install.installIntro', { name: BRANDING.name })}
              </Typography>
              <Alert severity="info" sx={{ fontSize: { xs: '0.8125rem', md: '0.875rem' } }}>
                {t.rich('install.iosInstructions', {
                  b: (chunks) => <strong>{chunks}</strong>,
                })}
              </Alert>
            </>
          ) : isDesktopChrome ? (
            // Desktop Chrome - address bar install
            <>
              <Typography
                variant="body2"
                color="text.secondary"
                sx={{ mb: 2, fontSize: { xs: '0.875rem', md: '1rem' } }}
              >
                {t('install.installIntro', { name: BRANDING.name })}
              </Typography>
              <Alert severity="info" sx={{ fontSize: { xs: '0.8125rem', md: '0.875rem' } }}>
                {t.rich('install.chromeInstructions', {
                  b: (chunks) => <strong>{chunks}</strong>,
                })}
              </Alert>
            </>
          ) : (
            // Fallback: Show Open App button (may trigger OS to switch)
            <>
              <Typography
                variant="body2"
                color="text.secondary"
                sx={{ mb: 2, fontSize: { xs: '0.875rem', md: '1rem' } }}
              >
                {t('install.fallbackIntro', { name: BRANDING.name })}
              </Typography>
              <Button
                variant="outlined"
                startIcon={<OpenInNew />}
                onClick={openApp}
                fullWidth={isMobile}
                sx={{ textTransform: 'none' }}
              >
                {t('install.openApp')}
              </Button>
            </>
          )}
        </MotionPaper>

        {/* Info Alert */}
        <Alert
          severity="info"
          sx={{ mb: { xs: 2, md: 3 }, fontSize: { xs: '0.8125rem', md: '0.875rem' } }}
        >
          {t('notice')}
        </Alert>
      </PageFrame>

      {/* Change Password Dialog */}
      <ChangePasswordDialog
        open={changePasswordOpen}
        onClose={() => setChangePasswordOpen(false)}
      />
    </>
  );
}
