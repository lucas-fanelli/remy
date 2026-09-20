'use client';
import {
  Favorite,
  FavoriteBorder,
  ChatBubbleOutline,
  AccessTime,
  Person,
  Edit,
  Delete,
  MoreVert,
  Restaurant as RestaurantIcon,
} from '@mui/icons-material';
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
import { motion } from 'framer-motion';
import { useRouter } from 'next/navigation';
import { useFormatter, useTranslations } from 'next-intl';
import React, { useRef } from 'react';
import { Recipe, ViewerState } from '@/domain/types/recipe';
import { isCloudinaryUrl } from '@/lib/utils/cloudinary';
import { getDifficultyColor } from '@/lib/utils/recipe';

// motion.create must be at module scope — calling inside a component creates
// a new type each render, breaking React reconciliation.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const MotionCard = motion.create(Card as any);

interface RecipeCardProps {
  recipe: Recipe & { averageRating?: number | null; totalRatings?: number };
  onLike?: () => void;
  onComment?: () => void;
  onClick?: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
  /**
   * What the reader did to this recipe, straight from the API; null when signed out.
   *
   * Required, and deliberately without a default. `liked = false` used to be the default,
   * which meant a surface that simply forgot to pass it rendered a confident empty heart
   * — indistinguishable from a real answer. Now forgetting it does not compile.
   */
  viewer: ViewerState | null;
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
  viewer,
  likeCount = 0,
  commentCount = 0,
  showActions = false,
  currentUserId,
}: RecipeCardProps) {
  const liked = viewer?.liked ?? false;
  const timesCooked = viewer?.timesCooked ?? 0;
  const t = useTranslations('recipe');
  const tCommon = useTranslations('common');
  const format = useFormatter();
  const router = useRouter();
  const [imgFallbackUsed, setImgFallbackUsed] = React.useState(false);
  const [imgHidden, setImgHidden] = React.useState(false);
  const [anchorEl, setAnchorEl] = React.useState<null | HTMLElement>(null);
  const menuOpen = Boolean(anchorEl);

  // Warn once in dev when a recipe has a non-Cloudinary image URL (likely a data integrity issue)
  const warnedRef = useRef(false);
  React.useEffect(() => {
    if (
      process.env.NODE_ENV === 'development' &&
      recipe.imageUrl &&
      !isCloudinaryUrl(recipe.imageUrl) &&
      !warnedRef.current
    ) {
      warnedRef.current = true;
      console.warn(`RecipeCard: non-Cloudinary image URL for recipe ${recipe.id}`);
    }
  }, [recipe.id, recipe.imageUrl]);

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
      {/* Hero Image Container
        Image state machine:
        1. Cloudinary URL -> render directly, onError -> fallback (/chef-logo.png)
        2. Fallback fails -> imgHidden (show placeholder icon)
        3. Non-Cloudinary URL -> imgHidden immediately (CSP blocks, show placeholder) */}
      <Box sx={{ position: 'relative', overflow: 'hidden' }} onClick={handleCardClick}>
        {imgHidden ? (
          <Box
            sx={{
              width: '100%',
              aspectRatio: '4/3',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              bgcolor: 'grey.200',
            }}
          >
            <RestaurantIcon sx={{ fontSize: 48, color: 'grey.400' }} />
            <Typography variant="caption" sx={{ color: 'grey.500', mt: 0.5 }}>
              {tCommon('states.imageUnavailable')}
            </Typography>
          </Box>
        ) : (
          <Box
            component="img"
            src={
              recipe.imageUrl && isCloudinaryUrl(recipe.imageUrl)
                ? recipe.imageUrl
                : '/chef-logo.png'
            }
            alt={recipe.title}
            onError={(e: React.SyntheticEvent<HTMLImageElement>) => {
              // Non-Cloudinary URLs already use the fallback as src, so skip
              // the fallback chain and hide the image directly
              if (!recipe.imageUrl || !isCloudinaryUrl(recipe.imageUrl)) {
                setImgHidden(true);
              } else if (!imgFallbackUsed) {
                setImgFallbackUsed(true);
                e.currentTarget.src = '/chef-logo.png';
              } else {
                console.error(`Recipe ${recipe.id}: both primary and fallback images failed`);
                setImgHidden(true);
              }
            }}
            sx={{
              width: '100%',
              aspectRatio: '4/3',
              objectFit: 'cover',
            }}
          />
        )}

        {/* Difficulty Badge - Top Right */}
        <Chip
          label={t('meta.difficulty', { level: recipe.difficulty })}
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
          label={tCommon('time.minutesShort', { count: totalTime })}
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
        <Box sx={{ flex: 1 }} />
        {showActions && isOwner && (
          <IconButton
            onClick={handleMenuOpen}
            size="small"
            aria-label={t('card.options')}
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
          {recipe.totalRatings && recipe.totalRatings > 0 ? (
            <>
              <Rating
                value={recipe.averageRating || 0}
                precision={0.5}
                size="small"
                readOnly
                sx={{ color: 'warning.main' }}
              />
              <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.8125rem' }}>
                ({format.number(recipe.totalRatings)})
              </Typography>
            </>
          ) : (
            <Typography
              variant="body2"
              color="text.secondary"
              sx={{ fontSize: '0.8125rem', fontStyle: 'italic' }}
            >
              {t('meta.noRatings')}
            </Typography>
          )}
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
          label={t('meta.servings', { count: recipe.servings })}
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
            <Tooltip title={liked ? t('card.unlike') : t('card.like')}>
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
            <Tooltip title={t('card.comments')}>
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

          {/* Read-only on purpose: cooking something takes ingredients out of your pantry,
              and that is a decision to confirm on the recipe page, not a card tap. This
              only says you have made it — which the card could never say before. */}
          {timesCooked > 0 && (
            <Tooltip
              title={
                timesCooked === 1
                  ? t('card.cookedOnce')
                  : t('card.cookedTimes', { count: timesCooked })
              }
            >
              <Box
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 0.5,
                  ml: 'auto',
                  color: 'success.main',
                }}
              >
                <RestaurantIcon sx={{ fontSize: 20 }} />
                {timesCooked > 1 && (
                  <Typography variant="body2" color="inherit">
                    {timesCooked}
                  </Typography>
                )}
              </Box>
            </Tooltip>
          )}
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
          <ListItemText>{t('card.edit')}</ListItemText>
        </MenuItem>
        <MenuItem onClick={handleDelete} sx={{ color: 'error.main' }}>
          <ListItemIcon>
            <Delete fontSize="small" color="error" />
          </ListItemIcon>
          <ListItemText>{t('card.delete')}</ListItemText>
        </MenuItem>
      </Menu>
    </MotionCard>
  );
}
