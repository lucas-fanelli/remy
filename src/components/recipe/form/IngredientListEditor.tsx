'use client';
import { Add, InfoOutlined } from '@mui/icons-material';
import { Box, Button, FormHelperText, Paper, Typography, useMediaQuery } from '@mui/material';
import { AnimatePresence } from 'framer-motion';
import { useCallback, useEffect, useId, useRef } from 'react';
import { MotionBox } from '@/components/motion';
import { RECIPE_LIMITS } from '@/lib/constants';
import EditorLiveRegion, { useAnnouncer } from './EditorLiveRegion';
import { rowMotion } from './formMotion';
import { attentionColor } from './formTokens';
import { isBlankIngredientRow, trimTrailingBlankRows } from './formValues';
import IngredientRow from './IngredientRow';
import { neighbourRowId } from './keyboard';
import { IngredientRowValue } from './types';
import { RegisterField } from './useFieldRegistry';
import { usePointerSettled } from './usePointerSettled';
import { IngredientPatch, RecipeFormApi } from './useRecipeForm';
import { useRowFocus } from './useRowFocus';

export interface IngredientListEditorProps {
  /** The engine, or the slice of it this editor reads */
  form: Pick<RecipeFormApi, 'values' | 'errors' | 'ingredients' | 'touch'>;
  /**
   * Reports 'ingredients' (the list: focuses its first control) and, per row,
   * 'ingredients.<rowId>.amount' / '.unit' / '.name'
   */
  registerField?: RegisterField;
  /** Drops the outer border / radius when the parent already is an outlined Paper */
  bare?: boolean;
  disabled?: boolean;
  /** id of the SectionHeading that names this list; without it the group is 'Ingredients' */
  labelledBy?: string;
  /** After a row was removed with its button: what a shell needs to offer Undo (`restore`) */
  onRowRemoved?: (row: IngredientRowValue, index: number) => void;
  /**
   * Row id -> a non-blocking 'look here' note ('No unit recognised - is "lata" part of the
   * name?'). Attention, not an error: the shell drops the entry once the row was edited.
   */
  rowNotes?: Readonly<Record<string, string>>;
}

const GRID_COLUMNS = '88px 128px 1fr 44px';

const isTrailingBlank = (rows: IngredientRowValue[], index: number): boolean =>
  index === rows.length - 1 && isBlankIngredientRow(rows[index]);

/**
 * S6 - one dense list instead of a card per ingredient. Entry is keyboard-continuous: the
 * engine keeps one blank row at the end, Enter walks amount -> unit -> name -> next row,
 * and Backspace in an empty row goes back to the previous name.
 */
