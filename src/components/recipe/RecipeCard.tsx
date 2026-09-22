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
import Link from 'next/link';
import { useFormatter, useTranslations } from 'next-intl';
import React, { useRef } from 'react';
import { useBrandLogo } from '@/config/useBrandLogo';
import { ViewerState } from '@/domain/types/recipe';
import { cloudinaryImage, isCloudinaryUrl } from '@/lib/utils/cloudinary';
import { useTokens } from '@/theme/useTokens';
import DifficultyChip from './display/DifficultyChip';

// motion.create must be at module scope — calling inside a component creates
// a new type each render, breaking React reconciliation.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const MotionCard = motion.create(Card as any);

/**
 * What a card needs in order to render, and nothing more.
 *
 * Deliberately NOT `Recipe`. The search page builds `ingredients: []`, `instructions: []`
 * and `createdAt: new Date()` out of thin air purely to satisfy a type for fields no card
 * reads, and the pantry-match endpoint cannot satisfy it at all — which is a large part of
 * why five surfaces wrote their own card instead of using this one.
 *
 * Identity is required; every meta field is optional, and an absent field means the card
 * omits that slot. That is the whole convergence mechanism: one component serves a card
 * showing nine fields and a card showing two, with no `variant` flag, and the compiler
 * checks it rather than a habit of writing `?.` at each render site.
 */
export interface RecipeCardModel {
  id: string;
  title: string;
  description?: string;
  imageUrl?: string | null;
  /** Absent simply means no card can be owned — there is nothing to compare against. */
  userId?: string;
  /**
   * The value as it is STORED. Typed `string`, not a union: the column is `String?` and
   * nothing enforces the list, so a row written before it was closed can hold anything.
   */
  difficulty?: string;
  /** Rendered as one pill, prep + cooking; omitted unless both are present. */
  prepTime?: number;
  cookingTime?: number;
  servings?: number;
  author?: { username: string; fullName?: string | null; avatar?: string | null } | null;
  averageRating?: number | null;
  totalRatings?: number;
  likeCount?: number;
  commentCount?: number;
}

interface RecipeCardProps {
  recipe: RecipeCardModel;
  /**
   * What the reader did to this recipe, straight from the API; null when signed out.
   *
   * Required, and deliberately without a default. `liked = false` used to be the default,
   * which meant a surface that simply forgot to pass it rendered a confident empty heart
   * — indistinguishable from a real answer. Now forgetting it does not compile.
   */
  viewer: ViewerState | null;

  /** Where the card goes. Defaults to the recipe's own page. */
  href?: string;
  /** Intercept the navigation; the anchor is still a real anchor. */
  onClick?: () => void;

  /**
   * Handlers decide what is interactive, which is what replaced `showActions`.
   *
   * That flag conflated two unrelated questions — "show the engagement row" and "show the
   * owner menu" — so the search page, which had already fetched viewer state and counts,
   * had to throw all of it away to avoid rendering a heart it had no handler for. Now a
   * count renders whenever it is given, and becomes a button only when it can do something.
   */
  onLike?: () => void;
  onComment?: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
  currentUserId?: string;

  /** An extra badge over the photo — the pantry match percentage, for instance. */
  overlay?: React.ReactNode;
  /**
   * A block below the meta row: the pantry-match meter and its missing-ingredients line.
   *
   * A slot rather than props, because nothing else in the app shows pantry match and its
   * 80%-threshold rule belongs at the call site, not in a shared card's prop surface.
   */
  footer?: React.ReactNode;
}

