'use client';
import React from 'react';
import {
  Card,
  CardContent,
  CardActions,
  Typography,
  Box,
  Chip,
  IconButton,
  Avatar,
  Tooltip,
  Menu,
  MenuItem,
  ListItemIcon,
  ListItemText,
  Rating,
} from '@mui/material';
import {
  Favorite,
  FavoriteBorder,
  ChatBubbleOutline,
  AccessTime,
  Person,
  Edit,
  Delete,
  MoreVert,
} from '@mui/icons-material';
import { motion } from 'framer-motion';
import { Recipe } from '@/domain/types/recipe';
import { useRouter } from 'next/navigation';

const MotionCard = motion.create(Card);

interface RecipeCardProps {
  recipe: Recipe & { averageRating?: number; totalRatings?: number };
  onLike?: () => void;
  onComment?: () => void;
  onClick?: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
  liked?: boolean;
  likeCount?: number;
  commentCount?: number;
  showActions?: boolean;
  currentUserId?: string;
}

export default function RecipeCard({
  recipe,
  onLike,
  onComment,
  onClick,
  onEdit,
  onDelete,
  liked = false,
  likeCount = 0,
  commentCount = 0,
  showActions = false,
  currentUserId,
}: RecipeCardProps) {
  const router = useRouter();
  const [anchorEl, setAnchorEl] = React.useState<null | HTMLElement>(null);
  const menuOpen = Boolean(anchorEl);
  const totalTime = recipe.prepTime + recipe.cookingTime;
  const isOwner = currentUserId && currentUserId === recipe.userId;

  const handleCardClick = () => {
    if (onClick) {
      onClick();
    } else {
      router.push(`/recipe/${recipe.id}`);
    }
  };

  const handleMenuOpen = (event: React.MouseEvent<HTMLElement>) => {
    event.stopPropagation();
    setAnchorEl(event.currentTarget);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
  };

  const handleEdit = (event: React.MouseEvent) => {
    event.stopPropagation();
    handleMenuClose();
    onEdit?.();
  };

  const handleDelete = (event: React.MouseEvent) => {
    event.stopPropagation();
    handleMenuClose();
    onDelete?.();
  };

  const getDifficultyColor = (difficulty: string): 'success' | 'warning' | 'error' | 'default' => {
    switch (difficulty) {
      case 'easy':
        return 'success';
      case 'medium':
        return 'warning';
      case 'hard':
        return 'error';
      default:
        return 'default';
    }
  };

  return (
    <MotionCard
      whileHover={{ y: -4 }}
      transition={{ type: 'spring', stiffness: 400, damping: 25 }}
      sx={{
        backgroundColor: 'background.paper',
        borderRadius: 3,
        overflow: 'hidden',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
        cursor: 'pointer',
        '&:hover': {
          boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
        },
      }}
    >
      {/* Hero Image Container */}
      <Box
        sx={{ position: 'relative', overflow: 'hidden' }}
        onClick={handleCardClick}
      >
        <Box
          component="img"
          src={recipe.imageUrl}
          alt={recipe.title}
          sx={{
            width: '100%',
            aspectRatio: '4/3',
            objectFit: 'cover',
            display: 'block',
          }}
        />

        {/* Difficulty Badge - Top Right */}
        <Chip
          label={recipe.difficulty}
          size="small"
          color={getDifficultyColor(recipe.difficulty)}
          sx={{
            position: 'absolute',
            top: 12,
            right: 12,
            fontWeight: 600,
            textTransform: 'capitalize',
            fontSize: '0.75rem',
            height: 28,
            borderRadius: 14,
            color: 'white',
            '& .MuiChip-label': { px: 1.5 },
          }}
        />

        {/* Time Badge - Bottom Left */}
        <Chip
          icon={<AccessTime sx={{ fontSize: 16, color: 'white !important' }} />}
          label={`${totalTime} min`}
          size="small"
          sx={{
            position: 'absolute',
            bottom: 12,
            left: 12,
            backgroundColor: 'rgba(0,0,0,0.7)',
            color: 'white',
            fontWeight: 500,
            fontSize: '0.8125rem',
            height: 28,
            borderRadius: 14,
            '& .MuiChip-icon': { color: 'white' },
            '& .MuiChip-label': { pr: 1.5 },
          }}
        />
      </Box>

      {/* Author Row */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          px: 2,
          pt: 2,
          pb: 1,
        }}
      >
        <Avatar
          src={recipe.author?.avatar}
          alt={recipe.author?.username}
          sx={{
            width: 36,
            height: 36,
            cursor: 'pointer',
            mr: 1.5,
          }}
          onClick={(e) => {
            e.stopPropagation();
            router.push(`/profile/${recipe.author?.username}`);
          }}
        >
          {recipe.author?.username?.charAt(0).toUpperCase()}
        </Avatar>
        <Typography
          variant="body2"
          sx={{
            fontWeight: 500,
            color: 'text.primary',
            cursor: 'pointer',
          }}
          onClick={(e) => {
            e.stopPropagation();
            router.push(`/profile/${recipe.author?.username}`);
          }}
        >
          {recipe.author?.fullName || recipe.author?.username}
        </Typography>
        <Box sx={{ flex: 1, cursor: 'pointer' }} onClick={() => router.push(`/recipe/${recipe.id}`)} />
        {showActions && isOwner && (
          <IconButton
            onClick={handleMenuOpen}
            size="small"
            aria-label="recipe options"
            sx={{ color: 'text.secondary' }}
          >
            <MoreVert fontSize="small" />
          </IconButton>
        )}
      </Box>

      {/* Content */}
      <CardContent sx={{ flex: 1, px: 2, pt: 0, pb: 1 }}>
        {/* Title */}
        <Typography
          variant="h6"
          component="h2"
          sx={{
            fontWeight: 600,
            fontSize: '1.125rem',
            lineHeight: 1.3,
            mb: 0.5,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
          }}
          onClick={handleCardClick}
        >
          {recipe.title}
        </Typography>

        {/* Rating */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 1 }}>
          <Rating
            value={recipe.averageRating || 0}
            precision={0.5}
            size="small"
            readOnly
            sx={{ color: '#FFB400' }}
          />
          <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.8125rem' }}>
            ({recipe.totalRatings || 0})
          </Typography>
        </Box>

        {/* Description */}
        <Typography
          variant="body2"
          color="text.secondary"
          sx={{
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
            mb: 1.5,
            fontSize: '0.875rem',
            lineHeight: 1.5,
          }}
        >
          {recipe.description}
        </Typography>

        {/* Servings Chip */}
        <Chip
          icon={<Person sx={{ fontSize: 16 }} />}
          label={`${recipe.servings} servings`}
          size="small"
          variant="outlined"
          sx={{
            fontSize: '0.8125rem',
            fontWeight: 500,
            borderColor: 'divider',
            '& .MuiChip-label': { pr: 1.5 },
          }}
        />
      </CardContent>

      {/* Actions - only show when showActions is true */}
      {showActions && (
        <CardActions sx={{ px: 2, pb: 2, pt: 0 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <Tooltip title={liked ? 'Unlike' : 'Like'}>
              <IconButton
                onClick={(e) => {
                  e.stopPropagation();
                  onLike?.();
                }}
                size="small"
                color={liked ? 'error' : 'default'}
                sx={{ p: 0.5 }}
              >
                {liked ? (
                  <Favorite sx={{ fontSize: 22 }} />
                ) : (
                  <FavoriteBorder sx={{ fontSize: 22 }} />
                )}
              </IconButton>
            </Tooltip>
            <Typography variant="body2" color="text.secondary" sx={{ minWidth: 16 }}>
              {likeCount}
            </Typography>
          </Box>

          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, ml: 2 }}>
            <Tooltip title="Comments">
              <IconButton
                onClick={(e) => {
                  e.stopPropagation();
                  onComment?.();
                }}
                size="small"
                sx={{ p: 0.5 }}
              >
                <ChatBubbleOutline sx={{ fontSize: 22 }} />
              </IconButton>
            </Tooltip>
            <Typography variant="body2" color="text.secondary" sx={{ minWidth: 16 }}>
              {commentCount}
            </Typography>
          </Box>
        </CardActions>
      )}

      {/* Edit/Delete Menu */}
      <Menu
        anchorEl={anchorEl}
        open={menuOpen}
        onClose={handleMenuClose}
        onClick={(e) => e.stopPropagation()}
        transformOrigin={{ horizontal: 'right', vertical: 'top' }}
        anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
      >
        <MenuItem onClick={handleEdit}>
          <ListItemIcon>
            <Edit fontSize="small" />
          </ListItemIcon>
          <ListItemText>Edit Recipe</ListItemText>
        </MenuItem>
        <MenuItem onClick={handleDelete} sx={{ color: 'error.main' }}>
          <ListItemIcon>
            <Delete fontSize="small" color="error" />
          </ListItemIcon>
          <ListItemText>Delete Recipe</ListItemText>
        </MenuItem>
      </Menu>
    </MotionCard>
  );
}
