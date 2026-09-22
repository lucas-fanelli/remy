'use client';
import { Send, Person, MoreVert, Edit, Delete, Close, Check, CameraAlt } from '@mui/icons-material';
import {
  Box,
  Typography,
  TextField,
  Button,
  Avatar,
  Card,
  CardContent,
  Rating,
  Alert,
  Chip,
  IconButton,
  Menu,
  MenuItem,
  ListItemIcon,
  ListItemText,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  useTheme,
  useMediaQuery,
  CircularProgress,
} from '@mui/material';
import { formatDistanceToNow } from 'date-fns';
import { AnimatePresence } from 'framer-motion';
import { useTranslations } from 'next-intl';
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { MotionCard } from '@/components/motion';
import { useAuth } from '@/contexts/AuthContext';
import { useDateFnsLocale } from '@/i18n/dates';
import { readBody } from '@/lib/api/readBody';
import { useApiErrorMessage } from '@/lib/api/translateApiError';
import { cloudinaryImage, isCloudinaryUrl } from '@/lib/utils/cloudinary';

interface Comment {
  id: string;
  text: string;
  imageUrl?: string;
  rating?: number;
  createdAt: string;
  user: {
    id: string;
    username: string;
    avatar?: string;
  };
}

interface CommentsSectionProps {
  recipeId: string;
  recipeAuthorId?: string;
  onImageClick?: (url: string, alt: string) => void;
  /**
   * The reader's current score for this recipe, live from the page. The comment list is
   * fetched once into local state, so without this a rating given after the thread loaded
   * would not show beside your own comment until a reload.
   */
  myRating?: number | null;
}

