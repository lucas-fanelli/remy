'use client';

import { Search, Delete, ArrowBack, Restaurant, Visibility } from '@mui/icons-material';
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
} from '@mui/material';
import { useRouter } from 'next/navigation';
import { useFormatter, useTranslations } from 'next-intl';
import React, { useEffect, useState, useCallback } from 'react';
import { useAdminGuard } from '@/hooks/useAdminGuard';
import { cloudinaryImage } from '@/lib/utils/cloudinary';

/** Which request failed, not what to say about it - the sentence is looked up at render time. */
type RecipesFailure = 'load' | 'delete';

interface AdminRecipe {
  id: string;
  title: string | null;
  description: string | null;
  imageUrl: string;
  userId: string;
  createdAt: string;
  user: {
    username: string;
    email: string;
  };
  _count?: {
    likes: number;
    comments: number;
  };
}

export default function AdminRecipesPage() {
  const t = useTranslations('admin');
  const tCommon = useTranslations('common');
  const format = useFormatter();
  const router = useRouter();
  const { isReady, isLoading: guardLoading } = useAdminGuard();

  const [recipes, setRecipes] = useState<AdminRecipe[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(20);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedRecipe, setSelectedRecipe] = useState<AdminRecipe | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [failure, setFailure] = useState<RecipesFailure | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(timer);
  }, [search]);

  const fetchRecipes = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(page + 1),
        limit: String(rowsPerPage),
      });
      if (debouncedSearch) params.append('search', debouncedSearch);

      const response = await fetch(`/api/admin/recipes?${params}`);

      if (!response.ok) throw new Error('Failed to fetch recipes');

      const data = await response.json();
      setFailure(null);
      setRecipes(data.recipes);
      setTotal(data.total);
    } catch (error) {
      setFailure('load');
      console.error('Error fetching recipes:', error);
    } finally {
      setLoading(false);
    }
  }, [page, rowsPerPage, debouncedSearch]);

  useEffect(() => {
    if (isReady) {
      fetchRecipes();
    }
  }, [isReady, fetchRecipes]);

  const handleDeleteClick = (recipe: AdminRecipe) => {
    setSelectedRecipe(recipe);
    setDeleteDialogOpen(true);
  };

  const handleDelete = async () => {
    if (!selectedRecipe) return;

    setActionLoading(true);
    try {
      const response = await fetch(`/api/admin/recipes/${selectedRecipe.id}`, {
        method: 'DELETE',
        headers: { 'X-Requested-With': 'fetch' },
      });

      if (!response.ok) throw new Error('Failed to delete recipe');

      setDeleteDialogOpen(false);
      fetchRecipes();
    } catch (error) {
      console.error('Error deleting recipe:', error);
      setFailure('delete');
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
            {t('recipes.title')}
          </Typography>
        </Box>

        {/* Filters */}
        <Paper sx={{ p: 2, mb: 3 }}>
          <TextField
            size="small"
            placeholder={t('recipes.searchPlaceholder')}
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
            sx={{ minWidth: 300 }}
          />
        </Paper>

        {failure && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {t(`recipes.errors.${failure}`)}
          </Alert>
        )}

        {/* Recipes Table */}
        <TableContainer component={Paper}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>{t('recipes.columns.recipe')}</TableCell>
                <TableCell>{t('recipes.columns.author')}</TableCell>
                <TableCell align="center">{t('recipes.columns.likes')}</TableCell>
                <TableCell align="center">{t('recipes.columns.comments')}</TableCell>
                <TableCell>{t('recipes.columns.created')}</TableCell>
                <TableCell align="right">{t('recipes.columns.actions')}</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={6} align="center" sx={{ py: 4 }}>
                    <CircularProgress />
                  </TableCell>
                </TableRow>
              ) : recipes.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} align="center" sx={{ py: 4 }}>
                    {t('recipes.empty')}
                  </TableCell>
                </TableRow>
              ) : (
                recipes.map((recipe) => (
                  <TableRow key={recipe.id} hover>
                    <TableCell>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                        <Avatar src={cloudinaryImage(recipe.imageUrl, 'avatar')} variant="rounded">
                          <Restaurant />
                        </Avatar>
                        <Box>
                          <Typography fontWeight={600} color="text.primary">
                            {recipe.title || t('recipes.untitled')}
                          </Typography>
                          <Typography
                            variant="body2"
                            color="text.secondary"
                            sx={{ maxWidth: 300 }}
                            noWrap
                          >
                            {recipe.description || t('recipes.noDescription')}
                          </Typography>
                        </Box>
                      </Box>
                    </TableCell>
                    <TableCell>
                      <Typography color="text.primary">{recipe.user.username}</Typography>
                      <Typography variant="body2" color="text.secondary">
                        {recipe.user.email}
                      </Typography>
                    </TableCell>
                    <TableCell align="center">{recipe._count?.likes || 0}</TableCell>
                    <TableCell align="center">{recipe._count?.comments || 0}</TableCell>
                    <TableCell>
                      {format.dateTime(new Date(recipe.createdAt), {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric',
                      })}
                    </TableCell>
                    <TableCell align="right">
                      <Tooltip title={t('recipes.actions.view')}>
                        <IconButton
                          onClick={() => router.push(`/recipe/${recipe.id}`)}
                          color="primary"
                          aria-label={t('recipes.actions.viewAria')}
                        >
                          <Visibility />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title={t('recipes.actions.delete')}>
                        <IconButton
                          onClick={() => handleDeleteClick(recipe)}
                          color="error"
                          aria-label={t('recipes.actions.deleteAria')}
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
              t('recipes.displayedRows', { from, to, count })
            }
            getItemAriaLabel={(type) => t(`pagination.${type}Page`)}
          />
        </TableContainer>

        {/* Delete Dialog */}
        <Dialog open={deleteDialogOpen} onClose={() => setDeleteDialogOpen(false)}>
          <DialogTitle>{t('recipes.deleteDialog.title')}</DialogTitle>
          <DialogContent>
            <DialogContentText>
              {t.rich('recipes.deleteDialog.message', {
                // `title` is a noun slot: either the recipe's own title or, when it has none,
                // the translated stand-in for it. Each language decides where that noun sits.
                title: selectedRecipe?.title || t('recipes.deleteDialog.fallbackTitle'),
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
      </Container>
    </Box>
  );
}
