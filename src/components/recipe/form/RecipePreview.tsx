'use client';
import { Edit, Person } from '@mui/icons-material';
import { Box, Button, Chip, Skeleton, Typography } from '@mui/material';
import React, { useState } from 'react';
import CaptionQuote from '@/components/recipe/display/CaptionQuote';
import DifficultyChip from '@/components/recipe/display/DifficultyChip';
import { formatServings } from '@/components/recipe/display/displayFormat';
import IngredientLine from '@/components/recipe/display/IngredientLine';
import RecipeCoverBadges from '@/components/recipe/display/RecipeCoverBadges';
import RecipeTimeStrip from '@/components/recipe/display/RecipeTimeStrip';
import StepNumber from '@/components/recipe/display/StepNumber';
import { RecipeFieldPath, RecipeFormSection, RecipePayload } from './types';

export interface RecipePreviewProps {
  /**
   * `form.toPayload()` - never the raw values: the preview prints exactly what will be
   * sent, so step numbers and dropped blank rows can not disagree with the published page.
   */
  payload: RecipePayload;
  /**
   * Renders a right-aligned [Edit] button on the header of each of the four sections.
   * `path` is the first control of the section when there is an obvious one ('imageUrl',
   * 'title'); the list sections pass none.
   */
  onEditSection?: (section: RecipeFormSection, path?: RecipeFieldPath) => void;
  /** Side panels and sheets: tighter spacing and smaller type */
  compact?: boolean;
  /** Empty blocks render a quiet, named shape ('Cover photo', 'No steps yet') instead of nothing */
  placeholders?: boolean;
  /** Names used by the Edit buttons ('Edit basics'); match them to the shell's own section names */
  sectionLabels?: Partial<Record<RecipeFormSection, string>>;
}

const DEFAULT_SECTION_LABELS: Record<RecipeFormSection, string> = {
  basics: 'Basics',
  ingredients: 'Ingredients',
  steps: 'Steps',
  presentation: 'Photo and description',
};

interface PlaceholderProps {
  name: string;
  /** Heights (px) of the rounded shapes, top to bottom */
  shapes: number[];
  /** Width of the shapes; the last one is shorter, like a paragraph */
  width?: string;
}

/** A quiet stand-in for an empty block: still shapes (no shimmer) plus the block's name */
function Placeholder({ name, shapes, width = '100%' }: PlaceholderProps) {
  return (
    <Box>
      {shapes.map((height, index) => (
        <Skeleton
          key={index}
          variant="rounded"
          animation={false}
          height={height}
          sx={{
            mb: 0.75,
            width: shapes.length > 1 && index === shapes.length - 1 ? '60%' : width,
          }}
        />
      ))}
      <Typography variant="caption" color="text.secondary">
        {name}
      </Typography>
    </Box>
  );
}

/**
 * The recipe as it will be published, built from the same display blocks as the recipe page
 * (src/components/recipe/display). Surfaces are outlined / action.hover, never elevated.
 */
