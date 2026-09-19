'use client';
import { Box, TextField, Button, Typography, Alert, CircularProgress } from '@mui/material';
import { useTranslations } from 'next-intl';
import React, { useState } from 'react';
import { MotionBox } from '@/components/motion';
import { BRANDING } from '@/config/branding';
import { useAuth } from '@/contexts/AuthContext';

interface RegisterFormProps {
  onSwitchToLogin: () => void;
}

export default function RegisterForm({ onSwitchToLogin }: RegisterFormProps) {
  const t = useTranslations('auth');
  const { register } = useAuth();
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [fullName, setFullName] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      await register(email, username, password, fullName || undefined);
      // Navigation will happen automatically via AuthContext
    } catch (err) {
      setError(err instanceof Error ? err.message : t('errors.registrationFailed'));
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
      <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', mb: 2, gap: 1 }}>
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

      <Typography
        variant="body2"
        align="center"
        color="text.secondary"
        sx={{ mb: 3, fontWeight: 600 }}
      >
        {t('register.tagline')}
      </Typography>

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
          type="email"
          placeholder={t('register.email')}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          disabled={isLoading}
          sx={{ mb: 1.5 }}
          required
        />

        <TextField
          fullWidth
          size="small"
          placeholder={t('register.fullName')}
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          disabled={isLoading}
          sx={{ mb: 1.5 }}
        />

        <TextField
          fullWidth
          size="small"
          placeholder={t('register.username')}
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          disabled={isLoading}
          sx={{ mb: 1.5 }}
          required
        />

        <TextField
          fullWidth
          size="small"
          type="password"
          placeholder={t('register.password')}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          disabled={isLoading}
          sx={{ mb: 1.5 }}
          required
          helperText={t('register.passwordHelper')}
        />

        <Typography
          variant="caption"
          color="text.secondary"
          align="center"
          sx={{ display: 'block', mb: 2, fontSize: '11px' }}
        >
          {t('register.terms')}
        </Typography>

        <Button
          fullWidth
          variant="contained"
          type="submit"
          disabled={isLoading || !email || !username || !password}
          sx={{
            textTransform: 'none',
            fontWeight: 600,
            py: 1,
          }}
        >
          {isLoading ? <CircularProgress size={24} /> : t('register.submit')}
        </Button>
      </Box>

      {/* Switch to Login */}
      <Box
        sx={{
          mt: 3,
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
          {t('register.haveAccount')}
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
            onClick={onSwitchToLogin}
          >
            {t('register.switchToLogin')}
          </Typography>
        </Box>
      </Box>
    </MotionBox>
  );
}
