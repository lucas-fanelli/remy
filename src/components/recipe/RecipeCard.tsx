'use client';
import React from 'react';
import {
  Card,
  CardMedia,
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
} from '@mui/material';
import {
  Favorite,
  FavoriteBorder,
  ChatBubbleOutline,
  AccessTime,
  Restaurant,
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
  recipe: Recipe;
  onLike?: () => void;
  onComment?: () => void;
  onClick?: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
  liked?: boolean;
  likeCount?: number;
  commentCount?: number;
  showActions?: boolean; // Show edit/delete buttons only for owner
  currentUserId?: string; // To check ownership
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

  const getDifficultyColor = (difficulty: string) => {
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
      whileHover={{ y: -4, boxShadow: '0 8px 24px rgba(0,0,0,0.15)' }}
      transition={{ duration: 0.2 }}
      sx={{
        cursor: onClick ? 'pointer' : 'default',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* Recipe Image */}
      <Box sx={{ position: 'relative' }} onClick={onClick}>
        <CardMedia
          component="img"
          height="240"
          image={recipe.imageUrl}
          alt={recipe.title}
          sx={{ objectFit: 'cover' }}
        />

        {/* Difficulty Badge */}
        {!isOwner && (
          <Box sx={{ position: 'absolute', top: 12, right: 12 }}>
            <Chip
              label={recipe.difficulty}
              size="small"
              color={getDifficultyColor(recipe.difficulty) as any}
              sx={{
                fontWeight: 600,
                textTransform: 'capitalize',
                backdropFilter: 'blur(10px)',
              }}
            />
          </Box>
        )}

        {/* Edit/Delete Menu Button (for owners) - Replaces difficulty badge */}
        {showActions && isOwner && (
          <Box sx={{ position: 'absolute', top: 12, right: 12 }}>
            <Tooltip title="More options">
              <IconButton
                onClick={handleMenuOpen}
                size="small"
                sx={{
                  backgroundColor: 'rgba(0,0,0,0.6)',
                  color: 'white',
                  backdropFilter: 'blur(10px)',
                  '&:hover': {
                    backgroundColor: 'rgba(0,0,0,0.8)',
                  },
                }}
              >
                <MoreVert />
              </IconButton>
            </Tooltip>
          </Box>
        )}

        {/* Time Badge */}
        <Box sx={{ position: 'absolute', bottom: 12, left: 12 }}>
          <Chip
            icon={<AccessTime sx={{ fontSize: 16 }} />}
            label={`${totalTime} min`}
            size="small"
            sx={{
              backdropFilter: 'blur(10px)',
              backgroundColor: (theme) =>
                theme.palette.mode === 'dark'
                  ? 'rgba(255,255,255,0.9)'
                  : 'rgba(0,0,0,0.7)',
              color: (theme) =>
                theme.palette.mode === 'dark' ? 'black' : 'white',
              '& .MuiChip-icon': {
                color: (theme) =>
                  theme.palette.mode === 'dark' ? 'black' : 'white',
              },
            }}
          />
        </Box>
      </Box>

      {/* Recipe Info */}
      <CardContent sx={{ flexGrow: 1, pb: 1 }}>
        {/* Author Info */}
        {recipe.author && (
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 1,
              mb: 2,
              cursor: 'pointer',
              '&:hover': {
                opacity: 0.8
              }
            }}
            onClick={(e) => {
              e.stopPropagation();
              router.push(`/profile/${recipe.author?.username}`);
            }}
          >
            <Avatar
              src={recipe.author.avatar}
              alt={recipe.author.username}
              sx={{ width: 32, height: 32 }}
            >
              {recipe.author.username.charAt(0).toUpperCase()}
            </Avatar>
            <Typography variant="body2" sx={{ fontWeight: 600, color: 'text.primary' }}>
              {recipe.author.fullName || recipe.author.username}
            </Typography>
          </Box>
        )}

        <Box onClick={onClick}>

        <Typography
          variant="h6"
          component="h2"
          gutterBottom
          sx={{
            fontWeight: 600,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
            mb: 1,
          }}
        >
          {recipe.title}
        </Typography>

        <Typography
          variant="body2"
          color="text.secondary"
          sx={{
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
            mb: 2,
          }}
        >
          {recipe.description}
        </Typography>

        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mb: 1 }}>
          <Chip
            icon={<Restaurant sx={{ fontSize: 16 }} />}
            label={recipe.cuisine}
            size="small"
            variant="outlined"
          />
          <Chip
            icon={<Person sx={{ fontSize: 16 }} />}
            label={`${recipe.servings} servings`}
            size="small"
            variant="outlined"
          />
        </Box>
        </Box>
      </CardContent>

      {/* Actions */}
      <CardActions sx={{ px: 2, pb: 2, pt: 0 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Tooltip title={liked ? 'Unlike' : 'Like'}>
            <IconButton
              onClick={(e) => {
                e.stopPropagation();
                onLike?.();
              }}
              size="small"
              color={liked ? 'error' : 'default'}
            >
              {liked ? <Favorite /> : <FavoriteBorder />}
            </IconButton>
          </Tooltip>
          <Typography variant="body2" color="text.secondary">
            {likeCount}
          </Typography>
        </Box>

        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, ml: 2 }}>
          <Tooltip title="Comments">
            <IconButton
              onClick={(e) => {
                e.stopPropagation();
                onComment?.();
              }}
              size="small"
            >
              <ChatBubbleOutline />
            </IconButton>
          </Tooltip>
          <Typography variant="body2" color="text.secondary">
            {commentCount}
          </Typography>
        </Box>
      </CardActions>

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
