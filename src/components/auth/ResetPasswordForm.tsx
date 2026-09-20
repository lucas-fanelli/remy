'use client';
import {
  CheckCircle as CheckCircleIcon,
  RadioButtonUnchecked as UncheckedIcon,
  Visibility,
  VisibilityOff,
} from '@mui/icons-material';
import {
  Box,
  TextField,
  Button,
  Typography,
  Alert,
  CircularProgress,
  IconButton,
  InputAdornment,
  Link,
} from '@mui/material';
import NextLink from 'next/link';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import React, { useLayoutEffect, useState } from 'react';
import { MotionBox } from '@/components/motion';
import { BRANDING } from '@/config/branding';
import { INVALID_RESET_TOKEN_MESSAGE } from '@/domain/errors';
import { useTextDescriptor } from '@/i18n/text';
import { useApiErrorMessage } from '@/lib/api/translateApiError';
import { hardNavigate } from '@/lib/utils/navigation';
import { PASSWORD_RULES, getPasswordIssues } from '@/lib/validation/passwordRules';

interface ResetPasswordFormProps {
  /** Raw token from the emailed link; null when the link carries none */
  token: string | null;
}

// globals.css gives every link a 44px touch target; inline-flex centres the text inside it
const linkSx = {
  display: 'inline-flex',
  alignItems: 'center',
  color: 'primary.main',
  fontWeight: 600,
  textDecoration: 'none',
  '&:hover': { textDecoration: 'underline' },
} as const;

const visuallyHiddenSx = {
  position: 'absolute',
  width: '1px',
  height: '1px',
  overflow: 'hidden',
  clip: 'rect(0 0 0 0)',
  whiteSpace: 'nowrap',
} as const;

// The upper bound only matters to someone pasting a novel; keep the checklist short
const VISIBLE_RULES = PASSWORD_RULES.filter((rule) => rule.id !== 'maxLength');

