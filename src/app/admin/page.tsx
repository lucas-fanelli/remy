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
  Container,
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
import React, { useCallback, useEffect, useState } from 'react';
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
  const router = useRouter();
  const theme = useTheme();
  const { user, isAdmin } = useAuth();
  const { isReady, isLoading: guardLoading } = useAdminGuard();
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchStats = useCallback(async () => {
    try {
      const response = await fetch('/api/admin/stats');

      if (!response.ok) {
        throw new Error('Failed to fetch stats');
      }

      const data = await response.json();
      setStats(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load stats');
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

  const statCards = [
    {
      label: 'Total Users',
      value: stats?.totalUsers || 0,
      icon: <People />,
      color: theme.palette.primary.main,
    },
    {
      label: 'Total Admins',
      value: stats?.totalAdmins || 0,
      icon: <AdminPanelSettings />,
      color: theme.palette.warning.main,
    },
    {
      label: 'Total Recipes',
      value: stats?.totalRecipes || 0,
      icon: <Restaurant />,
      color: theme.palette.success.main,
    },
    {
      label: 'Total Comments',
      value: stats?.totalComments || 0,
      icon: <Comment />,
      color: theme.palette.info.main,
    },
    {
      label: 'Total Likes',
      value: stats?.totalLikes || 0,
      icon: <Favorite />,
      color: theme.palette.error.main,
    },
    {
      label: 'New Today',
      value: (stats?.newUsersToday || 0) + (stats?.newRecipesToday || 0),
      icon: <TrendingUp />,
      color: theme.palette.secondary.main,
    },
  ];

  const managementCards = [
    {
      label: 'Manage Users',
      description: 'View, promote, demote, or delete users',
      href: '/admin/users',
      icon: <People sx={{ fontSize: 40 }} />,
    },
    {
      label: 'Manage Recipes',
      description: 'View or delete recipes',
      href: '/admin/recipes',
      icon: <Restaurant sx={{ fontSize: 40 }} />,
    },
    {
      label: 'Manage Comments',
      description: 'View or delete comments',
      href: '/admin/comments',
      icon: <Comment sx={{ fontSize: 40 }} />,
    },
  ];

  return (
    <Box
      sx={{
        minHeight: '100vh',
        pt: { xs: 10, md: 12 },
        pb: { xs: 10, md: 6 },
        backgroundColor: theme.palette.background.default,
      }}
    >
      <Container maxWidth="lg">
        <Box sx={{ mb: 4 }}>
          <Typography variant="h4" fontWeight={700} color="text.primary" gutterBottom>
            Admin Dashboard
          </Typography>
          <Typography variant="body1" color="text.secondary">
            Welcome back, {user?.username}. Here&apos;s an overview of your platform.
          </Typography>
        </Box>

        {error && (
          <Paper sx={{ p: 2, mb: 4, bgcolor: 'error.light' }}>
            <Typography color="error.contrastText">{error}</Typography>
          </Paper>
        )}

        {/* Stats Grid */}
        {stats && (
          <Grid container spacing={3} sx={{ mb: 6 }}>
            {statCards.map((stat) => (
              <Grid item xs={6} sm={4} md={2} key={stat.label}>
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
                    {stat.value.toLocaleString()}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {stat.label}
                  </Typography>
                </Paper>
              </Grid>
            ))}
          </Grid>
        )}

        {/* Management Cards */}
        <Typography variant="h5" fontWeight={600} color="text.primary" gutterBottom sx={{ mb: 3 }}>
          Management
        </Typography>
        <Grid container spacing={3}>
          {managementCards.map((card) => (
            <Grid item xs={12} sm={6} md={4} key={card.label}>
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
                      {card.label}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      {card.description}
                    </Typography>
                  </CardContent>
                </CardActionArea>
              </Card>
            </Grid>
          ))}
        </Grid>
      </Container>
    </Box>
  );
}
