'use client';
import { Add, InfoOutlined } from '@mui/icons-material';
import { Box, Button, FormHelperText, Paper, Typography } from '@mui/material';
import { AnimatePresence } from 'framer-motion';
import { useCallback, useEffect, useId, useRef } from 'react';
import { MotionBox } from '@/components/motion';
import StepNumber from '@/components/recipe/display/StepNumber';
import { RECIPE_LIMITS } from '@/lib/constants';
import EditorLiveRegion, { useAnnouncer } from './EditorLiveRegion';
import { rowMotion } from './formMotion';
import { attentionColor } from './formTokens';
import { neighbourRowId } from './keyboard';
import StepRow from './StepRow';
import { StepRowValue } from './types';
import { RegisterField } from './useFieldRegistry';
import { usePointerSettled } from './usePointerSettled';
import { RecipeFormApi, StepPatch } from './useRecipeForm';
import { useRowFocus } from './useRowFocus';

export interface StepListEditorProps {
  /** The engine, or the slice of it this editor reads */
  form: Pick<RecipeFormApi, 'values' | 'errors' | 'steps' | 'touch' | 'setUploading'>;
  /**
   * Reports 'steps' (the list: focuses the first step, or 'Add step' when there is none)
   * and, per row, 'steps.<rowId>.description' (textarea) / '.image' (ImageUpload handle)
   */
  registerField?: RegisterField;
  disabled?: boolean;
  /** id of the SectionHeading that names this list; without it the group is 'Steps' */
  labelledBy?: string;
  /** After a step was removed: what a shell needs to offer Undo (`form.steps.restore`) */
  onRowRemoved?: (row: StepRowValue, index: number) => void;
}

/**
 * S7 - numbered rows that mirror the published page. Ctrl / Cmd + Enter adds the next
 * step, plain Enter is a newline; steps move with buttons (no drag library) and focus
 * follows the step that moved.
 */
