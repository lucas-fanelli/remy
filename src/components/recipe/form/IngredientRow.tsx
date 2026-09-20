'use client';
import { Close, WarningAmber } from '@mui/icons-material';
import { Autocomplete, Box, Chip, FormHelperText, IconButton, TextField } from '@mui/material';
import { useTranslations } from 'next-intl';
import { memo, useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import { useUnitLabels } from '@/i18n/units';
import {
  RECIPE_LIMITS,
  RECIPE_UNITS,
  RECIPE_UNIT_LABELS,
  RecipeUnit,
  UNIT_TO_TASTE,
} from '@/lib/constants';
import { fieldHelper, useOptionalText } from './fieldHelper';
import { attentionColor, getFieldCounter } from './formTokens';
import { isBlankIngredientRow, isToTasteRow } from './formValues';
import { focusNextField, isBackspaceOnEmpty, isPlainEnter } from './keyboard';
import { IngredientRowValue } from './types';
import { RegisterField, useFieldRef } from './useFieldRegistry';
import { IngredientPatch } from './useRecipeForm';
import { useRowIdRef } from './useRowFocus';
import type { TextDescriptor } from '@/i18n/text';
import type { FocusEvent, HTMLAttributes, Key, KeyboardEvent, SyntheticEvent } from 'react';

export interface IngredientRowProps {
  row: IngredientRowValue;
  /** Zero-based position in the list: names the controls ('Amount for ingredient 2') */
  index: number;
  /** Visible errors of this row: `errors['ingredients.<id>.amount']` and so on */
  amountError?: TextDescriptor;
  unitError?: TextDescriptor;
  nameError?: TextDescriptor;
  /**
   * A non-blocking 'look here' line (attention bar + icon + text) shown while the row has no
   * error: what a text parser was unsure about. Never an error, never colour alone.
   */
  note?: TextDescriptor;
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

/** The stored value never changes language; only its long name does */
const englishUnitName = (unit: string): string => RECIPE_UNIT_LABELS[unit as RecipeUnit] ?? '';

/** The picker names a unit in the plural ('cups', not 'cup'): it is a list, not an amount */
const PICKER_COUNT = 2;

/**
 * Typing 'g' + Tab must pick grams, not the first unit that merely contains a 'g': exact
 * unit first, then units and expanded names that START with the text, then the rest.
 *
 * The author never reads the stored value: `labelOf` is what the field and the head of
 * each option show ('cda', 'tazas') and `nameOf` the long name next to it ('cucharadas'),
 * so typing either finds the unit while the stored value stays 'tbsp' / 'cups'. Both
 * default to English, where the label IS the stored value.
 */
export function filterUnitOptions(
  options: string[],
  inputValue: string,
  nameOf: (unit: string) => string = englishUnitName,
  labelOf: (unit: string) => string = (unit) => unit
): string[] {
  const query = inputValue.trim().toLowerCase();
  if (query === '') return options;

  const rank = (unit: string): number => {
    const short = unit.toLowerCase();
    const label = labelOf(unit).toLowerCase();
    const long = nameOf(unit).toLowerCase();
    if (short === query || label === query) return 0;
    if (short.startsWith(query) || label.startsWith(query)) return 1;
    if (long.startsWith(query)) return 2;
    return short.includes(query) || label.includes(query) || long.includes(query) ? 3 : -1;
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
  note,
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
  const t = useTranslations('recipeForm');
  const tUnits = useTranslations('units');
  const showText = useOptionalText();
  const units = useUnitLabels();
  /** What the field and the list show. The stored value ('cups') never reaches the author */
  const unitLabel = (unit: string): string => units.label(unit, PICKER_COUNT);
  /**
   * 'g - grams', but just 'cups' where the long name adds nothing to the label.
   * `units.option()` would name the unit in the singular ('unit - whole items'), so the
   * shared message is formatted here with the plural label a list wants.
   */
  const unitOptionText = (unit: string): string => {
    const label = unitLabel(unit);
    const name = units.name(unit);
    return name === label || name === units.label(unit) ? label : tUnits('option', { label, name });
  };
  const position = index + 1;
  const path = `ingredients.${row.id}`;
  const helperId = useId();
  const rowRef = useRowIdRef(row.id);

  // While focus is in the row the author edits plain inputs; at rest a named row without
  // amount and unit shows ONE 'to taste' chip in their place (Pantry's model)
  const [editing, setEditing] = useState(false);
  const [unitText, setUnitText] = useState(() => unitLabel(row.unit));
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
  const helper = fieldHelper(
    showText(rowError),
    getFieldCounter(row.name.length, RECIPE_LIMITS.name)
  );
  // An error outranks the note: one helper line, one bar
  const attention = rowError ? undefined : showText(note);
  const describedBy = helper || attention ? helperId : undefined;

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
    // The option IS the stored value - only its label was translated - so what the row
    // reports, and what ends up in the database, stays English
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
      aria-label={t('ingredients.rowLabel', { position })}
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
        borderLeftColor: rowError ? 'error.main' : attention ? attentionColor : 'transparent',
      }}
    >
      {showToTasteChip ? (
        <Chip
          variant="outlined"
          label={units.label(UNIT_TO_TASTE)}
          aria-label={t('ingredients.toTasteChip', { name })}
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
            placeholder={t('ingredients.amountPlaceholder')}
            inputRef={setAmountInput}
            sx={{ gridArea: 'amount' }}
            slotProps={{
              htmlInput: {
                'aria-label': t('ingredients.amountLabel', { position }),
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
            getOptionLabel={unitLabel}
            filterOptions={(options, state) =>
              filterUnitOptions(options, state.inputValue, units.name, unitLabel)
            }
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
                placeholder={t('ingredients.unitPlaceholder')}
                inputRef={registerUnit}
                slotProps={{
                  input: params.InputProps,
                  htmlInput: {
                    ...params.inputProps,
                    'aria-label': t('ingredients.unitLabel', { position }),
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
        placeholder={t('ingredients.namePlaceholder')}
        inputRef={setNameInput}
        sx={{ gridArea: 'name' }}
        slotProps={{
          htmlInput: {
            'aria-label': t('ingredients.nameLabel', { position }),
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
          aria-label={t('ingredients.remove', {
            named: name ? 'yes' : 'no',
            position,
            name,
          })}
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

      {(helper || attention) && (
        <FormHelperText id={helperId} error={Boolean(rowError)} sx={{ gridColumn: '1 / -1', m: 0 }}>
          {attention && (
            <Box component="span" sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              <WarningAmber fontSize="small" sx={{ color: attentionColor }} />
              <Box component="span" sx={{ color: 'text.secondary' }}>
                {attention}
              </Box>
            </Box>
          )}
          {helper}
        </FormHelperText>
      )}
    </Box>
  );
}

export default memo(IngredientRow);
