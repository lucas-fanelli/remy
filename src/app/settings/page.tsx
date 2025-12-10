'use client';

// Force dynamic rendering for this page
export const dynamic = 'force-dynamic';

import React, { useState, useEffect } from 'react';
import {
  Container,
  Box,
  Typography,
  Paper,
  Divider,
  Switch,
  FormControlLabel,
  Toolbar,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Alert,
  Button,
  CircularProgress,
  useTheme,
  useMediaQuery,
  IconButton,
} from '@mui/material';
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
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { useAuth } from '@/contexts/AuthContext';
import { useThemeMode } from '@/contexts/ThemeContext';
import { useToast } from '@/contexts/ToastContext';
import { usePwa } from '@/contexts/PwaContext';
import ChangePasswordDialog from '@/components/settings/ChangePasswordDialog';

const MotionPaper = motion.create(Paper);

export default function SettingsPage() {
  const router = useRouter();
  const { user, isLoading } = useAuth();
  const { mode, toggleTheme } = useThemeMode();
  const { showSuccess, showInfo } = useToast();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const isTablet = useMediaQuery(theme.breakpoints.down('md'));

  const [changePasswordOpen, setChangePasswordOpen] = useState(false);
  const { isInstalled, isRunningStandalone, isIOSSafari, isDesktopChrome, promptAvailable, triggerInstall, openApp } = usePwa();

  useEffect(() => {
    if (!isLoading && !user) {
      router.push('/auth');
      return;
    }
  }, [user, isLoading, router]);

  const handleThemeToggle = () => {
    toggleTheme();
    showSuccess(`Switched to ${mode === 'dark' ? 'light' : 'dark'} mode`);
  };

  if (isLoading) {
    return (
      <Box sx={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <CircularProgress />
      </Box>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <Box sx={{ minHeight: '100vh', pb: { xs: 6, md: 8 }, backgroundColor: 'background.default' }}>
      <Toolbar />

      <Container maxWidth="md" sx={{ pt: { xs: 2, md: 4 }, px: { xs: 2, md: 3 } }}>
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
                fontSize: { xs: '1.75rem', sm: '2rem', md: '2.125rem' }
              }}
            >
              Settings
            </Typography>
          </Box>
          <Typography
            variant="body2"
            color="text.secondary"
            sx={{ fontSize: { xs: '0.875rem', md: '1rem' }, ml: 7 }}
          >
            Manage your account preferences and settings
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
            <Palette sx={{ mr: { xs: 0.75, md: 1 }, color: 'primary.main', fontSize: { xs: '1.25rem', md: '1.5rem' } }} />
            <Typography variant="h6" sx={{ fontSize: { xs: '1.125rem', md: '1.25rem' } }}>
              Appearance
            </Typography>
          </Box>
          <Divider sx={{ mb: { xs: 1.5, md: 2 } }} />

          <FormControlLabel
            control={
              <Switch
                checked={mode === 'dark'}
                onChange={handleThemeToggle}
                color="primary"
              />
            }
            label={
              <Box>
                <Typography variant="body1" sx={{ fontSize: { xs: '0.9375rem', md: '1rem' } }}>
                  Dark Mode
                </Typography>
                <Typography
                  variant="caption"
                  color="text.secondary"
                  sx={{ fontSize: { xs: '0.75rem', md: '0.8125rem' } }}
                >
                  Use dark theme across the app
                </Typography>
              </Box>
            }
          />
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
            <Security sx={{ mr: { xs: 0.75, md: 1 }, color: 'primary.main', fontSize: { xs: '1.25rem', md: '1.5rem' } }} />
            <Typography variant="h6" sx={{ fontSize: { xs: '1.125rem', md: '1.25rem' } }}>
              Privacy & Security
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
                }
              }}
            >
              <ListItemIcon>
                <VpnKey sx={{ fontSize: { xs: '1.25rem', md: '1.5rem' }, color: 'text.primary' }} />
              </ListItemIcon>
              <ListItemText
                primary={
                  <Typography sx={{ fontSize: { xs: '0.9375rem', md: '1rem' }, color: 'text.primary' }}>
                    Change Password
                  </Typography>
                }
                secondary={
                  <Typography
                    variant="caption"
                    color="text.secondary"
                    sx={{ fontSize: { xs: '0.75rem', md: '0.8125rem' } }}
                  >
                    Update your password to keep your account secure
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
            <PhoneIphone sx={{ mr: { xs: 0.75, md: 1 }, color: 'primary.main', fontSize: { xs: '1.25rem', md: '1.5rem' } }} />
            <Typography variant="h6" sx={{ fontSize: { xs: '1.125rem', md: '1.25rem' } }}>
              Install App
            </Typography>
          </Box>
          <Divider sx={{ mb: { xs: 1.5, md: 2 } }} />

          {isRunningStandalone ? (
            // State A: Running in PWA/Standalone mode
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
              <CheckCircle sx={{ color: 'success.main', fontSize: '1.5rem' }} />
              <Typography variant="body1" sx={{ color: 'success.main', fontWeight: 500 }}>
                Running Native App
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
                Remy&apos;s is installed. Tap below to open the app.
              </Typography>
              <Button
                variant="contained"
                startIcon={<OpenInNew />}
                onClick={openApp}
                fullWidth={isMobile}
                sx={{ textTransform: 'none' }}
              >
                Open App
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
                Install Remy&apos;s on your home screen for a faster, native-like experience.
              </Typography>
              <Button
                variant="contained"
                startIcon={<GetApp />}
                onClick={triggerInstall}
                fullWidth={isMobile}
                sx={{ textTransform: 'none' }}
              >
                Install App
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
                Install Remy&apos;s on your home screen for a faster, native-like experience.
              </Typography>
              <Alert severity="info" sx={{ fontSize: { xs: '0.8125rem', md: '0.875rem' } }}>
                Tap the <strong>Share</strong> button in Safari, then select <strong>&quot;Add to Home Screen&quot;</strong>.
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
                Install Remy&apos;s on your home screen for a faster, native-like experience.
              </Typography>
              <Alert severity="info" sx={{ fontSize: { xs: '0.8125rem', md: '0.875rem' } }}>
                Click the <strong>install icon</strong> in your browser&apos;s address bar to install.
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
                If Remy&apos;s is installed, tap below to open it.
              </Typography>
              <Button
                variant="outlined"
                startIcon={<OpenInNew />}
                onClick={openApp}
                fullWidth={isMobile}
                sx={{ textTransform: 'none' }}
              >
                Open App
              </Button>
            </>
          )}
        </MotionPaper>

        {/* Info Alert */}
        <Alert severity="info" sx={{ mb: { xs: 2, md: 3 }, fontSize: { xs: '0.8125rem', md: '0.875rem' } }}>
          These are basic settings for V1. More options will be added in future updates!
        </Alert>
      </Container>

      {/* Change Password Dialog */}
      <ChangePasswordDialog
        open={changePasswordOpen}
        onClose={() => setChangePasswordOpen(false)}
      />
    </Box>
  );
}