export default function StepListEditor({
  form,
  registerField,
  disabled = false,
  labelledBy,
  onRowRemoved,
}: StepListEditorProps) {
  const { values, errors, steps, touch, setUploading } = form;
  const rows = values.steps;

  const containerRef = useRef<HTMLDivElement | null>(null);
  const addButtonRef = useRef<HTMLButtonElement | null>(null);
  const focusRow = useRowFocus(containerRef);
  const whenPointerSettles = usePointerSettled();
  const { message, announce } = useAnnouncer();
  const errorId = useId();

  // Rows are memoised, so their callbacks keep one identity and read the latest props here
  const latest = useRef({ rows, steps, touch, setUploading, onRowRemoved });
  latest.current = { rows, steps, touch, setUploading, onRowRemoved };

  const handleChange = useCallback((id: string, patch: StepPatch) => {
    latest.current.steps.update(id, patch);
  }, []);

  // Validating adds a helper line: never while the press that moved focus is still down
  const handleRowBlur = useCallback(
    (id: string) => whenPointerSettles(() => latest.current.touch(`steps.${id}`)),
    [whenPointerSettles]
  );

  const handleUploadingChange = useCallback((id: string, busy: boolean) => {
    latest.current.setUploading(`steps.${id}`, busy);
  }, []);

  const handleRemove = useCallback(
    (id: string) => {
      const current = latest.current;
      const index = current.rows.findIndex((row) => row.id === id);
      if (index === -1) return;

      const neighbour = neighbourRowId(current.rows, id);
      current.steps.remove(id);
      if (neighbour) focusRow(neighbour, 'remove');
      else addButtonRef.current?.focus();
      announce(`Step ${index + 1} removed`);
      current.onRowRemoved?.(current.rows[index], index);
    },
    [announce, focusRow]
  );

  const handleMove = useCallback(
    (id: string, direction: -1 | 1) => {
      const current = latest.current;
      const from = current.rows.findIndex((row) => row.id === id);
      const to = from + direction;
      if (from === -1 || to < 0 || to >= current.rows.length) return;

      current.steps.move(id, direction);
      // Focus follows the step. The button that was pressed is disabled once the step
      // reaches an end of the list, so there the opposite button takes over
      const reachedEnd = to === 0 || to === current.rows.length - 1;
      const pressed = direction === -1 ? 'move-up' : 'move-down';
      const opposite = direction === -1 ? 'move-down' : 'move-up';
      focusRow(id, reachedEnd ? opposite : pressed, { afterCommit: true });
      announce(`Step ${from + 1} moved ${direction === -1 ? 'up' : 'down'}, now step ${to + 1}`);
    },
    [announce, focusRow]
  );

  const addStep = useCallback(
    (afterId?: string) => {
      const current = latest.current;
      const id = current.steps.add(afterId);
      if (!id) return;
      focusRow(id, 'description');
      const after = current.rows.findIndex((row) => row.id === afterId);
      announce(`Step ${(after === -1 ? current.rows.length : after + 1) + 1} added`);
    },
    [announce, focusRow]
  );

  // 'Add at least one step' has no control of its own
  useEffect(() => {
    if (!registerField) return undefined;
    registerField('steps', {
      focus: () => {
        const first = latest.current.rows[0];
        if (first) focusRow(first.id, 'description');
        else addButtonRef.current?.focus();
      },
      scrollIntoView: (options) => containerRef.current?.scrollIntoView?.(options),
    });
    return () => registerField('steps', null);
  }, [registerField, focusRow]);

  const list = (
    <>
      <AnimatePresence initial={false}>
        {rows.map((row, index) => (
          <MotionBox key={row.id} {...rowMotion}>
            <StepRow
              row={row}
              index={index}
              isFirst={index === 0}
              isLast={index === rows.length - 1}
              descriptionError={errors[`steps.${row.id}.description`]}
              imageError={errors[`steps.${row.id}.image`]}
              disabled={disabled}
              onChange={handleChange}
              onRowBlur={handleRowBlur}
              onRemove={handleRemove}
              onMove={handleMove}
              onAddAfter={addStep}
              onUploadingChange={handleUploadingChange}
              registerField={registerField}
            />
          </MotionBox>
        ))}
      </AnimatePresence>

      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, px: 2, py: 1 }}>
        <StepNumber number={rows.length + 1} ghost />
        <Button
          ref={addButtonRef}
          type="button"
          fullWidth
          startIcon={<Add />}
          disabled={disabled || !steps.canAdd}
          onClick={() => addStep()}
          sx={{ justifyContent: 'flex-start', height: 48 }}
        >
          Add step
        </Button>
      </Box>
    </>
  );

  return (
    <Box
      role="group"
      aria-labelledby={labelledBy}
      aria-label={labelledBy ? undefined : 'Steps'}
      aria-describedby={errors.steps ? errorId : undefined}
    >
      <Paper ref={containerRef} variant="outlined" sx={{ borderRadius: 2, overflow: 'hidden' }}>
        {list}
      </Paper>

      {errors.steps && (
        <FormHelperText id={errorId} error>
          {errors.steps}
        </FormHelperText>
      )}

      {!steps.canAdd && (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mt: 1, px: 2 }}>
          <InfoOutlined fontSize="small" sx={{ color: attentionColor }} />
          <Typography variant="caption" color="text.secondary">
            {RECIPE_LIMITS.steps} steps is the most a recipe can have
          </Typography>
        </Box>
      )}

      {/* Keyboard hint: pointless (and hidden) where the pointer is a finger */}
      <Typography
        variant="caption"
        color="text.secondary"
        sx={{ display: 'block', mt: 1, px: 2, '@media (pointer: coarse)': { display: 'none' } }}
      >
        Ctrl+Enter (Cmd+Enter on a Mac) adds the next step.
      </Typography>

      <EditorLiveRegion message={message} />
    </Box>
  );
}
