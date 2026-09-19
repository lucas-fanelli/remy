'use client';
import { ArrowDownward, ArrowUpward, Close } from '@mui/icons-material';
import { Box, IconButton, TextField } from '@mui/material';
import { memo } from 'react';
import ImageUpload, { type ImageUploadHandle } from '@/components/common/ImageUpload';
import { RECIPE_LIMITS } from '@/lib/constants';
import { fieldHelper } from './fieldHelper';
import { getFieldCounter } from './formTokens';
import { isModEnter } from './keyboard';
import StepNumberBadge from './StepNumberBadge';
import { StepRowValue } from './types';
import { RegisterField, useFieldRef } from './useFieldRegistry';
import { StepPatch } from './useRecipeForm';
import type { FocusEvent, KeyboardEvent } from 'react';

export interface StepRowProps {
  row: StepRowValue;
  /** Zero-based position: the number shown and spoken is `index + 1`, never stored */
  index: number;
  isFirst: boolean;
  isLast: boolean;
  /** Visible errors of this row: `errors['steps.<id>.description']` / `'.image'` */
  descriptionError?: string;
  imageError?: string;
  disabled?: boolean;
  onChange: (id: string, patch: StepPatch) => void;
  /** Focus left the ROW: the moment a step validates */
  onRowBlur: (id: string) => void;
  onRemove: (id: string) => void;
  onMove: (id: string, direction: -1 | 1) => void;
  /** Ctrl / Cmd + Enter in the text: add the next step right after this one */
  onAddAfter: (id: string) => void;
  /** Upload accounting: the list editor forwards it to `setUploading('steps.<id>', busy)` */
  onUploadingChange: (id: string, busy: boolean) => void;
  registerField?: RegisterField;
}

const actionButtonSx = {
  color: 'text.secondary',
  '&.Mui-disabled': { color: 'action.disabled' },
};

/**
 * S7 - a step laid out like the published one: the numbered circle, then the text. Under
 * the text one action row: the optional photo on the left, move / remove on the right.
 */
function StepRow({
  row,
  index,
  isFirst,
  isLast,
  descriptionError,
  imageError,
  disabled = false,
  onChange,
  onRowBlur,
  onRemove,
  onMove,
  onAddAfter,
  onUploadingChange,
  registerField,
}: StepRowProps) {
  const position = index + 1;
  const path = `steps.${row.id}`;

  const registerDescription = useFieldRef<HTMLTextAreaElement>(
    registerField,
    `${path}.description`
  );
  const registerImage = useFieldRef<ImageUploadHandle>(registerField, `${path}.image`);

  const handleBlur = (event: FocusEvent<HTMLElement>) => {
    if (event.currentTarget.contains(event.relatedTarget as Node | null)) return;
    onRowBlur(row.id);
  };

  // Plain Enter stays a newline; only Ctrl / Cmd + Enter is a command here
  const handleKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (!isModEnter(event)) return;
    event.preventDefault();
    onAddAfter(row.id);
  };

  return (
    <Box
      role="group"
      aria-label={`Step ${position}`}
      data-row-id={row.id}
      onBlur={handleBlur}
      sx={{
        display: 'flex',
        gap: 2,
        px: 2,
        py: 2,
        borderBottom: 1,
        borderColor: 'divider',
        alignItems: 'flex-start',
      }}
    >
      <StepNumberBadge number={position} />

      <Box sx={{ flex: 1, minWidth: 0 }}>
        <TextField
          multiline
          minRows={2}
          maxRows={10}
          hiddenLabel
          fullWidth
          value={row.description}
          onChange={(event) => onChange(row.id, { description: event.target.value })}
          onKeyDown={handleKeyDown}
          error={Boolean(descriptionError)}
          helperText={fieldHelper(
            descriptionError,
            getFieldCounter(row.description.length, RECIPE_LIMITS.stepText)
          )}
          disabled={disabled}
          placeholder="What happens in this step?"
          inputRef={registerDescription}
          slotProps={{
            htmlInput: {
              'aria-label': `Step ${position}`,
              'data-field': 'description',
              maxLength: RECIPE_LIMITS.stepText,
              autoCapitalize: 'sentences',
            },
          }}
        />

        <Box
          sx={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            mt: 0.5,
          }}
        >
          <ImageUpload
            ref={registerImage}
            variant="inline"
            label={`Step ${position} photo (optional)`}
            required={false}
            value={row.image}
            onChange={(url) => onChange(row.id, { image: url })}
            onUploadingChange={(busy) => onUploadingChange(row.id, busy)}
            error={Boolean(imageError)}
            helperText={imageError}
            disabled={disabled}
          />

          <Box sx={{ display: 'flex', flexShrink: 0 }}>
            <IconButton
              type="button"
              aria-label={`Move step ${position} up`}
              data-field="move-up"
              disabled={disabled || isFirst}
              onClick={() => onMove(row.id, -1)}
              sx={actionButtonSx}
            >
              <ArrowUpward />
            </IconButton>
            <IconButton
              type="button"
              aria-label={`Move step ${position} down`}
              data-field="move-down"
              disabled={disabled || isLast}
              onClick={() => onMove(row.id, 1)}
              sx={actionButtonSx}
            >
              <ArrowDownward />
            </IconButton>
            <IconButton
              type="button"
              aria-label={`Remove step ${position}`}
              data-field="remove"
              disabled={disabled}
              onClick={() => onRemove(row.id)}
              sx={{
                color: 'text.disabled',
                '&:hover, &:focus-visible': { color: 'error.main' },
              }}
            >
              <Close />
            </IconButton>
          </Box>
        </Box>
      </Box>
    </Box>
  );
}

export default memo(StepRow);
