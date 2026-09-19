'use client';
import { Box, TextField } from '@mui/material';
import React, { useCallback, useRef } from 'react';
import ImageUpload, { ImageUploadHandle } from '@/components/common/ImageUpload';
import { firstFileFrom } from '@/components/common/imageUploadUtils';
import RecipeCoverBadges from '@/components/recipe/display/RecipeCoverBadges';
import { RECIPE_LIMITS } from '@/lib/constants';
import { FieldCounter, counterEmphasisSx, formSpacing, getFieldCounter } from './formTokens';
import { NumericFieldValue, RecipeFieldPath } from './types';
import type { RecipeFormApi } from './useRecipeForm';

/**
 * What a shell keeps in its ref map (keyed by error path) to focus the first invalid
 * control. DOM elements and ImageUpload's handle both fit.
 */
export interface FieldFocusTarget {
  focus(): void;
  scrollIntoView?(options?: ScrollIntoViewOptions): void;
  /** Upload fields only: abandon the upload in flight. Call it BEFORE resetting the form */
  cancel?(): void;
}

/** Called with the target when a field mounts and with null when it unmounts */
export type RegisterField = (path: RecipeFieldPath, target: FieldFocusTarget | null) => void;

export type PresentationFieldsForm = Pick<
  RecipeFormApi,
  'values' | 'errors' | 'setField' | 'touch' | 'setUploading'
>;

export interface PresentationFieldsProps {
  /** The RecipeFormApi (or the slice above) */
  form: PresentationFieldsForm;
  /** A submit is in flight. A `<fieldset disabled>` does not reach the cover's trigger */
  disabled?: boolean;
  /** Registers 'imageUrl' (the ImageUpload handle), 'description' and 'caption' */
  registerField?: RegisterField;
  /** The stored cover URL does not load (a restored draft whose asset is gone) */
  onCoverBrokenChange?: (broken: boolean) => void;
}

const COVER_PATH = 'imageUrl';

const minutes = (value: NumericFieldValue): number => (value === '' ? 0 : value);

/** The helperText slot: the message on the left, the 'n/max' counter right-aligned */
function HelperLine({ message, counter }: { message?: string; counter: FieldCounter }) {
  return (
    <Box component="span" sx={{ display: 'flex', gap: 1 }}>
      <Box component="span" sx={{ flex: '1 1 auto', minWidth: 0 }}>
        {message}
      </Box>
      {counter.visible && (
        <Box
          component="span"
          sx={{
            flexShrink: 0,
            // Never the error red and never orange: emphasis is weight + text.primary
            color: 'text.secondary',
            ...(counter.emphasised && counterEmphasisSx),
          }}
        >
          {counter.text}
        </Box>
      )}
    </Box>
  );
}

/**
 * Cover photo + Description + 'Closing note (optional)': the 'presentation' section, the
 * last one in the author's order. The cover never gates anything. An image pasted anywhere
 * inside the block feeds the cover.
 */
export default function PresentationFields({
  form,
  disabled = false,
  registerField,
  onCoverBrokenChange,
}: PresentationFieldsProps) {
  const { values, errors, setField, touch, setUploading } = form;
  const coverRef = useRef<ImageUploadHandle | null>(null);
  const coverBusy = useRef(false);

  const setCoverHandle = useCallback(
    (handle: ImageUploadHandle | null) => {
      coverRef.current = handle;
      registerField?.(COVER_PATH, handle);
    },
    [registerField]
  );
  const setDescriptionInput = useCallback(
    (element: HTMLElement | null) => registerField?.('description', element),
    [registerField]
  );
  const setCaptionInput = useCallback(
    (element: HTMLElement | null) => registerField?.('caption', element),
    [registerField]
  );

  const handleCoverChange = useCallback((url: string) => setField(COVER_PATH, url), [setField]);

  const handleCoverUploading = useCallback(
    (busy: boolean) => {
      coverBusy.current = busy;
      setUploading(COVER_PATH, busy);
    },
    [setUploading]
  );

  // ImageUpload consumes (and stops) a paste that lands on the cover itself; this one
  // catches an image pasted while the caret is in the description or the closing note
  const handlePaste = (event: React.ClipboardEvent) => {
    if (disabled || coverBusy.current) return;
    const file = firstFileFrom(event.clipboardData, true);
    if (!file) return;
    event.preventDefault();
    coverRef.current?.uploadFile(file);
  };

  return (
    <Box
      onPaste={handlePaste}
      sx={{
        display: 'grid',
        gridTemplateColumns: { xs: '1fr', sm: '5fr 7fr' },
        gap: formSpacing.field,
        alignItems: 'start',
      }}
    >
      <ImageUpload
        ref={setCoverHandle}
        value={values.imageUrl}
        onChange={handleCoverChange}
        label="Cover photo"
        required
        error={Boolean(errors.imageUrl)}
        helperText={errors.imageUrl}
        onUploadingChange={handleCoverUploading}
        onBrokenChange={onCoverBrokenChange}
        disabled={disabled}
        overlay={
          <RecipeCoverBadges
            difficulty={values.difficulty}
            totalTime={minutes(values.prepTime) + minutes(values.cookingTime)}
          />
        }
      />

      <Box sx={{ display: 'grid', gap: formSpacing.field, minWidth: 0 }}>
        <TextField
          label="Description"
          required
          fullWidth
          multiline
          rows={4}
          value={values.description}
          onChange={(event) => setField('description', event.target.value)}
          onBlur={() => touch('description')}
          error={Boolean(errors.description)}
          helperText={
            <HelperLine
              message={errors.description}
              counter={getFieldCounter(values.description.length, RECIPE_LIMITS.description, true)}
            />
          }
          disabled={disabled}
          inputRef={setDescriptionInput}
          slotProps={{
            htmlInput: { maxLength: RECIPE_LIMITS.description, autoCapitalize: 'sentences' },
          }}
        />

        <TextField
          label="Closing note (optional)"
          fullWidth
          multiline
          rows={2}
          value={values.caption}
          onChange={(event) => setField('caption', event.target.value)}
          onBlur={() => touch('caption')}
          error={Boolean(errors.caption)}
          helperText={
            <HelperLine
              message={errors.caption ?? 'Shown as a quote after the last step'}
              counter={getFieldCounter(values.caption.length, RECIPE_LIMITS.caption)}
            />
          }
          disabled={disabled}
          inputRef={setCaptionInput}
          slotProps={{
            htmlInput: { maxLength: RECIPE_LIMITS.caption, autoCapitalize: 'sentences' },
          }}
        />
      </Box>
    </Box>
  );
}
