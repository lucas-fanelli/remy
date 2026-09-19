'use client';
import { TextField } from '@mui/material';
import { useCallback, useEffect, useRef } from 'react';
import { RECIPE_LIMITS } from '@/lib/constants';
import { fieldHelper } from './fieldHelper';
import { getFieldCounter } from './formTokens';
import { focusNextField } from './keyboard';
import { RegisterField } from './useFieldRegistry';
import { RecipeFormApi } from './useRecipeForm';

export interface TitleFieldProps {
  /** The engine, or the slice of it this field reads */
  form: Pick<RecipeFormApi, 'values' | 'errors' | 'setField' | 'touch'>;
  /** Reports the input under the path 'title' (see useFieldRegistry) */
  registerField?: RegisterField;
  /** Focus on mount - on fine pointers only, so opening the form never pops a phone keyboard */
  autoFocus?: boolean;
  disabled?: boolean;
}

export default function TitleField({
  form,
  registerField,
  autoFocus = true,
  disabled = false,
}: TitleFieldProps) {
  const { values, errors, setField, touch } = form;
  const inputRef = useRef<HTMLInputElement | null>(null);
  const autoFocusOnMount = useRef(autoFocus);

  const setInput = useCallback(
    (element: HTMLInputElement | null) => {
      inputRef.current = element;
      registerField?.('title', element);
    },
    [registerField]
  );

  // Checked in the mount effect, not with a media-query flag that flips after hydration.
  // Optional call: jsdom (and very old browsers) have no matchMedia.
  useEffect(() => {
    if (!autoFocusOnMount.current) return;
    if (window.matchMedia?.('(pointer: fine)').matches) inputRef.current?.focus();
  }, []);

  return (
    <TextField
      label="Title"
      required
      fullWidth
      value={values.title}
      onChange={(event) => setField('title', event.target.value)}
      onBlur={() => touch('title')}
      onKeyDown={focusNextField}
      error={Boolean(errors.title)}
      helperText={fieldHelper(
        errors.title,
        getFieldCounter(values.title.length, RECIPE_LIMITS.title)
      )}
      placeholder="e.g. Empanadas de carne"
      disabled={disabled}
      inputRef={setInput}
      slotProps={{
        htmlInput: {
          maxLength: RECIPE_LIMITS.title,
          autoCapitalize: 'sentences',
          enterKeyHint: 'next',
        },
      }}
    />
  );
}
