'use client';
import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  TextField,
  Button,
  Avatar,
  Card,
  CardContent,
  Rating,
  Divider,
  CircularProgress,
  Alert,
  Chip,
  IconButton,
  Menu,
  MenuItem,
  ListItemIcon,
  ListItemText,
  useTheme,
  useMediaQuery,
} from '@mui/material';
import { Send, Person, MoreVert, Edit, Delete, Close, Check } from '@mui/icons-material';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '@/contexts/AuthContext';
import { formatDistanceToNow } from 'date-fns';

const MotionCard = motion.create(Card);

interface Comment {
  id: string;
  text: string;
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
}

export default function CommentsSection({ recipeId, recipeAuthorId }: CommentsSectionProps) {
  const { user, token } = useAuth();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const isTablet = useMediaQuery(theme.breakpoints.down('md'));
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

  useEffect(() => {
    loadComments();
  }, [recipeId]);

  const loadComments = async () => {
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
  };

  const handleSubmitComment = async () => {
    if (!token || !commentText.trim()) return;

    try {
      setSubmitting(true);
      setError(null);

      const response = await fetch(`/api/recipes/${recipeId}/comments`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          text: commentText.trim(),
          rating: rating || undefined,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        // Prevent duplicate keys by checking if comment already exists
        setComments(prevComments => {
          const exists = prevComments.some(c => c.id === data.comment.id);
          if (exists) return prevComments;
          return [data.comment, ...prevComments];
        });
        setCommentText('');
        setRating(null);
      } else {
        const errorData = await response.json();
        setError(errorData.error || 'Failed to post comment');
      }
    } catch (error) {
      console.error('Error submitting comment:', error);
      setError('Failed to post comment');
    } finally {
      setSubmitting(false);
    }
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
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          text: editText.trim(),
          rating: editRating || undefined,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        setComments(comments.map(c => c.id === commentId ? data.comment : c));
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

  const handleDeleteClick = async (commentId: string) => {
    if (!token) return;

    if (!window.confirm('Are you sure you want to delete this comment?')) {
      handleMenuClose(commentId);
      return;
    }

    try {
      const response = await fetch(`/api/recipes/${recipeId}/comments/${commentId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (response.ok) {
        setComments(comments.filter(c => c.id !== commentId));
        handleMenuClose(commentId);
      } else {
        const errorData = await response.json();
        setError(errorData.error || 'Failed to delete comment');
      }
    } catch (error) {
      console.error('Error deleting comment:', error);
      setError('Failed to delete comment');
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
            <Box sx={{ display: 'flex', flexDirection: { xs: 'column', sm: 'row' }, gap: { xs: 1.5, md: 2 }, mb: { xs: 1.5, md: 2 } }}>
              <Avatar
                src={user.avatar}
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
                <Box sx={{
                  mt: { xs: 1.5, md: 2 },
                  display: 'flex',
                  flexDirection: { xs: 'column', sm: 'row' },
                  alignItems: { xs: 'stretch', sm: 'center' },
                  justifyContent: 'space-between',
                  gap: { xs: 1.5, sm: 0 },
                }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                    <Typography variant="body2" color="text.secondary" sx={{ fontSize: { xs: '0.8125rem', md: '0.875rem' } }}>
                      Rate this recipe:
                    </Typography>
                    <Rating
                      value={rating}
                      onChange={(event, newValue) => setRating(newValue)}
                      size={isMobile ? 'small' : 'medium'}
                      disabled={submitting}
                    />
                  </Box>
                  <Button
                    variant="contained"
                    endIcon={<Send />}
                    onClick={handleSubmitComment}
                    disabled={!commentText.trim() || submitting}
                    fullWidth={isMobile}
                    size={isMobile ? 'large' : 'medium'}
                  >
                    {submitting ? 'Posting...' : 'Post'}
                  </Button>
                </Box>
                {error && (
                  <Alert severity="error" sx={{ mt: { xs: 1.5, md: 2 }, fontSize: { xs: '0.8125rem', md: '0.875rem' } }}>
                    {error}
                  </Alert>
                )}
              </Box>
            </Box>
          </CardContent>
        </Card>
      ) : (
        <Alert severity="info" sx={{ mb: { xs: 2, md: 3 }, fontSize: { xs: '0.8125rem', md: '0.875rem' } }}>
          Please login to leave a comment
        </Alert>
      )}

      {/* Comments List */}
      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: { xs: 3, md: 4 } }}>
          <CircularProgress />
        </Box>
      ) : comments.length === 0 ? (
        <Box sx={{ textAlign: 'center', py: { xs: 4, md: 6 } }}>
          <Typography variant="h6" color="text.secondary" gutterBottom sx={{ fontSize: { xs: '1.125rem', md: '1.25rem' } }}>
            No comments yet
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ fontSize: { xs: '0.875rem', md: '1rem' } }}>
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
                      <Box sx={{
                        display: 'flex',
                        alignItems: 'flex-start',
                        justifyContent: 'space-between',
                        mb: { xs: 0.5, md: 0.75 },
                        gap: 1,
                      }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: { xs: 0.5, md: 1 }, flexWrap: 'wrap' }}>
                          <Typography variant="subtitle2" fontWeight={600} sx={{ fontSize: { xs: '0.875rem', md: '0.9375rem' } }}>
                            {comment.user.username}
                          </Typography>
                          {recipeAuthorId && comment.user.id === recipeAuthorId && (
                            <Chip
                              label="Creator"
                              size="small"
                              color="primary"
                              icon={<Person sx={{ fontSize: { xs: '0.875rem', md: '1rem' } }} />}
                              sx={{ height: { xs: 18, md: 20 }, fontSize: { xs: '0.65rem', md: '0.7rem' }, fontWeight: 600 }}
                            />
                          )}
                          <Typography variant="caption" color="text.secondary" sx={{ fontSize: { xs: '0.7rem', md: '0.75rem' } }}>
                            • {formatDate(comment.createdAt)}
                          </Typography>
                        </Box>
                        {user && user.id === comment.user.id && editingCommentId !== comment.id && (
                          <IconButton
                            size="small"
                            onClick={(e) => handleMenuOpen(comment.id, e)}
                            sx={{ ml: { xs: 0, sm: 1 }, mt: -1 }}
                          >
                            <MoreVert fontSize="small" sx={{ fontSize: { xs: '1.25rem', md: '1.5rem' } }} />
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
                          <Box sx={{
                            display: 'flex',
                            flexDirection: { xs: 'column', sm: 'row' },
                            alignItems: { xs: 'stretch', sm: 'center' },
                            justifyContent: 'space-between',
                            gap: { xs: 1.5, sm: 0 },
                            mb: { xs: 0.75, md: 1 },
                          }}>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                              <Typography variant="body2" color="text.secondary" sx={{ fontSize: { xs: '0.8125rem', md: '0.875rem' } }}>
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
                    <MenuItem onClick={() => handleDeleteClick(comment.id)} sx={{ color: 'error.main' }}>
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
    </Box>
  );
}
