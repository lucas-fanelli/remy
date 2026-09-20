'use client';

import { Search, Delete, ArrowUpward, ArrowDownward, ArrowBack, Person } from '@mui/icons-material';
import {
  Box,
  Container,
  Typography,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TablePagination,
  Avatar,
  Chip,
  IconButton,
  TextField,
  InputAdornment,
  CircularProgress,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  Tooltip,
  Alert,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
} from '@mui/material';
import { useRouter } from 'next/navigation';
import { useFormatter, useTranslations } from 'next-intl';
import React, { useEffect, useState, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useAdminGuard } from '@/hooks/useAdminGuard';

/** Which request failed, not what to say about it - the sentence is looked up at render time. */
type UsersFailure = 'load' | 'delete' | 'role';

interface AdminUser {
  id: string;
  email: string;
  username: string;
  fullName: string | null;
  avatar: string | null;
  role: 'USER' | 'ADMIN';
  isVerified: boolean;
  createdAt: string;
  _count?: {
    posts: number;
    comments: number;
    followers: number;
    following: number;
  };
}

export default function AdminUsersPage() {
  const t = useTranslations('admin');
  const tCommon = useTranslations('common');
  const format = useFormatter();
  const router = useRouter();
  const { user } = useAuth();
  const { isReady, isLoading: guardLoading } = useAdminGuard();

  const [users, setUsers] = useState<AdminUser[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(20);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('');
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [roleDialogOpen, setRoleDialogOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<AdminUser | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [failure, setFailure] = useState<UsersFailure | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(timer);
  }, [search]);

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(page + 1),
        limit: String(rowsPerPage),
      });
      if (debouncedSearch) params.append('search', debouncedSearch);
      if (roleFilter) params.append('role', roleFilter);

      const response = await fetch(`/api/admin/users?${params}`);

      if (!response.ok) throw new Error('Failed to fetch users');

      const data = await response.json();
      setFailure(null);
      setUsers(data.users);
      setTotal(data.total);
    } catch (error) {
      setFailure('load');
      console.error('Error fetching users:', error);
    } finally {
      setLoading(false);
    }
  }, [page, rowsPerPage, debouncedSearch, roleFilter]);

  useEffect(() => {
    if (isReady) {
      fetchUsers();
    }
  }, [isReady, fetchUsers]);

  const handleDeleteClick = (targetUser: AdminUser) => {
    setSelectedUser(targetUser);
    setDeleteDialogOpen(true);
  };

  const handleRoleClick = (targetUser: AdminUser) => {
    setSelectedUser(targetUser);
    setRoleDialogOpen(true);
  };

  const handleDelete = async () => {
    if (!selectedUser) return;

    setActionLoading(true);
    try {
      const response = await fetch(`/api/admin/users/${selectedUser.id}`, {
        method: 'DELETE',
        headers: { 'X-Requested-With': 'fetch' },
      });

      if (!response.ok) throw new Error('Failed to delete user');

      setDeleteDialogOpen(false);
      fetchUsers();
    } catch (error) {
      console.error('Error deleting user:', error);
      setFailure('delete');
    } finally {
      setActionLoading(false);
    }
  };

  const handleRoleChange = async (action: 'promote' | 'demote') => {
    if (!selectedUser) return;

    setActionLoading(true);
    try {
      const response = await fetch(`/api/admin/users/${selectedUser.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'X-Requested-With': 'fetch',
        },
        body: JSON.stringify({ action }),
      });

      if (!response.ok) throw new Error('Failed to update role');

      setRoleDialogOpen(false);
      fetchUsers();
    } catch (error) {
      console.error('Error updating role:', error);
      setFailure('role');
    } finally {
      setActionLoading(false);
    }
  };

  if (guardLoading) {
    return (
      <Box
        sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}
      >
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box
      sx={{
        minHeight: '100vh',
        pt: { xs: 10, md: 12 },
        pb: { xs: 10, md: 6 },
        backgroundColor: 'background.default',
      }}
    >
      <Container maxWidth="lg">
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 4 }}>
          <IconButton onClick={() => router.push('/admin')} aria-label={t('nav.back')}>
            <ArrowBack />
          </IconButton>
          <Typography variant="h4" fontWeight={700} color="text.primary">
            {t('users.title')}
          </Typography>
        </Box>

        {/* Filters */}
        <Paper sx={{ p: 2, mb: 3, display: 'flex', gap: 2, flexWrap: 'wrap' }}>
          <TextField
            size="small"
            placeholder={t('users.searchPlaceholder')}
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(0);
            }}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <Search />
                </InputAdornment>
              ),
            }}
            sx={{ minWidth: 250 }}
          />
          <FormControl size="small" sx={{ minWidth: 120 }}>
            <InputLabel>{t('users.roleFilter.label')}</InputLabel>
            <Select
              value={roleFilter}
              label={t('users.roleFilter.label')}
              onChange={(e) => {
                setRoleFilter(e.target.value);
                setPage(0);
              }}
            >
              {/* The values are the stored role enum and never change language */}
              <MenuItem value="">{t('users.roleFilter.all')}</MenuItem>
              <MenuItem value="USER">{t('users.roleFilter.user')}</MenuItem>
              <MenuItem value="ADMIN">{t('users.roleFilter.admin')}</MenuItem>
            </Select>
          </FormControl>
        </Paper>

        {failure && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {t(`users.errors.${failure}`)}
          </Alert>
        )}

        {/* Users Table */}
        <TableContainer component={Paper}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>{t('users.columns.user')}</TableCell>
                <TableCell>{t('users.columns.email')}</TableCell>
                <TableCell>{t('users.columns.role')}</TableCell>
                <TableCell align="center">{t('users.columns.recipes')}</TableCell>
                <TableCell align="center">{t('users.columns.followers')}</TableCell>
                <TableCell>{t('users.columns.joined')}</TableCell>
                <TableCell align="right">{t('users.columns.actions')}</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={7} align="center" sx={{ py: 4 }}>
                    <CircularProgress />
                  </TableCell>
                </TableRow>
              ) : users.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} align="center" sx={{ py: 4 }}>
                    {t('users.empty')}
                  </TableCell>
                </TableRow>
              ) : (
                users.map((u) => (
                  <TableRow key={u.id} hover>
                    <TableCell>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                        <Avatar src={u.avatar || undefined}>
                          <Person />
                        </Avatar>
                        <Box>
                          <Typography fontWeight={600} color="text.primary">
                            {u.username}
                          </Typography>
                          {u.fullName && (
                            <Typography variant="body2" color="text.secondary">
                              {u.fullName}
                            </Typography>
                          )}
                        </Box>
                      </Box>
                    </TableCell>
                    <TableCell>{u.email}</TableCell>
                    <TableCell>
                      {/* The stored enum stays as it is; only the label on screen is translated */}
                      <Chip
                        label={t('users.role', { role: u.role })}
                        size="small"
                        color={u.role === 'ADMIN' ? 'warning' : 'default'}
                      />
                    </TableCell>
                    <TableCell align="center">{u._count?.posts || 0}</TableCell>
                    <TableCell align="center">{u._count?.followers || 0}</TableCell>
                    <TableCell>
                      {format.dateTime(new Date(u.createdAt), {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric',
                      })}
                    </TableCell>
                    <TableCell align="right">
                      <Tooltip
                        title={
                          u.role === 'ADMIN'
                            ? t('users.actions.demote')
                            : t('users.actions.promote')
                        }
                      >
                        <IconButton
                          onClick={() => handleRoleClick(u)}
                          disabled={u.id === user?.id}
                          color={u.role === 'ADMIN' ? 'warning' : 'primary'}
                          aria-label={
                            u.role === 'ADMIN'
                              ? t('users.actions.demoteAria')
                              : t('users.actions.promoteAria')
                          }
                        >
                          {u.role === 'ADMIN' ? <ArrowDownward /> : <ArrowUpward />}
                        </IconButton>
                      </Tooltip>
                      <Tooltip title={t('users.actions.delete')}>
                        <IconButton
                          onClick={() => handleDeleteClick(u)}
                          disabled={u.id === user?.id}
                          color="error"
                          aria-label={t('users.actions.deleteAria')}
                        >
                          <Delete />
                        </IconButton>
                      </Tooltip>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
          <TablePagination
            component="div"
            count={total}
            page={page}
            onPageChange={(_, newPage) => setPage(newPage)}
            rowsPerPage={rowsPerPage}
            onRowsPerPageChange={(e) => {
              setRowsPerPage(parseInt(e.target.value, 10));
              setPage(0);
            }}
            rowsPerPageOptions={[10, 20, 50]}
            labelRowsPerPage={t('pagination.rowsPerPage')}
            labelDisplayedRows={({ from, to, count }) =>
              t('users.displayedRows', { from, to, count })
            }
            getItemAriaLabel={(type) => t(`pagination.${type}Page`)}
          />
        </TableContainer>

        {/* Delete Dialog */}
        <Dialog open={deleteDialogOpen} onClose={() => setDeleteDialogOpen(false)}>
          <DialogTitle>{t('users.deleteDialog.title')}</DialogTitle>
          <DialogContent>
            <DialogContentText>
              {t.rich('users.deleteDialog.message', {
                username: selectedUser?.username ?? '',
                name: (chunks) => <strong>{chunks}</strong>,
              })}
            </DialogContentText>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setDeleteDialogOpen(false)}>{tCommon('actions.cancel')}</Button>
            <Button onClick={handleDelete} color="error" disabled={actionLoading}>
              {actionLoading ? <CircularProgress size={20} /> : tCommon('actions.delete')}
            </Button>
          </DialogActions>
        </Dialog>

        {/* Role Change Dialog */}
        <Dialog open={roleDialogOpen} onClose={() => setRoleDialogOpen(false)}>
          <DialogTitle>
            {selectedUser?.role === 'ADMIN'
              ? t('users.roleDialog.demoteTitle')
              : t('users.roleDialog.promoteTitle')}
          </DialogTitle>
          <DialogContent>
            <DialogContentText>
              {t.rich(
                selectedUser?.role === 'ADMIN'
                  ? 'users.roleDialog.demoteMessage'
                  : 'users.roleDialog.promoteMessage',
                {
                  username: selectedUser?.username ?? '',
                  name: (chunks) => <strong>{chunks}</strong>,
                }
              )}
            </DialogContentText>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setRoleDialogOpen(false)}>{tCommon('actions.cancel')}</Button>
            <Button
              onClick={() =>
                handleRoleChange(selectedUser?.role === 'ADMIN' ? 'demote' : 'promote')
              }
              color="primary"
              disabled={actionLoading}
            >
              {actionLoading ? <CircularProgress size={20} /> : tCommon('actions.confirm')}
            </Button>
          </DialogActions>
        </Dialog>
      </Container>
    </Box>
  );
}