export default function RecipeCard({
  recipe,
  viewer,
  href,
  onClick,
  onLike,
  onComment,
  onEdit,
  onDelete,
  currentUserId,
  overlay,
  footer,
}: RecipeCardProps) {
  const brandLogo = useBrandLogo();
  const tokens = useTokens();
  const liked = viewer?.liked ?? false;
  const timesCooked = viewer?.timesCooked ?? 0;
  const t = useTranslations('recipe');
  const tCommon = useTranslations('common');
  const format = useFormatter();
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

  // Both or neither. A card that knows only half of the time would print a total that is
  // quietly wrong, which is worse than printing nothing.
  const totalTime =
    recipe.prepTime !== undefined && recipe.cookingTime !== undefined
      ? recipe.prepTime + recipe.cookingTime
      : null;

  const isOwner = Boolean(currentUserId && recipe.userId && currentUserId === recipe.userId);
  const canManage = isOwner && Boolean(onEdit || onDelete);
  const destination = href ?? `/recipe/${recipe.id}`;

  // The row appears when there is something to show or something to do; the handler only
  // decides whether the glyph beside a count is a button.
  const showEngagement =
    recipe.likeCount !== undefined ||
    recipe.commentCount !== undefined ||
    Boolean(onLike || onComment);

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
        // The anchor on the title stretches an invisible `::after` across this box, so the
        // card is clickable without wrapping the buttons in a link. That needs a
        // positioned ancestor, and it is also why `cursor: 'pointer'` is gone from here:
        // it used to sit on the whole card while the handler was wired to just the image
        // and the title, so the description, the chips and every margin showed a pointer
        // and did nothing.
        position: 'relative',
        // Elevation, resting and on hover, belongs to the theme's MuiCard now: a shadow in
        // light mode, a lifted surface and a quiet border in dark, where a black shadow
        // renders as nothing at all. The hover response is the whileHover lift above.
      }}
    >
      {/* Hero Image Container
        Image state machine:
        1. Cloudinary URL -> render directly, onError -> fallback (the brand logo)
        2. Fallback fails -> imgHidden (show placeholder icon)
        3. Non-Cloudinary URL -> imgHidden immediately (CSP blocks, show placeholder) */}
      <Box sx={{ position: 'relative', overflow: 'hidden' }}>
        {imgHidden ? (
          <Box
            sx={{
              width: '100%',
              aspectRatio: '4/3',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              bgcolor: tokens.surface.sunken,
            }}
          >
            <RestaurantIcon sx={{ fontSize: 48, color: 'text.disabled' }} />
            <Typography variant="caption" sx={{ color: 'text.secondary', mt: 0.5 }}>
              {tCommon('states.imageUnavailable')}
            </Typography>
          </Box>
        ) : (
          <Box
            component="img"
            src={
              recipe.imageUrl && isCloudinaryUrl(recipe.imageUrl)
                ? cloudinaryImage(recipe.imageUrl, 'card')
                : brandLogo
            }
            alt={recipe.title}
            onError={(e: React.SyntheticEvent<HTMLImageElement>) => {
              // Non-Cloudinary URLs already use the fallback as src, so skip
              // the fallback chain and hide the image directly
              if (!recipe.imageUrl || !isCloudinaryUrl(recipe.imageUrl)) {
                setImgHidden(true);
              } else if (!imgFallbackUsed) {
                setImgFallbackUsed(true);
                e.currentTarget.src = brandLogo;
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

        {/* The call site's own badge — the pantry match percentage, for instance. Placed
            here so the one thing MatchedRecipes needed does not become a card prop. */}
        {overlay ? <Box sx={{ position: 'absolute', top: 12, left: 12 }}>{overlay}</Box> : null}

        {/* Time Badge - Bottom Left
            Light ink in both modes, deliberately: this pill sits on the photo's scrim and
            not on the card, so it never sees the page's background. */}
        {totalTime !== null && (
          <Chip
            icon={<AccessTime sx={{ fontSize: 16, color: tokens.text.onOverlay }} />}
            label={tCommon('time.minutesShort', { count: totalTime })}
            size="small"
            sx={{
              position: 'absolute',
              bottom: 12,
              left: 12,
              backgroundColor: tokens.surface.overlay,
              color: tokens.text.onOverlay,
              fontWeight: 500,
              fontSize: '0.8125rem',
              height: 28,
              borderRadius: 14,
              '& .MuiChip-icon': { color: tokens.text.onOverlay },
              '& .MuiChip-label': { pr: 1.5 },
            }}
          />
        )}
      </Box>

      {/* Author row, and the owner's menu that shares it.
          Guarded: an absent author used to render an empty 36px avatar with two click
          targets that both pushed `/profile/undefined`. The guard comes from the profile
          page's copy of this card, which had it right. */}
      {(recipe.author || canManage) && (
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            px: 2,
            pt: 2,
            pb: 1,
            // Above the stretched link, so the author's name reaches their profile rather
            // than the recipe underneath it.
            position: 'relative',
            zIndex: 1,
          }}
        >
          {recipe.author && (
            <>
              <Avatar
                component={Link}
                href={`/profile/${recipe.author.username}`}
                src={cloudinaryImage(recipe.author.avatar, 'avatar') ?? undefined}
                alt={recipe.author.username}
                sx={{ width: 36, height: 36, mr: 1.5, textDecoration: 'none' }}
              >
                {recipe.author.username.charAt(0).toUpperCase()}
              </Avatar>
              <Typography
                component={Link}
                href={`/profile/${recipe.author.username}`}
                variant="body2"
                sx={{
                  fontWeight: 500,
                  color: 'text.primary',
                  textDecoration: 'none',
                  // A long name used to push the owner's kebab off the card edge; nobody
                  // hit it only because the test names are short.
                  minWidth: 0,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  '&:hover': { textDecoration: 'underline' },
                }}
              >
                {recipe.author.fullName || recipe.author.username}
              </Typography>
            </>
          )}
          <Box sx={{ flex: 1 }} />
          {canManage && (
            <IconButton
              onClick={handleMenuOpen}
              size="small"
              aria-label={t('card.options')}
              sx={{ color: 'text.secondary', flexShrink: 0 }}
            >
              <MoreVert fontSize="small" />
            </IconButton>
          )}
        </Box>
      )}

      {/* Content */}
      <CardContent sx={{ flex: 1, px: 2, pt: 0, pb: 1 }}>
        {/* Title — and the card's one real link.
            The anchor is here rather than around the card because wrapping the like,
            comment and menu buttons in an anchor is invalid HTML and breaks their
            activation; a screen reader would also announce the whole card as one link.
            Instead this anchor stretches a transparent `::after` over the card, which
            gives keyboard focus, middle-click, open-in-new-tab and an href for crawlers,
            and sits BELOW the action row's z-index so the buttons still receive clicks. */}
        <Typography
          variant="h6"
          component="h2"
          sx={{
            fontWeight: 600,
            fontSize: '1.125rem',
            lineHeight: 1.3,
            mb: 0.5,
          }}
        >
          <Box
            component={Link}
            href={destination}
            onClick={onClick}
            sx={{
              color: 'inherit',
              textDecoration: 'none',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical',
              '&::after': {
                content: '""',
                position: 'absolute',
                inset: 0,
                zIndex: 0,
              },
              '&:hover': { textDecoration: 'underline' },
            }}
          >
            {recipe.title}
          </Box>
        </Typography>

        {/* Rating */}
        {recipe.totalRatings !== undefined && (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 1 }}>
            {recipe.totalRatings > 0 ? (
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
        )}

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

        {/* Meta row: the chips that describe the dish rather than decorate the photo.
            Each appears only if the surface knows it — that is what lets one card serve a
            feed entry and a pantry match without a flag between them. */}
        {(recipe.difficulty || recipe.servings !== undefined) && (
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
            {recipe.difficulty && (
              <DifficultyChip
                difficulty={recipe.difficulty}
                size="small"
                sx={{ fontSize: '0.8125rem' }}
              />
            )}
            {recipe.servings !== undefined && (
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
            )}
          </Box>
        )}

        {/* The call site's own block — the pantry-match meter and what is missing from it.
            A slot, because its 80% threshold and its Spanish plural belong where they are
            already written, not in a shared card's prop surface. */}
        {footer}
      </CardContent>

      {/* The engagement row appears when the surface knows the counts. Whether each glyph
          is a BUTTON is a separate question, answered by whether a handler came with it —
          that split is what `showActions` used to collapse, which is why the search page
          fetched viewer state and counts and then threw them away. */}
      {showEngagement && (
        <CardActions
          sx={{
            px: 2,
            pb: 2,
            pt: 0,
            // Above the title's stretched `::after`, or the link would swallow the taps.
            position: 'relative',
            zIndex: 1,
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            {onLike ? (
              <Tooltip title={liked ? t('card.unlike') : t('card.like')}>
                <IconButton
                  onClick={onLike}
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
            ) : (
              <Box sx={{ p: 0.5, display: 'flex', color: liked ? 'error.main' : 'text.secondary' }}>
                {liked ? (
                  <Favorite sx={{ fontSize: 22 }} />
                ) : (
                  <FavoriteBorder sx={{ fontSize: 22 }} />
                )}
              </Box>
            )}
            <Typography variant="body2" color="text.secondary" sx={{ minWidth: 16 }}>
              {recipe.likeCount ?? 0}
            </Typography>
          </Box>

          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, ml: 2 }}>
            {onComment ? (
              <Tooltip title={t('card.comments')}>
                <IconButton onClick={onComment} size="small" sx={{ p: 0.5 }}>
                  <ChatBubbleOutline sx={{ fontSize: 22 }} />
                </IconButton>
              </Tooltip>
            ) : (
              <Box sx={{ p: 0.5, display: 'flex', color: 'text.secondary' }}>
                <ChatBubbleOutline sx={{ fontSize: 22 }} />
              </Box>
            )}
            <Typography variant="body2" color="text.secondary" sx={{ minWidth: 16 }}>
              {recipe.commentCount ?? 0}
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
      {canManage && (
        <Menu
          anchorEl={anchorEl}
          open={menuOpen}
          onClose={handleMenuClose}
          transformOrigin={{ horizontal: 'right', vertical: 'top' }}
          anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
        >
          {onEdit && (
            <MenuItem onClick={handleEdit}>
              <ListItemIcon>
                <Edit fontSize="small" />
              </ListItemIcon>
              <ListItemText>{t('card.edit')}</ListItemText>
            </MenuItem>
          )}
          {onDelete && (
            <MenuItem onClick={handleDelete} sx={{ color: 'error.main' }}>
              <ListItemIcon>
                <Delete fontSize="small" color="error" />
              </ListItemIcon>
              <ListItemText>{t('card.delete')}</ListItemText>
            </MenuItem>
          )}
        </Menu>
      )}
    </MotionCard>
  );
}