export default function IngredientListEditor({
  form,
  registerField,
  bare = false,
  disabled = false,
  labelledBy,
  onRowRemoved,
  rowNotes,
}: IngredientListEditorProps) {
  const { values, errors, ingredients, touch } = form;
  const rows = values.ingredients;

  const containerRef = useRef<HTMLDivElement | null>(null);
  const addButtonRef = useRef<HTMLButtonElement | null>(null);
  const focusRow = useRowFocus(containerRef);
  const whenPointerSettles = usePointerSettled();
  const { message, announce } = useAnnouncer();
  const errorId = useId();

  // Allowed media-query flag (S14): it only matters after the author touches a unit input.
  // No `noSsr`: with it the first client render already says 'coarse', which is a hydration
  // mismatch on the unit inputs wherever the form IS server-rendered (a route). Mounted on
  // the client (a dialog) the first render reads matchMedia either way.
  const coarsePointer = useMediaQuery('(pointer: coarse)');

  // Rows are memoised, so their callbacks keep one identity and read the latest props here
  const latest = useRef({ rows, ingredients, touch, onRowRemoved });
  latest.current = { rows, ingredients, touch, onRowRemoved };

  const handleChange = useCallback((id: string, patch: IngredientPatch) => {
    latest.current.ingredients.update(id, patch);
  }, []);

  // Validating adds a helper line: never while the press that moved focus is still down
  const handleRowBlur = useCallback(
    (id: string) => whenPointerSettles(() => latest.current.touch(`ingredients.${id}`)),
    [whenPointerSettles]
  );

  const handleRemove = useCallback(
    (id: string) => {
      const current = latest.current;
      const index = current.rows.findIndex((row) => row.id === id);
      if (index === -1) return;

      // Focus goes to the nearest row that still has a Remove button (a button, so no
      // virtual keyboard pops up on a phone), or to 'Add ingredient' when none is left
      const removable = current.rows.filter((_row, i) => !isTrailingBlank(current.rows, i));
      const neighbour = neighbourRowId(removable, id);

      current.ingredients.remove(id);
      if (neighbour) focusRow(neighbour, 'remove');
      else addButtonRef.current?.focus();
      announce(`Ingredient ${index + 1} removed`);
      current.onRowRemoved?.(current.rows[index], index);
    },
    [announce, focusRow]
  );

  const handleNameEnter = useCallback(
    (id: string) => {
      const current = latest.current.rows;
      const next = current[current.findIndex((row) => row.id === id) + 1];
      if (next) focusRow(next.id, 'amount');
      else addButtonRef.current?.focus();
    },
    [focusRow]
  );

  const handleEmptyBackspace = useCallback(
    (id: string) => {
      const current = latest.current;
      const index = current.rows.findIndex((row) => row.id === id);
      // The only row stays: there is nowhere to go back to
      if (index === -1 || current.rows.length === 1) return;

      const previous = current.rows[index - 1];
      current.ingredients.remove(id);
      if (previous) focusRow(previous.id, 'name', { caretAtEnd: true });
      else focusRow(current.rows[index + 1].id, 'amount');
      // Removing the trailing blank row changes nothing the author can count
      if (!isTrailingBlank(current.rows, index)) announce(`Ingredient ${index + 1} removed`);
    },
    [announce, focusRow]
  );

  const handleAdd = () => {
    const id = ingredients.add();
    if (!id) return;
    focusRow(id, 'amount');
    const filled = trimTrailingBlankRows(rows, isBlankIngredientRow).length;
    announce(`Ingredient ${filled + 1} added`);
  };

  // 'Add at least one ingredient' has no control of its own: send focus to the first row
  useEffect(() => {
    if (!registerField) return undefined;
    registerField('ingredients', {
      focus: () => {
        const first = latest.current.rows[0];
        if (first) focusRow(first.id, 'amount');
      },
      scrollIntoView: (options) => containerRef.current?.scrollIntoView?.(options),
    });
    return () => registerField('ingredients', null);
  }, [registerField, focusRow]);

  const list = (
    <>
      <Box
        aria-hidden="true"
        sx={{
          display: { xs: 'none', sm: 'grid' },
          gridTemplateColumns: GRID_COLUMNS,
          gap: 1,
          px: 1.5,
          py: 0.5,
          borderBottom: 1,
          borderColor: 'divider',
          borderLeft: '3px solid transparent',
          bgcolor: 'action.hover',
        }}
      >
        {['Amount', 'Unit', 'Ingredient'].map((heading) => (
          <Typography key={heading} variant="caption" color="text.secondary">
            {heading}
          </Typography>
        ))}
      </Box>

      <AnimatePresence initial={false}>
        {rows.map((row, index) => (
          <MotionBox key={row.id} {...rowMotion}>
            <IngredientRow
              row={row}
              index={index}
              amountError={errors[`ingredients.${row.id}.amount`]}
              unitError={errors[`ingredients.${row.id}.unit`]}
              nameError={errors[`ingredients.${row.id}.name`]}
              note={rowNotes?.[row.id]}
              removable={!isTrailingBlank(rows, index)}
              coarsePointer={coarsePointer}
              disabled={disabled}
              onChange={handleChange}
              onRowBlur={handleRowBlur}
              onRemove={handleRemove}
              onNameEnter={handleNameEnter}
              onEmptyBackspace={handleEmptyBackspace}
              registerField={registerField}
            />
          </MotionBox>
        ))}
      </AnimatePresence>

      <Button
        ref={addButtonRef}
        type="button"
        fullWidth
        startIcon={<Add />}
        disabled={disabled || !ingredients.canAdd}
        onClick={handleAdd}
        sx={{ justifyContent: 'flex-start', height: 48, px: 1.5, borderRadius: 0 }}
      >
        Add ingredient
      </Button>
    </>
  );

  return (
    <Box
      role="group"
      aria-labelledby={labelledBy}
      aria-label={labelledBy ? undefined : 'Ingredients'}
      aria-describedby={errors.ingredients ? errorId : undefined}
    >
      {bare ? (
        <Box ref={containerRef}>{list}</Box>
      ) : (
        <Paper ref={containerRef} variant="outlined" sx={{ borderRadius: 2, overflow: 'hidden' }}>
          {list}
        </Paper>
      )}

      {errors.ingredients && (
        <FormHelperText id={errorId} error>
          {errors.ingredients}
        </FormHelperText>
      )}

      {!ingredients.canAdd && (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mt: 1, px: 1.5 }}>
          <InfoOutlined fontSize="small" sx={{ color: attentionColor }} />
          <Typography variant="caption" color="text.secondary">
            {RECIPE_LIMITS.ingredients} ingredients is the most a recipe can have
          </Typography>
        </Box>
      )}

      <Typography
        variant="caption"
        color="text.secondary"
        sx={{ display: 'block', mt: 1, px: 1.5 }}
      >
        No exact amount? Leave amount and unit empty - it shows as to taste.
      </Typography>

      <EditorLiveRegion message={message} />
    </Box>
  );
}
