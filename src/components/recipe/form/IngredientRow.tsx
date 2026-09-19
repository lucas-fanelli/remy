'use client';
import { Close } from '@mui/icons-material';
import { Autocomplete, Box, Chip, FormHelperText, IconButton, TextField } from '@mui/material';
import { memo, useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import { RECIPE_LIMITS, RECIPE_UNITS, RECIPE_UNIT_LABELS, RecipeUnit } from '@/lib/constants';
import { fieldHelper } from './fieldHelper';
import { getFieldCounter } from './formTokens';
import { isBlankIngredientRow, isToTasteRow } from './formValues';
import { focusNextField, isBackspaceOnEmpty, isPlainEnter } from './keyboard';
import { IngredientRowValue } from './types';
import { RegisterField, useFieldRef } from './useFieldRegistry';
import { IngredientPatch } from './useRecipeForm';
import { useRowIdRef } from './useRowFocus';
import type { FocusEvent, HTMLAttributes, Key, KeyboardEvent, SyntheticEvent } from 'react';

export interface IngredientRowProps {
  row: IngredientRowValue;
  /** Zero-based position in the list: names the controls ('Amount for ingredient 2') */
  index: number;
  /** Visible errors of this row: `errors['ingredients.<id>.amount']` and so on */
  amountError?: string;
  unitError?: string;
  nameError?: string;
  /** The engine's trailing blank row has nothing to remove, so it gets no Remove button */
  removable?: boolean;
  /** Coarse pointer: the unit input opens its list without raising the virtual keyboard */
  coarsePointer?: boolean;
  disabled?: boolean;
  onChange: (id: string, patch: IngredientPatch) => void;
  /** Focus left the ROW: the moment a row validates and its amount is normalised */
  onRowBlur: (id: string) => void;
  onRemove: (id: string) => void;
  /** Enter in Name: continue in the next row */
  onNameEnter: (id: string) => void;
  /** Backspace in the empty Amount of an empty row */
  onEmptyBackspace: (id: string) => void;
  registerField?: RegisterField;
}

const unitOptionText = (unit: string): string => {
  const label = RECIPE_UNIT_LABELS[unit as RecipeUnit];
  return label && label !== unit ? `${unit} - ${label}` : unit;
};

/**
 * Typing 'g' + Tab must pick grams, not the first unit that merely contains a 'g': exact
 * unit first, then units and expanded names that START with the text, then the rest.
 */
export function filterUnitOptions(options: string[], inputValue: string): string[] {
  const query = inputValue.trim().toLowerCase();
  if (query === '') return options;

  const rank = (unit: string): number => {
    const short = unit.toLowerCase();
    const long = (RECIPE_UNIT_LABELS[unit as RecipeUnit] ?? '').toLowerCase();
    if (short === query) return 0;
    if (short.startsWith(query)) return 1;
    if (long.startsWith(query)) return 2;
    return short.includes(query) || long.includes(query) ? 3 : -1;
  };

  return options
    .map((unit, position) => ({ unit, position, rank: rank(unit) }))
    .filter((entry) => entry.rank !== -1)
    .sort((a, b) => a.rank - b.rank || a.position - b.position)
    .map((entry) => entry.unit);
}

/**
 * S6 - one line of the dense ingredient grid, in the published reading order Amount, Unit,
 * Name, Remove (the DOM / tab order at every width). Fields are `small` (40px): this grid
 * is the one place where that size is allowed.
 */
function IngredientRow({
  row,
  index,
  amountError,
  unitError,
  nameError,
  removable = true,
  coarsePointer = false,
  disabled = false,
  onChange,
  onRowBlur,
  onRemove,
  onNameEnter,
  onEmptyBackspace,
  registerField,
}: IngredientRowProps) {
  const position = index + 1;
  const path = `ingredients.${row.id}`;
  const helperId = useId();
  const rowRef = useRowIdRef(row.id);

  // While focus is in the row the author edits plain inputs; at rest a named row without
  // amount and unit shows ONE 'to taste' chip in their place (Pantry's model)
  const [editing, setEditing] = useState(false);
  const [unitText, setUnitText] = useState(row.unit);
  const showToTasteChip = isToTasteRow(row) && !editing;

  const amountInput = useRef<HTMLInputElement | null>(null);
  const nameInput = useRef<HTMLInputElement | null>(null);
  const focusAmountWhenShown = useRef(false);

  const registerAmount = useFieldRef<HTMLInputElement>(registerField, `${path}.amount`);
  const registerUnit = useFieldRef<HTMLInputElement>(registerField, `${path}.unit`);
  const registerName = useFieldRef<HTMLInputElement>(registerField, `${path}.name`);

  const setAmountInput = useCallback(
    (element: HTMLInputElement | null) => {
      amountInput.current = element;
      registerAmount(element);
    },
    [registerAmount]
  );
  const setNameInput = useCallback(
    (element: HTMLInputElement | null) => {
      nameInput.current = element;
      registerName(element);
    },
    [registerName]
  );

  // The chip was activated: the inputs are back, continue in Amount
  useEffect(() => {
    if (showToTasteChip || !focusAmountWhenShown.current) return;
    focusAmountWhenShown.current = false;
    amountInput.current?.focus();
  }, [showToTasteChip]);

  // In Edit a stored legacy unit ('pieces', 'whole') stays selectable in ITS row
  const unitOptions = useMemo<string[]>(() => {
    const known = (RECIPE_UNITS as readonly string[]).includes(row.unit);
    return row.unit === '' || known ? [...RECIPE_UNITS] : [...RECIPE_UNITS, row.unit];
  }, [row.unit]);

  const name = row.name.trim();
  const rowError = amountError || unitError || nameError;
  const helper = fieldHelper(rowError, getFieldCounter(row.name.length, RECIPE_LIMITS.name));
  const describedBy = helper ? helperId : undefined;

  const handleFocus = (event: FocusEvent<HTMLElement>) => {
    // Landing on the chip or on Remove is not editing; landing in a field is
    if (event.target instanceof HTMLInputElement) setEditing(true);
  };

  const handleBlur = (event: FocusEvent<HTMLElement>) => {
    if (event.currentTarget.contains(event.relatedTarget as Node | null)) return;
    setEditing(false);
    onRowBlur(row.id);
  };

  const handleAmountKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (isBackspaceOnEmpty(event) && isBlankIngredientRow(row)) {
      event.preventDefault();
      onEmptyBackspace(row.id);
      return;
    }
    focusNextField(event);
  };

  const handleUnitKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (!isPlainEnter(event)) return;
    // Enter on a highlighted option is MUI's: it picks the unit (handleUnitChange moves on).
    // MUI keeps both facts on the input itself, so there is no state to mirror here.
    const input = event.target as HTMLElement;
    const listOpen = input.getAttribute('aria-expanded') === 'true';
    if (listOpen && input.getAttribute('aria-activedescendant')) return;
    // Nothing highlighted: the open list would swallow Enter and strand the keyboard user
    event.preventDefault();
    nameInput.current?.focus();
  };

  const handleUnitChange = (event: SyntheticEvent, unit: string) => {
    onChange(row.id, { unit });
    // Picked with Enter: keep going, like Tab does
    if ('key' in event && event.key === 'Enter') nameInput.current?.focus();
  };

  const handleUnitInputChange = (_event: SyntheticEvent, text: string, reason: string) => {
    setUnitText(text);
    // The list is closed (no free text) and has no clear button: emptying the text is
    // how the unit is cleared, which is what makes a named row 'to taste'
    if (reason === 'input' && text === '' && row.unit !== '') onChange(row.id, { unit: '' });
  };

  const handleNameKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (!isPlainEnter(event)) return;
    event.preventDefault();
    onNameEnter(row.id);
  };

  return (
    <Box
      role="group"
      aria-label={`Ingredient ${position}`}
      ref={rowRef}
      onFocus={handleFocus}
      onBlur={handleBlur}
      sx={{
        display: 'grid',
        gridTemplateColumns: { xs: '88px 1fr 44px', sm: '88px 128px 1fr 44px' },
        gridTemplateAreas: {
          xs: '"amount unit remove" "name name name"',
          sm: '"amount unit name remove"',
        },
        gap: 1,
        alignItems: 'center',
        px: 1.5,
        py: 0.75,
        borderBottom: 1,
        borderColor: 'divider',
        // Always 3px wide so a failing row does not shift; never colour alone: the helper
        // line below names the problem
        borderLeft: '3px solid',
        borderLeftColor: rowError ? 'error.main' : 'transparent',
      }}
    >
      {showToTasteChip ? (
        <Chip
          variant="outlined"
          label="to taste"
          aria-label={`${name} is to taste - set an amount`}
          data-field="amount"
          disabled={disabled}
          onClick={() => {
            focusAmountWhenShown.current = true;
            setEditing(true);
          }}
          sx={{ gridColumn: '1 / 3', gridRow: 1, justifySelf: 'start' }}
        />
      ) : (
        <>
          <TextField
            size="small"
            hiddenLabel
            fullWidth
            value={row.amount}
            onChange={(event) => onChange(row.id, { amount: event.target.value })}
            onKeyDown={handleAmountKeyDown}
            error={Boolean(amountError)}
            disabled={disabled}
            placeholder="e.g. 2, 1/2, 1.5"
            inputRef={setAmountInput}
            sx={{ gridArea: 'amount' }}
            slotProps={{
              htmlInput: {
                'aria-label': `Amount for ingredient ${position}`,
                'aria-describedby': describedBy,
                'data-field': 'amount',
                inputMode: 'decimal',
                maxLength: RECIPE_LIMITS.amount,
                enterKeyHint: 'next',
                autoCapitalize: 'none',
                autoComplete: 'off',
              },
            }}
          />
          <Autocomplete<string, false, true, false>
            // The list is closed and has no clear button; an unset unit is null at runtime
            value={row.unit || (null as unknown as string)}
            onChange={handleUnitChange}
            inputValue={unitText}
            onInputChange={handleUnitInputChange}
            onKeyDown={handleUnitKeyDown}
            options={unitOptions}
            filterOptions={(options, state) => filterUnitOptions(options, state.inputValue)}
            renderOption={(props, option) => {
              const { key, ...optionProps } = props as HTMLAttributes<HTMLLIElement> & {
                key: Key;
              };
              return (
                <li key={key} {...optionProps}>
                  {unitOptionText(option)}
                </li>
              );
            }}
            // Tabbing through an untouched unit must not pick the first one, so the first
            // match is only highlighted (and auto-selected on Tab) once something was typed
            autoHighlight={unitText.trim() !== ''}
            autoSelect
            openOnFocus
            disableClearable
            forcePopupIcon={false}
            size="small"
            disabled={disabled}
            sx={{ gridArea: 'unit', minWidth: 0 }}
            renderInput={(params) => (
              <TextField
                {...params}
                hiddenLabel
                error={Boolean(unitError)}
                placeholder="unit"
                inputRef={registerUnit}
                slotProps={{
                  input: params.InputProps,
                  htmlInput: {
                    ...params.inputProps,
                    'aria-label': `Unit for ingredient ${position}`,
                    'aria-describedby': describedBy,
                    'data-field': 'unit',
                    inputMode: coarsePointer ? 'none' : undefined,
                    enterKeyHint: 'next',
                    autoCapitalize: 'none',
                  },
                }}
              />
            )}
          />
        </>
      )}

      <TextField
        size="small"
        hiddenLabel
        fullWidth
        value={row.name}
        onChange={(event) => onChange(row.id, { name: event.target.value })}
        onKeyDown={handleNameKeyDown}
        error={Boolean(nameError)}
        disabled={disabled}
        placeholder="e.g. flour"
        inputRef={setNameInput}
        sx={{ gridArea: 'name' }}
        slotProps={{
          htmlInput: {
            'aria-label': `Name of ingredient ${position}`,
            'aria-describedby': describedBy,
            'data-field': 'name',
            maxLength: RECIPE_LIMITS.name,
            enterKeyHint: 'next',
            autoCapitalize: 'none',
            autoComplete: 'off',
          },
        }}
      />

      {removable && (
        <IconButton
          type="button"
          aria-label={
            name ? `Remove ingredient ${position}: ${name}` : `Remove ingredient ${position}`
          }
          data-field="remove"
          disabled={disabled}
          onClick={() => onRemove(row.id)}
          sx={{
            gridArea: 'remove',
            color: 'text.disabled',
            '&:hover, &:focus-visible': { color: 'error.main' },
          }}
        >
          <Close />
        </IconButton>
      )}

      {helper && (
        <FormHelperText id={helperId} error={Boolean(rowError)} sx={{ gridColumn: '1 / -1', m: 0 }}>
          {helper}
        </FormHelperText>
      )}
    </Box>
  );
}

export default memo(IngredientRow);
