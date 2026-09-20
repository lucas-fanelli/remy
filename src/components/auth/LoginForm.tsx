'use client';
import { Box, TextField, Button, Typography, Alert, CircularProgress, Link } from '@mui/material';
import NextLink from 'next/link';
import { useTranslations } from 'next-intl';
import React, { useEffect, useState } from 'react';
import { MotionBox } from '@/components/motion';
import { BRANDING } from '@/config/branding';
import { useAuth } from '@/contexts/AuthContext';

interface LoginFormProps {
  onSwitchToRegister: () => void;
}

export default function LoginForm({ onSwitchToRegister }: LoginFormProps) {
  const t = useTranslations('auth');
  const { login } = useAuth();
  const [emailOrUsername, setEmailOrUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [passwordWasReset, setPasswordWasReset] = useState(false);

  // ResetPasswordForm sends the user here as /auth?reset=success
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('reset') !== 'success') return;

    setPasswordWasReset(true);

    // One-shot notice: drop the flag so a reload or a bookmark does not repeat it.
    // Deferred so the app router has mounted and hears about the URL change.
    const timer = window.setTimeout(
      () => window.history.replaceState(null, '', window.location.pathname),
      0
    );
    return () => window.clearTimeout(timer);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      await login(emailOrUsername, password);
      // Navigation will happen automatically via AuthContext
    } catch (err) {
      setError(err instanceof Error ? err.message : t('errors.loginFailed'));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <MotionBox
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      sx={{
        width: '100%',
        maxWidth: 350,
        p: 4,
        backgroundColor: 'background.paper',
        borderRadius: 1,
        border: 1,
        borderColor: 'divider',
      }}
    >
      {/* Logo */}
      <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', mb: 3, gap: 1 }}>
        <Box
          component="img"
          src={BRANDING.logo}
          alt={BRANDING.name}
          sx={{ height: 60, width: 60 }}
        />
        <Typography
          variant="h4"
          align="center"
          sx={{
            fontFamily: BRANDING.font,
            fontWeight: 600,
            color: BRANDING.colors.primary,
          }}
        >
          {BRANDING.name}
        </Typography>
      </Box>

      {/* Password reset confirmation */}
      {passwordWasReset && (
        <Alert severity="success" role="status" sx={{ mb: 2 }}>
          {t('login.passwordReset')}
        </Alert>
      )}

      {/* Error Alert */}
      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>
          {error}
        </Alert>
      )}

      {/* Form */}
      <Box component="form" onSubmit={handleSubmit} sx={{ width: '100%' }}>
        <TextField
          fullWidth
          size="small"
          placeholder={t('login.emailOrUsername')}
          value={emailOrUsername}
          onChange={(e) => setEmailOrUsername(e.target.value)}
          disabled={isLoading}
          sx={{ mb: 1.5 }}
          required
        />

        <TextField
          fullWidth
          size="small"
          type="password"
          placeholder={t('login.password')}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          disabled={isLoading}
          sx={{ mb: 2 }}
          required
        />

        <Button
          fullWidth
          variant="contained"
          type="submit"
          disabled={isLoading || !emailOrUsername || !password}
          sx={{
            textTransform: 'none',
            fontWeight: 600,
            py: 1,
          }}
        >
          {isLoading ? <CircularProgress size={24} /> : t('login.submit')}
        </Button>
      </Box>

      {/* Forgot password */}
      <Box sx={{ mt: 1, display: 'flex', justifyContent: 'center' }}>
        <Link
          component={NextLink}
          href="/auth/forgot-password"
          variant="body2"
          sx={{
            // globals.css gives every link a 44px touch target; centre the text inside it
            display: 'inline-flex',
            alignItems: 'center',
            color: 'primary.main',
            textDecoration: 'none',
            '&:hover': { textDecoration: 'underline' },
          }}
        >
          {t('login.forgotPassword')}
        </Link>
      </Box>

      {/* Switch to Register */}
      <Box
        sx={{
          mt: 1,
          p: 2,
          backgroundColor: 'background.paper',
          borderRadius: 1,
          border: 1,
          borderColor: 'divider',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 0.5,
        }}
      >
        <Typography variant="body2" component="span">
          {t('login.noAccount')}
        </Typography>
        <Box component="span" translate="no">
          <Typography
            variant="body2"
            component="span"
            sx={{
              color: 'primary.main',
              fontWeight: 600,
              cursor: 'pointer',
              '&:hover': {
                textDecoration: 'underline',
              },
            }}
            onClick={onSwitchToRegister}
          >
            {t('login.switchToRegister')}
          </Typography>
        </Box>
      </Box>
    </MotionBox>
  );
}