export default function RecipePreview({
  payload,
  onEditSection,
  compact = false,
  placeholders = false,
  sectionLabels,
}: RecipePreviewProps) {
  // Keyed by URL, so a replaced photo gets a fresh chance
  const [brokenImages, setBrokenImages] = useState<Record<string, true>>({});
  const markBroken = (url: string) => setBrokenImages((prev) => ({ ...prev, [url]: true }));

  const labels = { ...DEFAULT_SECTION_LABELS, ...sectionLabels };
  const bodyVariant = compact ? 'body2' : 'body1';
  const { title, description, imageUrl, caption, prepTime, cookingTime, servings } = payload;
  const hasCover = imageUrl !== '' && !brokenImages[imageUrl];
  const hasTimes = prepTime > 0 || cookingTime > 0;

  const editButton = (section: RecipeFormSection, path?: RecipeFieldPath) =>
    onEditSection && (
      <Button
        type="button"
        size="small"
        startIcon={<Edit />}
        aria-label={`Edit ${labels[section].toLowerCase()}`}
        onClick={() => onEditSection(section, path)}
        sx={{ ml: 'auto', flexShrink: 0 }}
      >
        Edit
      </Button>
    );

  const headerSx = { display: 'flex', alignItems: 'center', gap: 1, minWidth: 0 } as const;

  const listHeader = (section: 'ingredients' | 'steps', heading: string) => (
    <Box sx={{ ...headerSx, mb: 1 }}>
      <Typography component="h4" variant={compact ? 'subtitle1' : 'h6'} fontWeight={600}>
        {heading}
      </Typography>
      {editButton(section)}
    </Box>
  );

  const showCover = hasCover || placeholders || Boolean(onEditSection);
  const showIngredients = payload.ingredients.length > 0 || placeholders || Boolean(onEditSection);
  const showSteps = payload.instructions.length > 0 || placeholders || Boolean(onEditSection);

  return (
    <Box sx={{ display: 'grid', gap: compact ? 2 : 3, minWidth: 0 }}>
      {/* Cover: the real 4:3 crop of the feed, with its badges */}
      {showCover && (
        <Box>
          {onEditSection && (
            <Box sx={{ ...headerSx, mb: 0.5 }}>
              <Typography variant="overline" color="text.secondary" noWrap>
                {labels.presentation}
              </Typography>
              {editButton('presentation', 'imageUrl')}
            </Box>
          )}
          {hasCover && (
            <Box
              sx={{
                position: 'relative',
                aspectRatio: '4 / 3',
                borderRadius: 2,
                overflow: 'hidden',
                border: 1,
                borderColor: 'divider',
                bgcolor: 'action.hover',
              }}
            >
              <Box
                component="img"
                src={imageUrl}
                alt={title ? `${title} cover` : 'Recipe cover'}
                onError={() => markBroken(imageUrl)}
                sx={{ display: 'block', width: '100%', height: '100%', objectFit: 'cover' }}
              />
              <RecipeCoverBadges
                difficulty={payload.difficulty}
                totalTime={prepTime + cookingTime}
              />
            </Box>
          )}
          {!hasCover && placeholders && (
            <Box sx={{ position: 'relative' }}>
              <Skeleton
                variant="rounded"
                animation={false}
                sx={{ width: '100%', height: 'auto', aspectRatio: '4 / 3', borderRadius: 2 }}
              />
              <Typography
                variant="caption"
                color="text.secondary"
                sx={{
                  position: 'absolute',
                  inset: 0,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  textAlign: 'center',
                  p: 1,
                }}
              >
                {imageUrl === '' ? 'Cover photo' : 'Cover photo could not be loaded'}
              </Typography>
            </Box>
          )}
        </Box>
      )}

      {/* Title, description, at a glance */}
      <Box sx={{ display: 'grid', gap: compact ? 1 : 1.5, minWidth: 0 }}>
        <Box sx={headerSx}>
          {title !== '' && (
            <Typography
              // Under the 'Preview' h2 of its dialog; the list headings sit one level below
              component="h3"
              variant={compact ? 'h6' : 'h5'}
              sx={{ fontWeight: 700, minWidth: 0, overflowWrap: 'anywhere' }}
            >
              {title}
            </Typography>
          )}
          {title === '' && placeholders && (
            <Box sx={{ flex: '1 1 auto' }}>
              <Placeholder name="No title yet" shapes={[28]} width="70%" />
            </Box>
          )}
          {editButton('basics', 'title')}
        </Box>

        {description !== '' && (
          <Typography
            variant={bodyVariant}
            color="text.secondary"
            sx={{ whiteSpace: 'pre-line', overflowWrap: 'anywhere' }}
          >
            {description}
          </Typography>
        )}
        {description === '' && placeholders && (
          <Placeholder name="No description yet" shapes={[14, 14]} />
        )}

        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
          {/* On the cover the difficulty is already a badge, as in the feed */}
          {!hasCover && <DifficultyChip difficulty={payload.difficulty} size="small" />}
          {servings > 0 && (
            <Chip
              icon={<Person />}
              label={formatServings(servings)}
              variant="outlined"
              size="small"
            />
          )}
        </Box>

        {hasTimes && (
          <RecipeTimeStrip prepTime={prepTime} cookingTime={cookingTime} compact={compact} />
        )}
        {!hasTimes && placeholders && (
          <Placeholder name="No times yet" shapes={[36]} width="220px" />
        )}
      </Box>

      {showIngredients && (
        <Box>
          {listHeader('ingredients', 'Ingredients')}
          {payload.ingredients.length > 0 ? (
            <Box component="ul" sx={{ pl: 2, m: 0 }}>
              {payload.ingredients.map((ingredient, index) => (
                <IngredientLine key={index} ingredient={ingredient} dense={compact} />
              ))}
            </Box>
          ) : (
            placeholders && <Placeholder name="No ingredients yet" shapes={[14, 14, 14]} />
          )}
        </Box>
      )}

      {showSteps && (
        <Box>
          {listHeader('steps', 'Instructions')}
          {payload.instructions.length > 0
            ? payload.instructions.map((instruction) => (
                <Box key={instruction.step} sx={{ display: 'flex', gap: 2, mb: compact ? 2 : 3 }}>
                  <StepNumber number={instruction.step} decorative={false} />
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Typography
                      variant={bodyVariant}
                      sx={{
                        lineHeight: compact ? 1.6 : 1.8,
                        whiteSpace: 'pre-line',
                        overflowWrap: 'anywhere',
                      }}
                    >
                      {instruction.description}
                    </Typography>
                    {instruction.image && !brokenImages[instruction.image] && (
                      <Box
                        component="img"
                        src={instruction.image}
                        alt={`Step ${instruction.step} photo`}
                        onError={() => markBroken(instruction.image as string)}
                        sx={{
                          display: 'block',
                          mt: 1,
                          width: 96,
                          height: 72,
                          objectFit: 'cover',
                          borderRadius: 1,
                          border: 1,
                          borderColor: 'divider',
                        }}
                      />
                    )}
                  </Box>
                </Box>
              ))
            : placeholders && <Placeholder name="No steps yet" shapes={[40, 40]} />}
        </Box>
      )}

      {caption ? (
        <CaptionQuote caption={caption} variant="outlined" sx={compact ? { p: 2 } : undefined} />
      ) : null}
    </Box>
  );
}
