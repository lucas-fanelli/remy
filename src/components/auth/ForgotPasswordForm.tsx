'use client';
import { Box, TextField, Button, Typography, Alert, CircularProgress, Link } from '@mui/material';
import NextLink from 'next/link';
import { useTranslations } from 'next-intl';
import React, { useEffect, useRef, useState } from 'react';
import { MotionBox } from '@/components/motion';
import { BRANDING } from '@/config/branding';
import { useBrandLogo } from '@/config/useBrandLogo';
import { useApiErrorMessage } from '@/lib/api/translateApiError';

// globals.css gives every link a 44px touch target; inline-flex centres the text inside it
const linkSx = {
  display: 'inline-flex',
  alignItems: 'center',
  color: 'primary.main',
  fontWeight: 600,
  textDecoration: 'none',
  '&:hover': { textDecoration: 'underline' },
} as const;

export default function ForgotPasswordForm() {
  const brandLogo = useBrandLogo();
  const t = useTranslations('auth');
  const tCommon = useTranslations('common');
  // The server's machine `code` when it sent one this build knows, its own English
  // sentence when it did not - the client half of the contract in docs/I18N.md
  const apiErrorMessage = useApiErrorMessage();
  const [emailOrUsername, setEmailOrUsername] = useState('');
  const [fieldError, setFieldError] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const confirmationRef = useRef<HTMLDivElement>(null);

  // The form (and the focused button) is replaced by the confirmation: move focus
  // there, or keyboard and screen reader users are left on <body> with no announcement
  useEffect(() => {
    if (isSubmitted) confirmationRef.current?.focus();
  }, [isSubmitted]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const value = emailOrUsername.trim();
    if (!value) {
      setFieldError(t('forgotPassword.identifierRequired'));
      return;
    }

    setFieldError('');
    setIsLoading(true);

    try {
      const response = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'fetch' },
        body: JSON.stringify({ emailOrUsername: value }),
      });

      if (response.ok) {
        setIsSubmitted(true);
      } else if (response.status === 429) {
        setError(t('errors.rateLimited'));
      } else if (response.status === 400) {
        const data = await response.json().catch(() => null);
        setFieldError(apiErrorMessage(data, t('forgotPassword.identifierInvalid')));
      } else {
        setError(tCommon('states.errorRetry'));
      }
    } catch {
      setError(t('errors.network'));
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
        p: { xs: 3, sm: 4 },
        backgroundColor: 'background.paper',
        borderRadius: 1,
        border: 1,
        borderColor: 'divider',
      }}
    >
      {/* Logo */}
      <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', mb: 2, gap: 1 }}>
        <Box component="img" src={brandLogo} alt={BRANDING.name} sx={{ height: 60, width: 60 }} />
        <Typography variant="h5" component="h1" align="center" sx={{ fontWeight: 600 }}>
          {t('forgotPassword.title')}
        </Typography>
      </Box>

      {isSubmitted ? (
        <>
          {/* Neutral on purpose: it must not reveal whether the account exists */}
          <Alert severity="info" role="status" ref={confirmationRef} tabIndex={-1} sx={{ mb: 2 }}>
            {t('forgotPassword.confirmation')}
          </Alert>
          <Button
            fullWidth
            variant="text"
            onClick={() => {
              setIsSubmitted(false);
              setEmailOrUsername('');
            }}
            sx={{ textTransform: 'none', fontWeight: 600 }}
          >
            {t('forgotPassword.tryAnother')}
          </Button>
        </>
      ) : (
        <>
          <Typography variant="body2" align="center" color="text.secondary" sx={{ mb: 3 }}>
            {t('forgotPassword.intro')}
          </Typography>

          {/* Error Alert */}
          {error && (
            <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>
              {error}
            </Alert>
          )}

          {/* Form */}
          <Box component="form" onSubmit={handleSubmit} noValidate sx={{ width: '100%' }}>
            <TextField
              fullWidth
              size="small"
              id="forgot-password-identifier"
              name="emailOrUsername"
              label={t('forgotPassword.identifier')}
              autoComplete="username"
              value={emailOrUsername}
              onChange={(e) => {
                setEmailOrUsername(e.target.value);
                if (fieldError) setFieldError('');
              }}
              disabled={isLoading}
              error={!!fieldError}
              helperText={fieldError || ' '}
              slotProps={{
                htmlInput: { autoCapitalize: 'none', autoCorrect: 'off', spellCheck: false },
              }}
              sx={{ mb: 1 }}
              required
            />

            <Button
              fullWidth
              variant="contained"
              type="submit"
              disabled={isLoading}
              aria-label={isLoading ? t('forgotPassword.submitting') : undefined}
              sx={{
                textTransform: 'none',
                fontWeight: 600,
                py: 1,
              }}
            >
              {isLoading ? <CircularProgress size={24} aria-hidden /> : t('forgotPassword.submit')}
            </Button>
          </Box>
        </>
      )}

      {/* Back to login */}
      <Box
        sx={{
          mt: 2,
          px: 2,
          py: 0.5,
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
          {t('forgotPassword.rememberedIt')}
        </Typography>
        <Link component={NextLink} href="/auth" variant="body2" sx={linkSx}>
          {t('forgotPassword.backToLogin')}
        </Link>
      </Box>
    </MotionBox>
  );
}
