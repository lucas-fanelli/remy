'use client';
import { Box, TextField, Button, Typography, Alert, CircularProgress, Link } from '@mui/material';
import NextLink from 'next/link';
import React, { useState } from 'react';
import { MotionBox } from '@/components/motion';
import { BRANDING } from '@/config/branding';

const linkSx = {
  color: 'primary.main',
  fontWeight: 600,
  textDecoration: 'none',
  '&:hover': { textDecoration: 'underline' },
} as const;

export default function ForgotPasswordForm() {
  const [emailOrUsername, setEmailOrUsername] = useState('');
  const [fieldError, setFieldError] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const value = emailOrUsername.trim();
    if (!value) {
      setFieldError('Enter your email or username');
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
        setError('Too many attempts. Please wait a few minutes and try again.');
      } else if (response.status === 400) {
        const data = await response.json().catch(() => null);
        setFieldError(data?.error || 'Enter a valid email or username');
      } else {
        setError('Something went wrong. Please try again.');
      }
    } catch {
      setError('Could not reach the server. Check your connection and try again.');
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
        <Box
          component="img"
          src={BRANDING.logo}
          alt={BRANDING.name}
          sx={{ height: 60, width: 60 }}
        />
        <Typography variant="h5" component="h1" align="center" sx={{ fontWeight: 600 }}>
          Forgot your password?
        </Typography>
      </Box>

      {isSubmitted ? (
        <>
          {/* Neutral on purpose: it must not reveal whether the account exists */}
          <Alert severity="info" role="status" sx={{ mb: 2 }}>
            If an account matches, we sent a link to reset your password. Check your spam folder if
            you don&apos;t see it. The link expires in 60 minutes.
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
            Try a different email or username
          </Button>
        </>
      ) : (
        <>
          <Typography variant="body2" align="center" color="text.secondary" sx={{ mb: 3 }}>
            Enter your email or username and we&apos;ll send you a link to choose a new password.
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
              label="Email or username"
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
              sx={{
                textTransform: 'none',
                fontWeight: 600,
                py: 1,
              }}
            >
              {isLoading ? <CircularProgress size={24} aria-label="Sending" /> : 'Send reset link'}
            </Button>
          </Box>
        </>
      )}

      {/* Back to login */}
      <Box
        sx={{
          mt: 2,
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
          Remembered it?
        </Typography>
        <Link component={NextLink} href="/auth" variant="body2" sx={linkSx}>
          Back to log in
        </Link>
      </Box>
    </MotionBox>
  );
}
