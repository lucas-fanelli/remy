// TODO: Extract a shared useAdminTable hook or AdminTable component that encapsulates:
//   - Search input with debounce
//   - Pagination state (page, limit, total)
//   - Bulk selection and bulk action dispatch
//   - Loading/error states and retry logic
// This would deduplicate ~80 lines of repeated logic across:
//   - src/app/admin/users/page.tsx
//   - src/app/admin/recipes/page.tsx
//   - src/app/admin/comments/page.tsx
'use client';

import {
  People,
  Restaurant,
  Comment,
  Favorite,
  AdminPanelSettings,
  TrendingUp,
} from '@mui/icons-material';
import {
  Box,
  Typography,
  Paper,
  Grid,
  CircularProgress,
  Card,
  CardContent,
  CardActionArea,
  useTheme,
} from '@mui/material';
import { useRouter } from 'next/navigation';
import { useFormatter, useTranslations } from 'next-intl';
import React, { useCallback, useEffect, useState } from 'react';
import PageFrame from '@/components/layout/PageFrame';
import { useAuth } from '@/contexts/AuthContext';
import { useAdminGuard } from '@/hooks/useAdminGuard';

interface AdminStats {
  totalUsers: number;
  totalAdmins: number;
  totalRecipes: number;
  totalComments: number;
  totalLikes: number;
  newUsersToday: number;
  newRecipesToday: number;
}

export default function AdminDashboard() {
  const t = useTranslations('admin');
  const format = useFormatter();
  const router = useRouter();
  const theme = useTheme();
  const { user, isAdmin } = useAuth();
  const { isReady, isLoading: guardLoading } = useAdminGuard();
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [loading, setLoading] = useState(true);
  // A flag rather than a sentence: the message is looked up at render time, so the banner
  // follows the language even if the user switches it after the request failed.
  const [loadFailed, setLoadFailed] = useState(false);

  const fetchStats = useCallback(async () => {
    try {
      const response = await fetch('/api/admin/stats');

      if (!response.ok) {
        throw new Error('Failed to fetch stats');
      }

      const data = await response.json();
      setStats(data);
    } catch (err) {
      console.error('Error fetching stats:', err);
      setLoadFailed(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isReady) {
      fetchStats();
    }
  }, [isReady, fetchStats]);

  if (guardLoading || loading) {
    return (
      <Box
        sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}
      >
        <CircularProgress />
      </Box>
    );
  }

  if (!isAdmin) {
    return null;
  }

  // Each card's `id` is its key under admin.dashboard.stats / .management - a closed union,
  // which is the one case where a message key may be built from a variable.
  const statCards = [
    {
      id: 'totalUsers',
      value: stats?.totalUsers || 0,
      icon: <People />,
      color: theme.palette.primary.main,
    },
    {
      id: 'totalAdmins',
      value: stats?.totalAdmins || 0,
      icon: <AdminPanelSettings />,
      color: theme.palette.warning.main,
    },
    {
      id: 'totalRecipes',
      value: stats?.totalRecipes || 0,
      icon: <Restaurant />,
      color: theme.palette.success.main,
    },
    {
      id: 'totalComments',
      value: stats?.totalComments || 0,
      icon: <Comment />,
      color: theme.palette.info.main,
    },
    {
      id: 'totalLikes',
      value: stats?.totalLikes || 0,
      icon: <Favorite />,
      color: theme.palette.error.main,
    },
    {
      id: 'newToday',
      value: (stats?.newUsersToday || 0) + (stats?.newRecipesToday || 0),
      icon: <TrendingUp />,
      color: theme.palette.secondary.main,
    },
  ] as const;

  const managementCards = [
    { id: 'users', href: '/admin/users', icon: <People sx={{ fontSize: 40 }} /> },
    { id: 'recipes', href: '/admin/recipes', icon: <Restaurant sx={{ fontSize: 40 }} /> },
    { id: 'comments', href: '/admin/comments', icon: <Comment sx={{ fontSize: 40 }} /> },
  ] as const;

  return (
    <Box
      sx={{
        pt: { xs: 10, md: 12 },
        pb: { xs: 10, md: 6 },
        backgroundColor: theme.palette.background.default,
      }}
    >
      <PageFrame>
        <Box sx={{ mb: 4 }}>
          <Typography variant="h4" fontWeight={700} color="text.primary" gutterBottom>
            {t('dashboard.title')}
          </Typography>
          <Typography variant="body1" color="text.secondary">
            {t('dashboard.welcome', { username: user?.username ?? '' })}
          </Typography>
        </Box>

        {loadFailed && (
          <Paper sx={{ p: 2, mb: 4, bgcolor: 'error.light' }}>
            <Typography color="error.contrastText">{t('dashboard.statsError')}</Typography>
          </Paper>
        )}

        {/* Stats Grid */}
        {stats && (
          <Grid container spacing={3} sx={{ mb: 6 }}>
            {statCards.map((stat) => (
              <Grid item xs={6} sm={4} md={2} key={stat.id}>
                <Paper
                  elevation={0}
                  sx={{
                    p: 2,
                    textAlign: 'center',
                    borderRadius: 2,
                    border: `1px solid ${theme.palette.divider}`,
                    height: '100%',
                  }}
                >
                  <Box sx={{ color: stat.color, mb: 1 }}>{stat.icon}</Box>
                  <Typography variant="h4" fontWeight={700} color="text.primary">
                    {format.number(stat.value)}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {t(`dashboard.stats.${stat.id}`)}
                  </Typography>
                </Paper>
              </Grid>
            ))}
          </Grid>
        )}

        {/* Management Cards */}
        <Typography variant="h5" fontWeight={600} color="text.primary" gutterBottom sx={{ mb: 3 }}>
          {t('dashboard.management.title')}
        </Typography>
        <Grid container spacing={3}>
          {managementCards.map((card) => (
            <Grid item xs={12} sm={6} md={4} key={card.id}>
              <Card
                elevation={0}
                sx={{
                  border: `1px solid ${theme.palette.divider}`,
                  height: '100%',
                  '&:hover': {
                    borderColor: theme.palette.primary.main,
                  },
                }}
              >
                <CardActionArea
                  onClick={() => router.push(card.href)}
                  sx={{ height: '100%', p: 2 }}
                >
                  <CardContent sx={{ textAlign: 'center' }}>
                    <Box sx={{ color: 'primary.main', mb: 2 }}>{card.icon}</Box>
                    <Typography variant="h6" fontWeight={600} gutterBottom color="text.primary">
                      {t(`dashboard.management.${card.id}.label`)}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      {t(`dashboard.management.${card.id}.description`)}
                    </Typography>
                  </CardContent>
                </CardActionArea>
              </Card>
            </Grid>
          ))}
        </Grid>
      </PageFrame>
    </Box>
  );
}