export default function ResetPasswordForm({ token: tokenFromLink }: ResetPasswordFormProps) {
  const t = useTranslations('auth');
  const tCommon = useTranslations('common');
  // The password rules are a plain list with no locale of its own: it hands back
  // descriptors and this is what turns them into text
  const renderText = useTextDescriptor();
  // The server's machine `code` when it sent one this build knows, its own English
  // sentence when it did not - the client half of the contract in docs/I18N.md
  const apiErrorMessage = useApiErrorMessage();
  // Held in memory only: the address bar is cleaned below, so the prop may come
  // back empty on a later render and must not take the token with it
  const [token] = useState(tokenFromLink);
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState<{ password?: string; confirmPassword?: string }>({});
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  // A missing token is known to be invalid without asking the server
  const [isLinkInvalid, setIsLinkInvalid] = useState(!token);

  // The token is a credential for up to 60 minutes. Take it out of the URL before
  // the first paint so history, analytics, error reports and anything else that
  // records window.location for the life of this page never see it.
  // (Reloading the page therefore shows the invalid state: the email link still works.)
  useLayoutEffect(() => {
    if (!token) return;

    const cleanUrl = window.location.pathname;
    window.history.replaceState(null, '', cleanUrl);

    // The line above is immediate but, this early, can run before Next.js has patched
    // history: the app router would still believe the old URL and write it back on its
    // next state change. Telling the router itself makes the clean URL the canonical one.
    router.replace(cleanUrl, { scroll: false });
  }, [token, router]);

  const validate = (): boolean => {
    const nextErrors: { password?: string; confirmPassword?: string } = {};

    if (!password) {
      nextErrors.password = t('resetPassword.passwordRequired');
    } else {
      const [firstProblem] = getPasswordIssues(password);
      if (firstProblem) nextErrors.password = renderText(firstProblem);
    }

    if (!confirmPassword) {
      nextErrors.confirmPassword = t('resetPassword.confirmRequired');
    } else if (confirmPassword !== password) {
      nextErrors.confirmPassword = t('resetPassword.passwordsDoNotMatch');
    }

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!validate()) return;

    setIsLoading(true);

    try {
      const response = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'fetch' },
        body: JSON.stringify({ token, password }),
      });

      if (response.ok) {
        // Full page load, not router.push: if this browser was logged in, AuthProvider
        // still holds the user whose session the reset just killed. A soft navigation
        // would bounce /auth to the feed as a ghost session and hide the success message.
        hardNavigate('/auth?reset=success');
        return; // stay disabled while the browser leaves
      }

      const data = await response.json().catch(() => null);

      if (response.status === 429) {
        setError(t('errors.rateLimited'));
      } else if (response.status === 400 && data?.error === INVALID_RESET_TOKEN_MESSAGE) {
        setIsLinkInvalid(true);
      } else if (response.status === 400) {
        setErrors({ password: apiErrorMessage(data, t('resetPassword.chooseDifferent')) });
      } else {
        setError(tCommon('states.errorRetry'));
      }
    } catch {
      setError(t('errors.network'));
    }

    setIsLoading(false);
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
          {isLinkInvalid ? t('resetPassword.invalidTitle') : t('resetPassword.title')}
        </Typography>
      </Box>

      {isLinkInvalid ? (
        <>
          {/* One generic state for missing, unknown, used and expired links */}
          <Alert severity="error" sx={{ mb: 2 }}>
            {t('resetPassword.invalidLink')}
          </Alert>
          <Button
            fullWidth
            variant="contained"
            component={NextLink}
            href="/auth/forgot-password"
            sx={{ textTransform: 'none', fontWeight: 600, py: 1 }}
          >
            {t('resetPassword.requestNewLink')}
          </Button>
        </>
      ) : (
        <>
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
              id="reset-password-new"
              name="password"
              label={t('resetPassword.newPassword')}
              type={showPassword ? 'text' : 'password'}
              autoComplete="new-password"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                if (errors.password) setErrors((prev) => ({ ...prev, password: undefined }));
              }}
              disabled={isLoading}
              error={!!errors.password}
              helperText={errors.password || ' '}
              slotProps={{
                // No maxLength: silently truncating a pasted password would lock the user out
                htmlInput: {
                  'aria-describedby': 'reset-password-rules reset-password-new-helper-text',
                },
                input: {
                  endAdornment: (
                    <InputAdornment position="end">
                      <IconButton
                        // Fixed name + aria-pressed: the state is announced, the name never flips
                        aria-label={t('resetPassword.showPasswords')}
                        aria-pressed={showPassword}
                        onClick={() => setShowPassword((prev) => !prev)}
                        onMouseDown={(e) => e.preventDefault()}
                        edge="end"
                        size="small"
                        disabled={isLoading}
                      >
                        {showPassword ? (
                          <VisibilityOff fontSize="small" />
                        ) : (
                          <Visibility fontSize="small" />
                        )}
                      </IconButton>
                    </InputAdornment>
                  ),
                },
              }}
              sx={{ mb: 0.5 }}
              required
            />

            {/* Password rules, ticked off as the user types */}
            <Box
              component="ul"
              id="reset-password-rules"
              aria-label={t('resetPassword.requirements')}
              sx={{ listStyle: 'none', p: 0, m: 0, mb: 2 }}
            >
              {VISIBLE_RULES.map((rule) => {
                const isMet = rule.test(password);
                return (
                  <Box
                    component="li"
                    key={rule.id}
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 0.75,
                      color: isMet ? 'success.main' : 'text.secondary',
                    }}
                  >
                    {isMet ? (
                      <CheckCircleIcon sx={{ fontSize: 16 }} aria-hidden />
                    ) : (
                      <UncheckedIcon sx={{ fontSize: 16 }} aria-hidden />
                    )}
                    <Typography variant="caption" component="span">
                      {renderText(rule.label)}
                      {/* Colour alone must not carry the state */}
                      <Box component="span" sx={visuallyHiddenSx}>
                        {isMet ? t('resetPassword.ruleMet') : t('resetPassword.ruleNotMet')}
                      </Box>
                    </Typography>
                  </Box>
                );
              })}
            </Box>

            <TextField
              fullWidth
              size="small"
              id="reset-password-confirm"
              name="confirmPassword"
              label={t('resetPassword.confirmPassword')}
              type={showPassword ? 'text' : 'password'}
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(e) => {
                setConfirmPassword(e.target.value);
                if (errors.confirmPassword) {
                  setErrors((prev) => ({ ...prev, confirmPassword: undefined }));
                }
              }}
              disabled={isLoading}
              error={!!errors.confirmPassword}
              helperText={errors.confirmPassword || ' '}
              sx={{ mb: 1 }}
              required
            />

            <Button
              fullWidth
              variant="contained"
              type="submit"
              disabled={isLoading}
              aria-label={isLoading ? t('resetPassword.submitting') : undefined}
              sx={{
                textTransform: 'none',
                fontWeight: 600,
                py: 1,
              }}
            >
              {isLoading ? <CircularProgress size={24} aria-hidden /> : t('resetPassword.submit')}
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
        }}
      >
        <Link component={NextLink} href="/auth" variant="body2" sx={linkSx}>
          {t('resetPassword.backToLogin')}
        </Link>
      </Box>
    </MotionBox>
  );
}
