'use client';

import { Delete, ArrowBack, Visibility } from '@mui/icons-material';
import {
  Box,
  Typography,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TablePagination,
  IconButton,
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
import PageFrame from '@/components/layout/PageFrame';
import { useAdminGuard } from '@/hooks/useAdminGuard';

/** Which request failed, not what to say about it - the sentence is looked up at render time. */
type CommentsFailure = 'load' | 'delete';

interface AdminComment {
  id: string;
  text: string;
  postId: string;
  userId: string;
  createdAt: string;
  user: {
    username: string;
    email: string;
  };
  post: {
    title: string | null;
  };
}

export default function AdminCommentsPage() {
  const t = useTranslations('admin');
  const tCommon = useTranslations('common');
  const format = useFormatter();
  const router = useRouter();
  const { isReady, isLoading: guardLoading } = useAdminGuard();

  const [comments, setComments] = useState<AdminComment[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(20);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedComment, setSelectedComment] = useState<AdminComment | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [failure, setFailure] = useState<CommentsFailure | null>(null);

  const fetchComments = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(page + 1),
        limit: String(rowsPerPage),
      });

      const response = await fetch(`/api/admin/comments?${params}`);

      if (!response.ok) throw new Error('Failed to fetch comments');

      const data = await response.json();
      setFailure(null);
      setComments(data.comments);
      setTotal(data.total);
    } catch (error) {
      setFailure('load');
      console.error('Error fetching comments:', error);
    } finally {
      setLoading(false);
    }
  }, [page, rowsPerPage]);

  useEffect(() => {
    if (isReady) {
      fetchComments();
    }
  }, [isReady, fetchComments]);

  const handleDeleteClick = (comment: AdminComment) => {
    setSelectedComment(comment);
    setDeleteDialogOpen(true);
  };

  const handleDelete = async () => {
    if (!selectedComment) return;

    setActionLoading(true);
    try {
      const response = await fetch(`/api/admin/comments/${selectedComment.id}`, {
        method: 'DELETE',
        headers: { 'X-Requested-With': 'fetch' },
      });

      if (!response.ok) throw new Error('Failed to delete comment');

      setDeleteDialogOpen(false);
      fetchComments();
    } catch (error) {
      console.error('Error deleting comment:', error);
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
      <PageFrame>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 4 }}>
          <IconButton onClick={() => router.push('/admin')} aria-label={t('nav.back')}>
            <ArrowBack />
          </IconButton>
          <Typography variant="h4" fontWeight={700} color="text.primary">
            {t('comments.title')}
          </Typography>
        </Box>

        {failure && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {t(`comments.errors.${failure}`)}
          </Alert>
        )}

        {/* Comments Table */}
        <TableContainer component={Paper}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>{t('comments.columns.comment')}</TableCell>
                <TableCell>{t('comments.columns.author')}</TableCell>
                <TableCell>{t('comments.columns.recipe')}</TableCell>
                <TableCell>{t('comments.columns.date')}</TableCell>
                <TableCell align="right">{t('comments.columns.actions')}</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={5} align="center" sx={{ py: 4 }}>
                    <CircularProgress />
                  </TableCell>
                </TableRow>
              ) : comments.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} align="center" sx={{ py: 4 }}>
                    {t('comments.empty')}
                  </TableCell>
                </TableRow>
              ) : (
                comments.map((comment) => (
                  <TableRow key={comment.id} hover>
                    <TableCell sx={{ maxWidth: 400 }}>
                      <Typography
                        color="text.primary"
                        sx={{
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          display: '-webkit-box',
                          WebkitLineClamp: 2,
                          WebkitBoxOrient: 'vertical',
                        }}
                      >
                        {comment.text}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography color="text.primary">{comment.user.username}</Typography>
                      <Typography variant="body2" color="text.secondary">
                        {comment.user.email}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography color="text.primary" noWrap sx={{ maxWidth: 200 }}>
                        {comment.post.title || t('comments.untitledRecipe')}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      {format.dateTime(new Date(comment.createdAt), {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric',
                      })}
                    </TableCell>
                    <TableCell align="right">
                      <Tooltip title={t('comments.actions.view')}>
                        <IconButton
                          onClick={() => router.push(`/recipe/${comment.postId}`)}
                          color="primary"
                          aria-label={t('comments.actions.viewAria')}
                        >
                          <Visibility />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title={t('comments.actions.delete')}>
                        <IconButton
                          onClick={() => handleDeleteClick(comment)}
                          color="error"
                          aria-label={t('comments.actions.deleteAria')}
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
              t('comments.displayedRows', { from, to, count })
            }
            getItemAriaLabel={(type) => t(`pagination.${type}Page`)}
          />
        </TableContainer>

        {/* Delete Dialog */}
        <Dialog open={deleteDialogOpen} onClose={() => setDeleteDialogOpen(false)}>
          <DialogTitle>{t('comments.deleteDialog.title')}</DialogTitle>
          <DialogContent>
            <DialogContentText>
              {t.rich('comments.deleteDialog.message', {
                username: selectedComment?.user.username ?? '',
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
      </PageFrame>
    </Box>
  );
}
