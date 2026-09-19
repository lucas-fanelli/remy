'use client';
import { Add, Remove } from '@mui/icons-material';
import {
  Box,
  Chip,
  FormHelperText,
  IconButton,
  InputAdornment,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from '@mui/material';
import { alpha, type Theme } from '@mui/material/styles';
import { useId } from 'react';
import { DifficultyLevel } from '@/domain/types/recipe';
import { RECIPE_LIMITS } from '@/lib/constants';
import { getDifficultyColor } from '@/lib/utils/recipe';
import { formSpacing } from './formTokens';
import { focusNextField } from './keyboard';
import { NumericFieldValue } from './types';
import { RegisterField, useFieldRef } from './useFieldRegistry';
import { RecipeFormApi } from './useRecipeForm';
import type { KeyboardEvent } from 'react';

export interface AtAGlanceProps {
  /** The engine, or the slice of it this block reads */
  form: Pick<RecipeFormApi, 'values' | 'errors' | 'setField' | 'touch'>;
  /** Reports 'prepTime', 'cookingTime', 'servings' (inputs) and 'difficulty' (selected button) */
  registerField?: RegisterField;
  disabled?: boolean;
}

type TimePath = 'prepTime' | 'cookingTime';

/** Minutes offered as one-tap chips; 0 reads 'None'. No time is ever preselected */
const PREP_PICKS = [0, 5, 10, 15, 20, 30];
const COOK_PICKS = [10, 15, 20, 30, 45, 60, 90];

const DIFFICULTIES: { value: DifficultyLevel; label: string }[] = [
  { value: 'easy', label: 'Easy' },
  { value: 'medium', label: 'Medium' },
  { value: 'hard', label: 'Hard' },
];

/** Digits only, three at most: what the numeric fields accept */
const toWholeNumber = (raw: string): NumericFieldValue => {
  const digits = raw.replace(/\D/g, '').slice(0, 3);
  return digits === '' ? '' : Number(digits);
};

const clampServings = (value: number): number =>
  Math.min(RECIPE_LIMITS.servings.max, Math.max(RECIPE_LIMITS.servings.min, value));

const numericInputProps = {
  inputMode: 'numeric',
  pattern: '[0-9]*',
  maxLength: 3,
  enterKeyHint: 'next',
  autoComplete: 'off',
} as const;

/**
 * The selected segment is TINTED with the difficulty colour, never filled with it: text
 * stays text.primary, and a border plus the bold label carry the selection without colour.
 */
const difficultySx = (value: DifficultyLevel) => {
  // A DifficultyLevel always maps to a palette colour; 'default' is for unknown strings
  const tone = getDifficultyColor(value) as 'success' | 'warning' | 'error';
  return {
    textTransform: 'none',
    '&&.Mui-selected': {
      color: 'text.primary',
      fontWeight: 700,
      borderColor: `${tone}.main`,
      bgcolor: (theme: Theme) => alpha(theme.palette[tone].main, 0.16),
      '&:hover': { bgcolor: (theme: Theme) => alpha(theme.palette[tone].main, 0.24) },
    },
  };
};

interface TimeCellProps {
  path: TimePath;
  label: string;
  picks: number[];
  value: NumericFieldValue;
  error?: string;
  disabled: boolean;
  inputRef: (element: HTMLInputElement | null) => void;
  onChange: (path: TimePath, value: NumericFieldValue) => void;
  onBlur: (path: TimePath) => void;
}

/** A minutes field plus its quick picks: completable by tapping, editable by typing */
function TimeCell({
  path,
  label,
  picks,
  value,
  error,
  disabled,
  inputRef,
  onChange,
  onBlur,
}: TimeCellProps) {
  const noun = label.toLowerCase();

  return (
    // minWidth 0 lets the xs chip row scroll inside the cell instead of widening the grid
    <Box sx={{ minWidth: 0 }}>
      <TextField
        label={label}
        required
        fullWidth
        type="text"
        value={value === '' ? '' : String(value)}
        onChange={(event) => onChange(path, toWholeNumber(event.target.value))}
        onBlur={() => onBlur(path)}
        onKeyDown={focusNextField}
        error={Boolean(error)}
        helperText={error}
        disabled={disabled}
        inputRef={inputRef}
        slotProps={{
          htmlInput: numericInputProps,
          input: { endAdornment: <InputAdornment position="end">min</InputAdornment> },
        }}
      />
      <Box
        role="group"
        aria-label={`Quick pick ${noun}`}
        sx={{
          mt: formSpacing.label,
          display: 'flex',
          gap: 1,
          flexWrap: { xs: 'nowrap', sm: 'wrap' },
          overflowX: { xs: 'auto', sm: 'visible' },
          pb: { xs: 0.5 },
          scrollbarWidth: 'none',
          '&::-webkit-scrollbar': { display: 'none' },
        }}
      >
        {picks.map((minutes) => {
          const selected = value === minutes;
          return (
            <Chip
              key={minutes}
              label={minutes === 0 ? 'None' : minutes}
              aria-label={minutes === 0 ? `No ${noun}` : `${minutes} minutes`}
              aria-pressed={selected}
              color={selected ? 'primary' : 'default'}
              variant={selected ? 'filled' : 'outlined'}
              disabled={disabled}
              onClick={() => onChange(path, minutes)}
            />
          );
        })}
      </Box>
    </Box>
  );
}

/**
 * S5 - prep, cook, servings and difficulty, completable without a keyboard (chips, the
 * stepper, the toggle) and fully operable with one. Cell order is Prep, Cook, Servings,
 * Difficulty in Create and Edit.
 */
export default function AtAGlance({ form, registerField, disabled = false }: AtAGlanceProps) {
  const { values, errors, setField, touch } = form;
  const difficultyLabelId = useId();

  const prepRef = useFieldRef<HTMLInputElement>(registerField, 'prepTime');
  const cookRef = useFieldRef<HTMLInputElement>(registerField, 'cookingTime');
  const servingsRef = useFieldRef<HTMLInputElement>(registerField, 'servings');
  const difficultyRef = useFieldRef<HTMLButtonElement>(registerField, 'difficulty');

  const { prepTime, cookingTime, servings } = values;
  const hasTime = typeof prepTime === 'number' || typeof cookingTime === 'number';
  const totalMinutes = Number(prepTime) + Number(cookingTime);

  const stepServings = (delta: -1 | 1) => {
    // From an emptied field both buttons land on the minimum
    setField('servings', clampServings((typeof servings === 'number' ? servings : 0) + delta));
  };

  const handleServingsChange = (raw: string) => {
    const next = toWholeNumber(raw);
    setField('servings', next === '' ? '' : Math.min(next, RECIPE_LIMITS.servings.max));
  };

  const handleServingsBlur = () => {
    if (typeof servings === 'number') setField('servings', clampServings(servings));
    touch('servings');
  };

  // The handler sits on the field root, so it also hears the two stepper buttons. Enter on
  // a button is the button's own (focusNextField would cancel its activation)
  const handleServingsKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.target instanceof HTMLInputElement) focusNextField(event);
  };

  const atMinimum = typeof servings === 'number' && servings <= RECIPE_LIMITS.servings.min;
  const atMaximum = typeof servings === 'number' && servings >= RECIPE_LIMITS.servings.max;
  // aria-disabled, not disabled: a button that disables itself under the finger or the
  // keyboard drops focus to <body>
  const boundSx = { '&[aria-disabled="true"]': { color: 'action.disabled' } };

  return (
    <Box
      sx={{
        display: 'grid',
        gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' },
        columnGap: 2,
        rowGap: 2,
        alignItems: 'start',
      }}
    >
      <TimeCell
        path="prepTime"
        label="Prep time"
        picks={PREP_PICKS}
        value={prepTime}
        error={errors.prepTime}
        disabled={disabled}
        inputRef={prepRef}
        onChange={setField}
        onBlur={touch}
      />
      <TimeCell
        path="cookingTime"
        label="Cook time"
        picks={COOK_PICKS}
        value={cookingTime}
        error={errors.cookingTime}
        disabled={disabled}
        inputRef={cookRef}
        onChange={setField}
        onBlur={touch}
      />

      {hasTime && (
        <Typography
          variant="caption"
          color="text.secondary"
          sx={{ gridColumn: '1 / -1', textAlign: 'right' }}
        >
          Total {totalMinutes} min
        </Typography>
      )}

      <Box sx={{ minWidth: 0 }}>
        {/* Same height as the 'Difficulty' label next door, so the two 56px controls line up */}
        <Typography
          variant="overline"
          aria-hidden="true"
          sx={{ display: { xs: 'none', sm: 'block' }, visibility: 'hidden' }}
        >
          &nbsp;
        </Typography>
        <TextField
          label="Servings"
          required
          fullWidth
          type="text"
          value={servings === '' ? '' : String(servings)}
          onChange={(event) => handleServingsChange(event.target.value)}
          onBlur={handleServingsBlur}
          onKeyDown={handleServingsKeyDown}
          error={Boolean(errors.servings)}
          helperText={errors.servings}
          disabled={disabled}
          inputRef={servingsRef}
          sx={{ '& input': { textAlign: 'center' } }}
          slotProps={{
            htmlInput: numericInputProps,
            input: {
              startAdornment: (
                <InputAdornment position="start">
                  <IconButton
                    type="button"
                    edge="start"
                    aria-label="Fewer servings"
                    aria-disabled={atMinimum}
                    disabled={disabled}
                    onClick={() => stepServings(-1)}
                    sx={boundSx}
                  >
                    <Remove />
                  </IconButton>
                </InputAdornment>
              ),
              endAdornment: (
                <InputAdornment position="end">
                  <IconButton
                    type="button"
                    edge="end"
                    aria-label="More servings"
                    aria-disabled={atMaximum}
                    disabled={disabled}
                    onClick={() => stepServings(1)}
                    sx={boundSx}
                  >
                    <Add />
                  </IconButton>
                </InputAdornment>
              ),
            },
          }}
        />
      </Box>

      <Box sx={{ minWidth: 0 }}>
        <Typography
          id={difficultyLabelId}
          variant="overline"
          color="text.secondary"
          sx={{ display: 'block' }}
        >
          Difficulty
        </Typography>
        <ToggleButtonGroup
          exclusive
          fullWidth
          value={values.difficulty}
          // Clicking the selected segment reports null: a recipe always has a difficulty
          onChange={(_event, next: DifficultyLevel | null) => {
            if (next) setField('difficulty', next);
          }}
          aria-labelledby={difficultyLabelId}
          disabled={disabled}
          sx={{ height: 56 }}
        >
          {DIFFICULTIES.map(({ value, label }) => (
            <ToggleButton
              key={value}
              value={value}
              ref={value === values.difficulty ? difficultyRef : undefined}
              sx={difficultySx(value)}
            >
              {label}
            </ToggleButton>
          ))}
        </ToggleButtonGroup>
        {errors.difficulty && <FormHelperText error>{errors.difficulty}</FormHelperText>}
      </Box>
    </Box>
  );
}
