'use client';
import React from 'react';
import {
  Card,
  CardHeader,
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
  useTheme,
  useMediaQuery,
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
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const isTablet = useMediaQuery(theme.breakpoints.between('sm', 'md'));
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
      sx={{
        backgroundColor: (theme) => theme.palette.background.paper,
        cursor: onClick ? 'pointer' : 'default',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        transition: 'all 0.2s',
        '&:hover': {
          boxShadow: '0 8px 24px rgba(0,0,0,0.15)',
          transform: 'translateY(-4px)',
        },
      }}
    >
      {/* Card Header with Author Info and Edit/Delete Menu */}
      {recipe.author && (
        <CardHeader
          avatar={
            <Avatar
              src={recipe.author.avatar}
              alt={recipe.author.username}
              sx={{
                width: { xs: 32, md: 36 },
                height: { xs: 32, md: 36 },
                cursor: 'pointer'
              }}
              onClick={(e) => {
                e.stopPropagation();
                router.push(`/profile/${recipe.author?.username}`);
              }}
            >
              {recipe.author.username.charAt(0).toUpperCase()}
            </Avatar>
          }
          action={
            showActions && isOwner ? (
              <Tooltip title="More options">
                <IconButton
                  onClick={handleMenuOpen}
                  size={isMobile ? 'small' : 'medium'}
                  aria-label="recipe options"
                >
                  <MoreVert />
                </IconButton>
              </Tooltip>
            ) : null
          }
          title={
            <Typography
              variant="body2"
              sx={{
                fontWeight: 600,
                color: 'text.primary',
                fontSize: { xs: '0.8125rem', md: '0.875rem' },
                cursor: 'pointer'
              }}
              onClick={(e) => {
                e.stopPropagation();
                router.push(`/profile/${recipe.author?.username}`);
              }}
            >
              {recipe.author.fullName || recipe.author.username}
            </Typography>
          }
          sx={{
            pb: 0,
            '& .MuiCardHeader-action': {
              alignSelf: 'center',
              marginTop: 0,
              marginRight: 0,
            }
          }}
        />
      )}

      {/* Recipe Image */}
      <Box sx={{ position: 'relative' }} onClick={onClick}>
        <CardMedia
          component="img"
          sx={{
            height: { xs: 180, sm: 200, md: 240 },
            objectFit: 'cover'
          }}
          image={recipe.imageUrl}
          alt={recipe.title}
        />

        {/* Difficulty Badge - Always shown in top-right */}
        <Box sx={{ position: 'absolute', top: { xs: 8, md: 12 }, right: { xs: 8, md: 12 } }}>
          <Chip
            label={recipe.difficulty}
            size={isMobile ? 'small' : 'medium'}
            color={getDifficultyColor(recipe.difficulty) as any}
            sx={{
              fontWeight: 600,
              textTransform: 'capitalize',
              backdropFilter: 'blur(10px)',
              fontSize: { xs: '0.75rem', md: '0.8125rem' },
              color: 'white',
              '& .MuiChip-label': {
                color: 'white',
              },
            }}
          />
        </Box>

        {/* Time Badge */}
        <Box sx={{ position: 'absolute', bottom: { xs: 8, md: 12 }, left: { xs: 8, md: 12 } }}>
          <Chip
            icon={<AccessTime sx={{ fontSize: { xs: 14, md: 16 } }} />}
            label={`${totalTime} min`}
            size={isMobile ? 'small' : 'medium'}
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
              fontSize: { xs: '0.75rem', md: '0.8125rem' }
            }}
          />
        </Box>
      </Box>

      {/* Recipe Info */}
      <CardContent sx={{ flexGrow: 1, pb: { xs: 0.5, md: 1 }, px: { xs: 1.5, md: 2 }, pt: { xs: 1.5, md: 2 } }}>
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
            mb: { xs: 0.75, md: 1 },
            fontSize: { xs: '1rem', sm: '1.125rem', md: '1.25rem' }
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
            mb: { xs: 1, md: 2 },
            fontSize: { xs: '0.8125rem', md: '0.875rem' }
          }}
        >
          {recipe.description}
        </Typography>

        <Box sx={{ display: 'flex', gap: { xs: 0.5, md: 1 }, flexWrap: 'wrap', mb: { xs: 0.5, md: 1 } }}>
          <Chip
            icon={<Person sx={{ fontSize: { xs: 14, md: 16 } }} />}
            label={`${recipe.servings} servings`}
            size="small"
            variant="outlined"
            sx={{ fontSize: { xs: '0.7rem', md: '0.8125rem' } }}
          />
        </Box>
        </Box>
      </CardContent>

      {/* Actions */}
      <CardActions sx={{ px: { xs: 1.5, md: 2 }, pb: { xs: 1.5, md: 2 }, pt: 0 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: { xs: 0.5, md: 1 } }}>
          <Tooltip title={liked ? 'Unlike' : 'Like'}>
            <IconButton
              onClick={(e) => {
                e.stopPropagation();
                onLike?.();
              }}
              size="small"
              color={liked ? 'error' : 'default'}
            >
              {liked ? (
                <Favorite sx={{ fontSize: { xs: '1.25rem', md: '1.5rem' } }} />
              ) : (
                <FavoriteBorder sx={{ fontSize: { xs: '1.25rem', md: '1.5rem' } }} />
              )}
            </IconButton>
          </Tooltip>
          <Typography
            variant="body2"
            color="text.secondary"
            sx={{ fontSize: { xs: '0.8125rem', md: '0.875rem' } }}
          >
            {likeCount}
          </Typography>
        </Box>

        <Box sx={{ display: 'flex', alignItems: 'center', gap: { xs: 0.5, md: 1 }, ml: { xs: 1.5, md: 2 } }}>
          <Tooltip title="Comments">
            <IconButton
              onClick={(e) => {
                e.stopPropagation();
                onComment?.();
              }}
              size="small"
            >
              <ChatBubbleOutline sx={{ fontSize: { xs: '1.25rem', md: '1.5rem' } }} />
            </IconButton>
          </Tooltip>
          <Typography
            variant="body2"
            color="text.secondary"
            sx={{ fontSize: { xs: '0.8125rem', md: '0.875rem' } }}
          >
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
