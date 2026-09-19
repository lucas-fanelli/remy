'use client';
import { Box, TextField, Button, Typography, Alert, CircularProgress, Link } from '@mui/material';
import NextLink from 'next/link';
import React, { useEffect, useState } from 'react';
import { MotionBox } from '@/components/motion';
import { BRANDING } from '@/config/branding';
import { useAuth } from '@/contexts/AuthContext';

interface LoginFormProps {
  onSwitchToRegister: () => void;
}

export default function LoginForm({ onSwitchToRegister }: LoginFormProps) {
  const { login } = useAuth();
  const [emailOrUsername, setEmailOrUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [passwordWasReset, setPasswordWasReset] = useState(false);

  // ResetPasswordForm sends the user here as /auth?reset=success
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setPasswordWasReset(params.get('reset') === 'success');
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      await login(emailOrUsername, password);
      // Navigation will happen automatically via AuthContext
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
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
          Your password was updated. Log in with your new password.
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
          placeholder="Email or username"
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
          placeholder="Password"
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
          {isLoading ? <CircularProgress size={24} /> : 'Log In'}
        </Button>
      </Box>

      {/* Forgot password */}
      <Box sx={{ mt: 2, textAlign: 'center' }}>
        <Link
          component={NextLink}
          href="/auth/forgot-password"
          variant="body2"
          sx={{
            color: 'primary.main',
            textDecoration: 'none',
            '&:hover': { textDecoration: 'underline' },
          }}
        >
          Forgot your password?
        </Link>
      </Box>

      {/* Switch to Register */}
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
          Don&apos;t have an account?
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
            Sign up
          </Typography>
        </Box>
      </Box>
    </MotionBox>
  );
}