export default function CommentsSection({
  recipeId,
  recipeAuthorId,
  onImageClick,
  myRating = null,
}: CommentsSectionProps) {
  const t = useTranslations('comments');
  const tCommon = useTranslations('common');
  const apiErrorMessage = useApiErrorMessage();
  const dateLocale = useDateFnsLocale();
  const { user } = useAuth();

  /**
   * The stars beside a comment are that person's score for the recipe, read from Rating
   * when the list was fetched — not something the comment carries. So when YOU change
   * your score, every comment of yours is showing a number that is now out of date, and
   * the list is local state that no refetch is coming for.
   *
   * Rather than refetch the whole thread to learn something this page already knows, your
   * own comments read the live value.
   */
  const ratingFor = (comment: Comment) =>
    user && comment.user.id === user.id ? myRating : (comment.rating ?? null);
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);
  const [commentText, setCommentText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
  const [editText, setEditText] = useState('');
  const [menuAnchorEl, setMenuAnchorEl] = useState<{ [key: string]: HTMLElement | null }>({});
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [commentToDelete, setCommentToDelete] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Image upload state
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Revoke object URL on unmount to prevent memory leak
  useEffect(() => {
    return () => {
      if (imagePreview) URL.revokeObjectURL(imagePreview);
    };
  }, [imagePreview]);

  const loadComments = useCallback(async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/recipes/${recipeId}/comments`);

      if (!response.ok) {
        // The only silent path in this file. Posting, editing and deleting a comment all
        // report properly — the inventory claimed deleting was silent too and the code
        // says otherwise — but READING the thread fell through, so an unreachable thread
        // rendered as "no comments yet" under someone's recipe.
        setError(apiErrorMessage(await readBody(response), t('errors.loadFailed')));
        return;
      }

      const data = await response.json();
      setComments(data.comments);
    } catch (error) {
      console.error('Error loading comments:', error);
      setError(t('errors.loadFailed'));
    } finally {
      setLoading(false);
    }
    // Stable identities, and it matters: the mount effect depends on this callback.
  }, [recipeId, t, apiErrorMessage]);

  useEffect(() => {
    loadComments();
  }, [loadComments]);

  const handleSubmitComment = async () => {
    if (!user || !commentText.trim()) return;

    try {
      setSubmitting(true);
      setError(null);

      let imageUrl: string | undefined;

      // Upload image first if selected
      if (selectedImage) {
        setUploadingImage(true);
        try {
          const formData = new FormData();
          formData.append('file', selectedImage);

          const uploadResponse = await fetch('/api/upload', {
            method: 'POST',
            headers: { 'X-Requested-With': 'fetch' },
            body: formData,
          });

          if (!uploadResponse.ok) {
            throw new Error(t('errors.uploadFailed'));
          }

          const uploadData = await uploadResponse.json();
          imageUrl = uploadData.url;
        } catch (uploadError) {
          console.error('Error uploading image:', uploadError);
          setError(t('errors.uploadFailed'));
          setUploadingImage(false);
          setSubmitting(false);
          return;
        }
        setUploadingImage(false);
      }

      const response = await fetch(`/api/recipes/${recipeId}/comments`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Requested-With': 'fetch',
        },
        body: JSON.stringify({
          text: commentText.trim(),
          imageUrl,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        // Prevent duplicate keys by checking if comment already exists
        setComments((prevComments) => {
          const exists = prevComments.some((c) => c.id === data.comment.id);
          if (exists) return prevComments;
          return [data.comment, ...prevComments];
        });
        setCommentText('');
        // Clear image state and revoke object URL to free memory
        if (imagePreview) URL.revokeObjectURL(imagePreview);
        setSelectedImage(null);
        setImagePreview(null);
        if (fileInputRef.current) fileInputRef.current.value = '';
      } else {
        const errorData = await response.json();
        setError(apiErrorMessage(errorData, t('errors.postFailed')));
      }
    } catch (error) {
      console.error('Error submitting comment:', error);
      setError(t('errors.postFailed'));
    } finally {
      setSubmitting(false);
      setUploadingImage(false);
    }
  };

  // Image selection handler
  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif'];
    if (!allowedTypes.includes(file.type)) {
      setError(t('errors.invalidType'));
      return;
    }

    // Validate file size (5MB max)
    if (file.size > 5 * 1024 * 1024) {
      setError(t('errors.tooLarge'));
      return;
    }

    setSelectedImage(file);
    setError(null);
    // Use createObjectURL for efficient synchronous preview (no base64 encoding overhead)
    const objectUrl = URL.createObjectURL(file);
    setImagePreview(objectUrl);
  };

  // Remove selected image and revoke object URL to free memory
  const removeSelectedImage = () => {
    if (imagePreview) URL.revokeObjectURL(imagePreview);
    setSelectedImage(null);
    setImagePreview(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const formatDate = (dateString: string) => {
    try {
      return formatDistanceToNow(new Date(dateString), { addSuffix: true, locale: dateLocale });
    } catch {
      return t('recently');
    }
  };

  const handleMenuOpen = (commentId: string, event: React.MouseEvent<HTMLElement>) => {
    setMenuAnchorEl({ ...menuAnchorEl, [commentId]: event.currentTarget });
  };

  const handleMenuClose = (commentId: string) => {
    setMenuAnchorEl({ ...menuAnchorEl, [commentId]: null });
  };

  const handleEditClick = (comment: Comment) => {
    setEditingCommentId(comment.id);
    setEditText(comment.text);
    handleMenuClose(comment.id);
  };

  const handleCancelEdit = () => {
    setEditingCommentId(null);
    setEditText('');
  };

  const handleSaveEdit = async (commentId: string) => {
    if (!user || !editText.trim()) return;

    try {
      setSubmitting(true);
      const response = await fetch(`/api/recipes/${recipeId}/comments/${commentId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'X-Requested-With': 'fetch',
        },
        body: JSON.stringify({
          text: editText.trim(),
        }),
      });

      if (response.ok) {
        const data = await response.json();
        setComments(comments.map((c) => (c.id === commentId ? data.comment : c)));
        handleCancelEdit();
      } else {
        const errorData = await response.json();
        setError(apiErrorMessage(errorData, t('errors.updateFailed')));
      }
    } catch (error) {
      console.error('Error updating comment:', error);
      setError(t('errors.updateFailed'));
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteClick = (commentId: string) => {
    setCommentToDelete(commentId);
    setDeleteDialogOpen(true);
    handleMenuClose(commentId);
  };

  const handleDeleteCancel = () => {
    setDeleteDialogOpen(false);
    setCommentToDelete(null);
  };

  const handleDeleteConfirm = async () => {
    if (!user || !commentToDelete) return;

    try {
      setDeleting(true);
      const response = await fetch(`/api/recipes/${recipeId}/comments/${commentToDelete}`, {
        method: 'DELETE',
        headers: { 'X-Requested-With': 'fetch' },
      });

      if (response.ok) {
        setComments(comments.filter((c) => c.id !== commentToDelete));
        setDeleteDialogOpen(false);
        setCommentToDelete(null);
      } else {
        const errorData = await response.json();
        setError(apiErrorMessage(errorData, t('errors.deleteFailed')));
      }
    } catch (error) {
      console.error('Error deleting comment:', error);
      setError(t('errors.deleteFailed'));
    } finally {
      setDeleting(false);
    }
  };

  return (
    <Box sx={{ pb: { xs: 9, sm: 10, md: 0 } }}>
      <Typography
        variant="h5"
        gutterBottom
        sx={{
          fontWeight: 600,
          mb: { xs: 2, md: 3 },
          color: 'text.primary',
          fontSize: { xs: '1.25rem', sm: '1.5rem' },
        }}
      >
        {t('title', { count: comments.length })}
      </Typography>

      {/* Comment Input */}
      {user ? (
        <Card sx={{ mb: { xs: 2, md: 3 } }}>
          <CardContent sx={{ p: { xs: 1.5, md: 2 } }}>
            <Box
              sx={{
                display: 'flex',
                flexDirection: { xs: 'column', sm: 'row' },
                gap: { xs: 1.5, md: 2 },
                mb: { xs: 1.5, md: 2 },
              }}
            >
              <Avatar
                src={cloudinaryImage(user.avatar, 'avatar') || undefined}
                sx={{
                  width: { xs: 36, md: 40 },
                  height: { xs: 36, md: 40 },
                  display: { xs: 'none', sm: 'flex' },
                }}
              >
                {user.username?.charAt(0).toUpperCase()}
              </Avatar>
              <Box sx={{ flex: 1 }}>
                <TextField
                  fullWidth
                  multiline
                  rows={isMobile ? 2 : 3}
                  size={isMobile ? 'small' : 'medium'}
                  placeholder={t('form.placeholder')}
                  value={commentText}
                  onChange={(e) => setCommentText(e.target.value)}
                  disabled={submitting}
                />

                {/* Image Preview */}
                {imagePreview && (
                  <Box sx={{ mt: 1.5, position: 'relative', display: 'inline-block' }}>
                    <Box
                      component="img"
                      src={imagePreview}
                      alt={t('form.previewAlt')}
                      sx={{
                        maxWidth: { xs: 100, md: 120 },
                        maxHeight: { xs: 80, md: 100 },
                        borderRadius: 1,
                        objectFit: 'cover',
                        border: '1px solid',
                        borderColor: 'divider',
                      }}
                    />
                    <IconButton
                      size="small"
                      onClick={removeSelectedImage}
                      disabled={submitting}
                      sx={{
                        position: 'absolute',
                        top: -8,
                        right: -8,
                        bgcolor: 'background.paper',
                        border: '1px solid',
                        borderColor: 'divider',
                        // The ink comes with the fill. White was legible on light mode's
                        // red and not on dark mode's, which is lighter than the icon was.
                        '&:hover': { bgcolor: 'error.main', color: 'error.contrastText' },
                        width: 24,
                        height: 24,
                      }}
                    >
                      <Close sx={{ fontSize: 14 }} />
                    </IconButton>
                  </Box>
                )}

                {/* Hidden File Input */}
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleImageSelect}
                  accept="image/jpeg,image/png,image/webp"
                  style={{ display: 'none' }}
                />

                <Box
                  sx={{
                    mt: { xs: 1.5, md: 2 },
                    display: 'flex',
                    flexDirection: { xs: 'column', sm: 'row' },
                    alignItems: { xs: 'stretch', sm: 'center' },
                    justifyContent: 'space-between',
                    gap: { xs: 1.5, sm: 0 },
                  }}
                >
                  {/* The stars used to live here, and were the only way to score a
                      recipe — you could not rate without writing something, and this row
                      always started empty even if you had already rated. Scoring is its
                      own control now, beside the average at the top of the page. */}
                  <Box />
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    {/* Camera Button */}
                    <IconButton
                      onClick={() => fileInputRef.current?.click()}
                      disabled={submitting}
                      color={selectedImage ? 'primary' : 'default'}
                      sx={{
                        border: '1px solid',
                        borderColor: selectedImage ? 'primary.main' : 'divider',
                        borderRadius: 1,
                      }}
                    >
                      <CameraAlt />
                    </IconButton>
                    <Button
                      variant="contained"
                      endIcon={
                        uploadingImage ? <CircularProgress size={16} color="inherit" /> : <Send />
                      }
                      onClick={handleSubmitComment}
                      disabled={!commentText.trim() || submitting || uploadingImage}
                      fullWidth={isMobile}
                      size={isMobile ? 'large' : 'medium'}
                    >
                      {uploadingImage
                        ? tCommon('status.uploading')
                        : submitting
                          ? tCommon('status.posting')
                          : t('form.submit')}
                    </Button>
                  </Box>
                </Box>
                {error && (
                  <Alert
                    severity="error"
                    sx={{ mt: { xs: 1.5, md: 2 }, fontSize: { xs: '0.8125rem', md: '0.875rem' } }}
                  >
                    {error}
                  </Alert>
                )}
              </Box>
            </Box>
          </CardContent>
        </Card>
      ) : (
        <Alert
          severity="info"
          sx={{ mb: { xs: 2, md: 3 }, fontSize: { xs: '0.8125rem', md: '0.875rem' } }}
        >
          {t('loginPrompt')}
        </Alert>
      )}

      {/* Comments List */}
      {loading ? null : comments.length === 0 ? (
        <Box sx={{ textAlign: 'center', py: { xs: 4, md: 6 } }}>
          <Typography
            variant="h6"
            color="text.secondary"
            gutterBottom
            sx={{ fontSize: { xs: '1.125rem', md: '1.25rem' } }}
          >
            {t('empty.title')}
          </Typography>
          <Typography
            variant="body2"
            color="text.secondary"
            sx={{ fontSize: { xs: '0.875rem', md: '1rem' } }}
          >
            {t('empty.body')}
          </Typography>
        </Box>
      ) : (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: { xs: 1.5, md: 2 } }}>
          <AnimatePresence>
            {comments.map((comment, index) => (
              <MotionCard
                key={comment.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: index * 0.05 }}
                variant="outlined"
              >
                <CardContent sx={{ p: { xs: 1.5, md: 2 } }}>
                  <Box sx={{ display: 'flex', gap: { xs: 1, md: 2 } }}>
                    <Avatar
                      src={cloudinaryImage(comment.user.avatar, 'avatar')}
                      sx={{
                        width: { xs: 32, md: 40 },
                        height: { xs: 32, md: 40 },
                      }}
                    >
                      {comment.user.username.charAt(0).toUpperCase()}
                    </Avatar>
                    <Box sx={{ flex: 1 }}>
                      <Box
                        sx={{
                          display: 'flex',
                          alignItems: 'flex-start',
                          justifyContent: 'space-between',
                          mb: { xs: 0.5, md: 0.75 },
                          gap: 1,
                        }}
                      >
                        <Box
                          sx={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: { xs: 0.5, md: 1 },
                            flexWrap: 'wrap',
                          }}
                        >
                          <Typography
                            variant="subtitle2"
                            fontWeight={600}
                            sx={{ fontSize: { xs: '0.875rem', md: '0.9375rem' } }}
                          >
                            {comment.user.username}
                          </Typography>
                          {recipeAuthorId && comment.user.id === recipeAuthorId && (
                            <Chip
                              label={t('creatorBadge')}
                              size="small"
                              color="primary"
                              icon={<Person sx={{ fontSize: { xs: '0.875rem', md: '1rem' } }} />}
                              sx={{
                                height: { xs: 18, md: 20 },
                                fontSize: { xs: '0.65rem', md: '0.7rem' },
                                fontWeight: 600,
                              }}
                            />
                          )}
                          <Typography
                            variant="caption"
                            color="text.secondary"
                            sx={{ fontSize: { xs: '0.7rem', md: '0.75rem' } }}
                          >
                            • {formatDate(comment.createdAt)}
                          </Typography>
                        </Box>
                        {user && user.id === comment.user.id && editingCommentId !== comment.id && (
                          <IconButton
                            size="small"
                            onClick={(e) => handleMenuOpen(comment.id, e)}
                            sx={{ ml: { xs: 0, sm: 1 }, mt: -1 }}
                          >
                            <MoreVert
                              fontSize="small"
                              sx={{ fontSize: { xs: '1.25rem', md: '1.5rem' } }}
                            />
                          </IconButton>
                        )}
                      </Box>

                      {editingCommentId === comment.id ? (
                        // Edit Mode
                        <Box sx={{ mt: { xs: 0.75, md: 1 } }}>
                          <TextField
                            fullWidth
                            multiline
                            rows={isMobile ? 2 : 3}
                            size={isMobile ? 'small' : 'medium'}
                            value={editText}
                            onChange={(e) => setEditText(e.target.value)}
                            disabled={submitting}
                            sx={{ mb: { xs: 1, md: 1.5 } }}
                          />
                          <Box
                            sx={{
                              display: 'flex',
                              flexDirection: { xs: 'column', sm: 'row' },
                              alignItems: { xs: 'stretch', sm: 'center' },
                              justifyContent: 'space-between',
                              gap: { xs: 1.5, sm: 0 },
                              mb: { xs: 0.75, md: 1 },
                            }}
                          >
                            <Box />
                            <Box sx={{ display: 'flex', gap: 1 }}>
                              <Button
                                size="small"
                                startIcon={!isMobile ? <Close /> : undefined}
                                onClick={handleCancelEdit}
                                disabled={submitting}
                                fullWidth={isMobile}
                              >
                                {tCommon('actions.cancel')}
                              </Button>
                              <Button
                                size="small"
                                variant="contained"
                                startIcon={!isMobile ? <Check /> : undefined}
                                onClick={() => handleSaveEdit(comment.id)}
                                disabled={!editText.trim() || submitting}
                                fullWidth={isMobile}
                              >
                                {submitting ? tCommon('status.saving') : tCommon('actions.save')}
                              </Button>
                            </Box>
                          </Box>
                        </Box>
                      ) : (
                        // View Mode
                        <>
                          {ratingFor(comment) !== null && (
                            <Box sx={{ mb: { xs: 0.75, md: 1 } }}>
                              <Rating value={ratingFor(comment)} readOnly size="small" />
                            </Box>
                          )}
                          <Typography
                            variant="body2"
                            sx={{
                              whiteSpace: 'pre-line',
                              fontSize: { xs: '0.8125rem', md: '0.875rem' },
                            }}
                          >
                            {comment.text}
                          </Typography>
                          {/* Comment Image — only render from trusted Cloudinary CDN */}
                          {comment.imageUrl && isCloudinaryUrl(comment.imageUrl) && (
                            <Box
                              component="img"
                              src={comment.imageUrl}
                              alt={t('photoAlt', { username: comment.user.username })}
                              onClick={() =>
                                onImageClick?.(
                                  comment.imageUrl!,
                                  t('photoAlt', { username: comment.user.username })
                                )
                              }
                              sx={{
                                mt: 1.5,
                                maxWidth: '100%',
                                maxHeight: { xs: 150, md: 200 },
                                borderRadius: 1,
                                cursor: onImageClick ? 'pointer' : 'default',
                                objectFit: 'cover',
                                border: '1px solid',
                                borderColor: 'divider',
                                transition: 'transform 0.2s',
                                '&:hover': onImageClick
                                  ? {
                                      transform: 'scale(1.02)',
                                      boxShadow: 2,
                                    }
                                  : {},
                              }}
                            />
                          )}
                        </>
                      )}
                    </Box>
                  </Box>

                  {/* Action Menu */}
                  <Menu
                    anchorEl={menuAnchorEl[comment.id]}
                    open={Boolean(menuAnchorEl[comment.id])}
                    onClose={() => handleMenuClose(comment.id)}
                  >
                    <MenuItem onClick={() => handleEditClick(comment)}>
                      <ListItemIcon>
                        <Edit fontSize="small" />
                      </ListItemIcon>
                      <ListItemText>{tCommon('actions.edit')}</ListItemText>
                    </MenuItem>
                    <MenuItem
                      onClick={() => handleDeleteClick(comment.id)}
                      sx={{ color: 'error.main' }}
                    >
                      <ListItemIcon>
                        <Delete fontSize="small" color="error" />
                      </ListItemIcon>
                      <ListItemText>{tCommon('actions.delete')}</ListItemText>
                    </MenuItem>
                  </Menu>
                </CardContent>
              </MotionCard>
            ))}
          </AnimatePresence>
        </Box>
      )}

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={deleteDialogOpen}
        onClose={handleDeleteCancel}
        maxWidth="xs"
        aria-labelledby="delete-comment-dialog-title"
        aria-describedby="delete-comment-dialog-description"
      >
        <DialogTitle id="delete-comment-dialog-title">{t('deleteDialog.title')}</DialogTitle>
        <DialogContent>
          <DialogContentText id="delete-comment-dialog-description">
            {t('deleteDialog.message')}
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleDeleteCancel} disabled={deleting}>
            {tCommon('actions.cancel')}
          </Button>
          <Button
            onClick={handleDeleteConfirm}
            color="error"
            variant="contained"
            disabled={deleting}
            autoFocus
          >
            {deleting ? tCommon('status.deleting') : tCommon('actions.delete')}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
