'use client';
import { Box, TextField, Typography } from '@mui/material';
import React, { useEffect, useId, useRef } from 'react';
import { INGREDIENTS_CAPPED_MESSAGE, STEPS_CAPPED_MESSAGE } from '@/lib/utils/recipeText';
import EditorLiveRegion, { useAnnouncer } from './EditorLiveRegion';
import { formSpacing } from './formTokens';
import ParsedIngredientsReadout, { ingredientsSummary } from './ParsedIngredientsReadout';
import ParsedStepsReadout, { stepsSummary } from './ParsedStepsReadout';
import SectionHeading from './SectionHeading';
import TitleField from './TitleField';
import { RegisterField } from './useFieldRegistry';
import type { RecipeFormApi } from './useRecipeForm';
import type { TextCaptureApi } from './useTextCapture';

/** The readout summary reaches the live region once typing pauses, not on every keystroke */
export const READOUT_ANNOUNCE_MS = 700;

// The content language of the authors, on purpose, inside English chrome
const INGREDIENTS_EXAMPLE = '500 g harina\n2 huevos\n1 cdta sal\npimienta a gusto';
const METHOD_EXAMPLE = 'Mezclar la harina con los huevos.\n\nAmasar 10 minutos y dejar descansar.';

// Six lines from sm; MUI's autosize owns the height, so the floor is a min-height in CSS
const SIX_LINES = 'calc(6 * 1.4375em)';

const visuallyHiddenSx = {
  position: 'absolute',
  width: '1px',
  height: '1px',
  m: '-1px',
  p: 0,
  overflow: 'hidden',
  clip: 'rect(0 0 0 0)',
  whiteSpace: 'nowrap',
} as const;

export interface WriteTabProps {
  form: RecipeFormApi;
  capture: TextCaptureApi;
  registerField?: RegisterField;
  /** A submit is in flight */
  disabled?: boolean;
  /** The panel's heading: the shell focuses it after a tab change */
  headingRef?: React.Ref<HTMLHeadingElement>;
  /** A row the parser was unsure about was activated in the readout */
  onCheckRow: (rowId: string) => void;
  /**
   * The editor just opened: the title may take the focus (fine pointers only). After a tab
   * change the focus belongs to the heading, so the shell passes false. Default true
   */
  autoFocusTitle?: boolean;
}

/**
 * The whole capture on one screen: a title and two text boxes, written the way a note or a
 * chat message is written. Enter is a newline in both boxes and never submits. Under each
 * box a quiet readout says what Remy understood; nothing is guessed silently and nothing
 * blocks.
 */
export default function WriteTab({
  form,
  capture,
  registerField,
  disabled = false,
  headingRef,
  onCheckRow,
  autoFocusTitle = true,
}: WriteTabProps) {
  const ingredientsId = useId();
  const methodId = useId();
  const { message, announce } = useAnnouncer();

  const ingredients = ingredientsSummary(form.values.ingredients, capture.checkCount);
  const steps = stepsSummary(form.values.steps);

  // Mirrors a summary into the live region after a pause; never when the tab just opened
  const announced = useRef({ ingredients, steps });
  useEffect(() => {
    const changes = [
      announced.current.ingredients === ingredients ? null : ingredients,
      announced.current.steps === steps ? null : steps,
    ].filter((summary): summary is string => summary !== null);
    if (changes.length === 0) return undefined;

    const timer = setTimeout(() => {
      announced.current = { ingredients, steps };
      announce(changes.join(', '));
    }, READOUT_ANNOUNCE_MS);
    return () => clearTimeout(timer);
  }, [ingredients, steps, announce]);

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: formSpacing.group }}>
      <SectionHeading ref={headingRef} component="h3" sx={visuallyHiddenSx}>
        Write
      </SectionHeading>

      <TitleField
        form={form}
        registerField={registerField}
        autoFocus={autoFocusTitle}
        disabled={disabled}
      />

      <Box>
        <Typography
          component="label"
          htmlFor={ingredientsId}
          variant="overline"
          color="text.secondary"
          sx={{ display: 'block', mb: formSpacing.label }}
        >
          Ingredients
        </Typography>
        <TextField
          id={ingredientsId}
          multiline
          fullWidth
          hiddenLabel
          minRows={5}
          maxRows={16}
          value={capture.ingredientsText}
          onChange={(event) => capture.setIngredientsText(event.target.value)}
          placeholder={INGREDIENTS_EXAMPLE}
          helperText={
            capture.ingredientsCapped
              ? `One per line. ${INGREDIENTS_CAPPED_MESSAGE}`
              : 'One per line'
          }
          disabled={disabled}
          // Not the hidden twin MUI measures with: a floor on it would inflate every row
          sx={{ '& textarea:not([aria-hidden])': { minHeight: { sm: SIX_LINES } } }}
          slotProps={{ htmlInput: { autoCapitalize: 'none', spellCheck: false } }}
        />
        <Box sx={{ mt: formSpacing.label }}>
          <ParsedIngredientsReadout
            rows={form.values.ingredients}
            checks={capture.checks}
            onCheckRow={onCheckRow}
          />
        </Box>
      </Box>

      <Box>
        <Typography
          component="label"
          htmlFor={methodId}
          variant="overline"
          color="text.secondary"
          sx={{ display: 'block', mb: formSpacing.label }}
        >
          Method
        </Typography>
        <TextField
          id={methodId}
          multiline
          fullWidth
          hiddenLabel
          minRows={8}
          maxRows={24}
          value={capture.methodText}
          onChange={(event) => capture.setMethodText(event.target.value)}
          placeholder={METHOD_EXAMPLE}
          helperText={
            capture.stepsCapped
              ? `One step per paragraph - numbers are optional. ${STEPS_CAPPED_MESSAGE}`
              : 'One step per paragraph - numbers are optional'
          }
          disabled={disabled}
          slotProps={{ htmlInput: { autoCapitalize: 'sentences' } }}
        />
        <Box sx={{ mt: formSpacing.label }}>
          <ParsedStepsReadout rows={form.values.steps} />
        </Box>
      </Box>

      <Typography variant="caption" color="text.secondary">
        Photos, times and servings are on the next tab. You can also add rows there instead of
        writing here - both tabs edit the same recipe.
      </Typography>

      <EditorLiveRegion message={message} />
    </Box>
  );
}
