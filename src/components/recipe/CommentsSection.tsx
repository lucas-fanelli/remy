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
import { motion, AnimatePresence } from 'framer-motion';
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';

const MotionCard = motion.create(Card);

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
}

export default function CommentsSection({
  recipeId,
  recipeAuthorId,
  onImageClick,
}: CommentsSectionProps) {
  const { user, token } = useAuth();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);
  const [commentText, setCommentText] = useState('');
  const [rating, setRating] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
  const [editText, setEditText] = useState('');
  const [editRating, setEditRating] = useState<number | null>(null);
  const [menuAnchorEl, setMenuAnchorEl] = useState<{ [key: string]: HTMLElement | null }>({});
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [commentToDelete, setCommentToDelete] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Image upload state
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadComments = useCallback(async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/recipes/${recipeId}/comments`);

      if (response.ok) {
        const data = await response.json();
        setComments(data.comments);
      }
    } catch (error) {
      console.error('Error loading comments:', error);
    } finally {
      setLoading(false);
    }
  }, [recipeId]);

  useEffect(() => {
    loadComments();
  }, [loadComments]);

  const handleSubmitComment = async () => {
    if (!token || !commentText.trim()) return;

    try {
      setSubmitting(true);
      setError(null);

      // Upload image first if selected
      let imageUrl: string | undefined;
      if (selectedImage) {
        setUploadingImage(true);
        try {
          const formData = new FormData();
          formData.append('file', selectedImage);

          const uploadHeaders: HeadersInit = {};
          if (token) {
            uploadHeaders['Authorization'] = `Bearer ${token}`;
          }

          const uploadResponse = await fetch('/api/upload', {
            method: 'POST',
            headers: uploadHeaders,
            body: formData,
          });

          if (!uploadResponse.ok) {
            throw new Error('Failed to upload image');
          }

          const uploadData = await uploadResponse.json();
          imageUrl = uploadData.url;
        } catch (uploadError) {
          console.error('Error uploading image:', uploadError);
          setError('Failed to upload image');
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
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          text: commentText.trim(),
          rating: rating || undefined,
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
        setRating(null);
        // Clear image state
        setSelectedImage(null);
        setImagePreview(null);
        if (fileInputRef.current) fileInputRef.current.value = '';
      } else {
        const errorData = await response.json();
        setError(errorData.error || 'Failed to post comment');
      }
    } catch (error) {
      console.error('Error submitting comment:', error);
      setError('Failed to post comment');
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
      setError('Invalid file type. Only JPEG, PNG, WebP, and GIF are allowed.');
      return;
    }

    // Validate file size (5MB max)
    if (file.size > 5 * 1024 * 1024) {
      setError('Image too large. Maximum size is 5MB.');
      return;
    }

    setSelectedImage(file);
    setError(null);
    const reader = new FileReader();
    reader.onloadend = () => setImagePreview(reader.result as string);
    reader.readAsDataURL(file);
  };

  // Remove selected image
  const removeSelectedImage = () => {
    setSelectedImage(null);
    setImagePreview(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const formatDate = (dateString: string) => {
    try {
      return formatDistanceToNow(new Date(dateString), { addSuffix: true });
    } catch {
      return 'recently';
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
    setEditRating(comment.rating || null);
    handleMenuClose(comment.id);
  };

  const handleCancelEdit = () => {
    setEditingCommentId(null);
    setEditText('');
    setEditRating(null);
  };

  const handleSaveEdit = async (commentId: string) => {
    if (!token || !editText.trim()) return;

    try {
      setSubmitting(true);
      const response = await fetch(`/api/recipes/${recipeId}/comments/${commentId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          text: editText.trim(),
          rating: editRating || undefined,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        setComments(comments.map((c) => (c.id === commentId ? data.comment : c)));
        handleCancelEdit();
      } else {
        const errorData = await response.json();
        setError(errorData.error || 'Failed to update comment');
      }
    } catch (error) {
      console.error('Error updating comment:', error);
      setError('Failed to update comment');
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
    if (!token || !commentToDelete) return;

    try {
      setDeleting(true);
      const response = await fetch(`/api/recipes/${recipeId}/comments/${commentToDelete}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.ok) {
        setComments(comments.filter((c) => c.id !== commentToDelete));
        setDeleteDialogOpen(false);
        setCommentToDelete(null);
      } else {
        const errorData = await response.json();
        setError(errorData.error || 'Failed to delete comment');
      }
    } catch (error) {
      console.error('Error deleting comment:', error);
      setError('Failed to delete comment');
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
        Comments ({comments.length})
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
                src={user.avatar || undefined}
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
                  placeholder="Share your thoughts about this recipe..."
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
                      alt="Preview"
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
                        '&:hover': { bgcolor: 'error.light', color: 'white' },
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
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                    <Typography
                      variant="body2"
                      color="text.secondary"
                      sx={{ fontSize: { xs: '0.8125rem', md: '0.875rem' } }}
                    >
                      Rate this recipe:
                    </Typography>
                    <Rating
                      value={rating}
                      onChange={(event, newValue) => setRating(newValue)}
                      size={isMobile ? 'small' : 'medium'}
                      disabled={submitting}
                    />
                  </Box>
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
                      {uploadingImage ? 'Uploading...' : submitting ? 'Posting...' : 'Post'}
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
          Please login to leave a comment
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
            No comments yet
          </Typography>
          <Typography
            variant="body2"
            color="text.secondary"
            sx={{ fontSize: { xs: '0.875rem', md: '1rem' } }}
          >
            Be the first to share your thoughts!
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
                      src={comment.user.avatar}
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
                              label="Creator"
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
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                              <Typography
                                variant="body2"
                                color="text.secondary"
                                sx={{ fontSize: { xs: '0.8125rem', md: '0.875rem' } }}
                              >
                                Rating:
                              </Typography>
                              <Rating
                                value={editRating}
                                onChange={(event, newValue) => setEditRating(newValue)}
                                size="small"
                                disabled={submitting}
                              />
                            </Box>
                            <Box sx={{ display: 'flex', gap: 1 }}>
                              <Button
                                size="small"
                                startIcon={!isMobile ? <Close /> : undefined}
                                onClick={handleCancelEdit}
                                disabled={submitting}
                                fullWidth={isMobile}
                              >
                                Cancel
                              </Button>
                              <Button
                                size="small"
                                variant="contained"
                                startIcon={!isMobile ? <Check /> : undefined}
                                onClick={() => handleSaveEdit(comment.id)}
                                disabled={!editText.trim() || submitting}
                                fullWidth={isMobile}
                              >
                                {submitting ? 'Saving...' : 'Save'}
                              </Button>
                            </Box>
                          </Box>
                        </Box>
                      ) : (
                        // View Mode
                        <>
                          {comment.rating && (
                            <Box sx={{ mb: { xs: 0.75, md: 1 } }}>
                              <Rating value={comment.rating} readOnly size="small" />
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
                          {/* Comment Image */}
                          {comment.imageUrl && (
                            <Box
                              component="img"
                              src={comment.imageUrl}
                              alt={`Photo by ${comment.user.username}`}
                              onClick={() =>
                                onImageClick?.(
                                  comment.imageUrl!,
                                  `Photo by ${comment.user.username}`
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
                      <ListItemText>Edit</ListItemText>
                    </MenuItem>
                    <MenuItem
                      onClick={() => handleDeleteClick(comment.id)}
                      sx={{ color: 'error.main' }}
                    >
                      <ListItemIcon>
                        <Delete fontSize="small" color="error" />
                      </ListItemIcon>
                      <ListItemText>Delete</ListItemText>
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
        <DialogTitle id="delete-comment-dialog-title">Delete selected comment?</DialogTitle>
        <DialogContent>
          <DialogContentText id="delete-comment-dialog-description">
            Comment will be permanently removed from your account and all synced devices
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleDeleteCancel} disabled={deleting}>
            Cancel
          </Button>
          <Button
            onClick={handleDeleteConfirm}
            color="error"
            variant="contained"
            disabled={deleting}
            autoFocus
          >
            {deleting ? 'Deleting...' : 'Delete'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
