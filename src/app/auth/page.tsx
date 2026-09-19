'use client';

import { Box, Container, Typography, Link } from '@mui/material';
import NextLink from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import React, { Suspense, useState, useEffect, useRef } from 'react';
import LoginForm from '@/components/auth/LoginForm';
import RegisterForm from '@/components/auth/RegisterForm';
import LanguageSwitcher from '@/components/common/LanguageSwitcher';
import { useAuth } from '@/contexts/AuthContext';
import { CREATE_INTENT, useCreateRecipeDialog } from '@/contexts/CreateRecipeContext';

/**
 * The only post-login redirect. `next` is a FIXED token mapped here, never a URL, so there
 * is no open-redirect surface: 'create' returns the visitor to what they came for - the
 * 'New recipe' dialog, with their draft if they have one. Reads the query string, so it
 * sits under Suspense like the search page does.
 */
function PostLoginRedirect() {
  const { isAuthenticated, isLoading } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { openCreate } = useCreateRecipeDialog();
  const wantsCreate = searchParams.get('next') === CREATE_INTENT;
  const handled = useRef(false);

  useEffect(() => {
    if (isLoading || !isAuthenticated || handled.current) return;
    handled.current = true;
    router.push('/');
    if (wantsCreate) openCreate();
  }, [isAuthenticated, isLoading, router, wantsCreate, openCreate]);

  return null;
}

export default function AuthPage() {
  const [isLogin, setIsLogin] = useState(true);
  const { isLoading } = useAuth();

  if (isLoading) {
    return (
      <Box
        sx={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: 'background.default',
        }}
      >
        Loading...
      </Box>
    );
  }

  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'background.default',
      }}
    >
      <Suspense fallback={null}>
        <PostLoginRedirect />
      </Suspense>
      <Container maxWidth="sm">
        <Box
          sx={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
          }}
        >
          {isLogin ? (
            <LoginForm onSwitchToRegister={() => setIsLogin(false)} />
          ) : (
            <RegisterForm onSwitchToLogin={() => setIsLogin(true)} />
          )}

          {/* Browse as Guest */}
          <Typography variant="body2" color="text.secondary" sx={{ mt: 3 }}>
            Just browsing?{' '}
            <Link
              component={NextLink}
              href="/"
              sx={{
                color: 'primary.main',
                textDecoration: 'none',
                fontWeight: 500,
                '&:hover': { textDecoration: 'underline' },
              }}
            >
              Continue as Guest
            </Link>
          </Typography>

          {/* A visitor who has not logged in yet must be able to choose the language too:
              the choice lives in a cookie, not in the session, so it survives logging in */}
          <Box sx={{ mt: 3 }}>
            <LanguageSwitcher />
          </Box>
        </Box>
      </Container>
    </Box>
  );
}
