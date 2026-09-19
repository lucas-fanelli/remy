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
 * control. DOM elements and ImageUpload's handle both fit. It is a FOCUS registry only:
 * the entry goes away when the block unmounts, so it cannot be used to cancel the cover
 * upload - that is what `coverHandleRef` is for.
 */
export interface FieldFocusTarget {
  focus(): void;
  scrollIntoView?(options?: ScrollIntoViewOptions): void;
}

/** Called with the target when a field mounts and with null when it unmounts */
export type RegisterField = (path: RecipeFieldPath, target: FieldFocusTarget | null) => void;

/** Owned by the shell (`useRef<ImageUploadHandle | null>(null)`), filled by this block */
export type CoverHandleRef = React.MutableRefObject<ImageUploadHandle | null>;

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
  /**
   * Receives the cover's upload handle and KEEPS it when this block unmounts (the author
   * went to the other tab): ImageUpload goes on uploading after an unmount and then writes
   * the URL through `setField`, so a late upload would land in a form that was reset in
   * the meantime. Call `coverHandleRef.current?.cancel()` BEFORE `form.reset()`,
   * `form.load()`, Start over or Discard. `cancel()` reaches every upload started through
   * this ref, also the one of a block that has unmounted and mounted again since.
   */
  coverHandleRef?: CoverHandleRef;
  /** The stored cover URL does not load (a restored draft whose asset is gone) */
  onCoverBrokenChange?: (broken: boolean) => void;
}

const COVER_PATH = 'imageUrl';

// Cover uploads still running, per shell ref. It lives outside the component because it
// has to outlast it: the block that started an upload may be gone when it is cancelled
const runningUploads = new WeakMap<CoverHandleRef, Set<ImageUploadHandle>>();

function runningUploadsOf(ref: CoverHandleRef): Set<ImageUploadHandle> {
  let uploads = runningUploads.get(ref);
  if (!uploads) {
    uploads = new Set();
    runningUploads.set(ref, uploads);
  }
  return uploads;
}

/** Spreadsheet cells, OneNote and Word put a PNG rendering of the text next to the text */
function carriesText(clipboard: DataTransfer): boolean {
  if (Array.from(clipboard.types ?? []).includes('text/plain')) return true;
  return Boolean(clipboard.getData?.('text/plain'));
}

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
  coverHandleRef,
  onCoverBrokenChange,
}: PresentationFieldsProps) {
  const { values, errors, setField, touch, setUploading } = form;
  const coverRef = useRef<ImageUploadHandle | null>(null);
  const coverBusy = useRef(false);
  // Books this block's upload in the shell's set. Still called after the unmount
  const trackUpload = useRef<(busy: boolean) => void>(() => undefined);

  const setCoverHandle = useCallback(
    (handle: ImageUploadHandle | null) => {
      coverRef.current = handle;
      registerField?.(COVER_PATH, handle);
      // The shell's ref is never nulled: cancel() must stay reachable after the unmount
      if (!handle || !coverHandleRef) return;
      const uploads = runningUploadsOf(coverHandleRef);
      trackUpload.current = (busy) => {
        if (busy) uploads.add(handle);
        else uploads.delete(handle);
      };
      coverHandleRef.current = {
        ...handle,
        cancel: () => {
          handle.cancel();
          // Uploads started by an earlier mount of this block. A cancelled upload
          // reports 'not busy', which removes its entry: iterate over a copy
          Array.from(uploads).forEach((earlier) => earlier.cancel());
        },
      };
    },
    [registerField, coverHandleRef]
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
      trackUpload.current(busy);
    },
    [setUploading]
  );

  // ImageUpload consumes (and stops) a paste that lands on the cover itself; this one
  // catches an image pasted while the caret is in the description or the closing note.
  // Only a PURE image paste feeds the cover: when the clipboard also carries text the
  // author is pasting text, and it must reach the field untouched
  const handlePaste = (event: React.ClipboardEvent) => {
    if (disabled || coverBusy.current) return;
    if (carriesText(event.clipboardData)) return;
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
