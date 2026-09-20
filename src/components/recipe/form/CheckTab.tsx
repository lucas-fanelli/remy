'use client';
import { Box } from '@mui/material';
import React, { useId, useMemo } from 'react';
import AtAGlance from './AtAGlance';
import { formSpacing } from './formTokens';
import IngredientListEditor from './IngredientListEditor';
import PresentationFields from './PresentationFields';
import SectionHeading from './SectionHeading';
import StepListEditor from './StepListEditor';
import { RegisterField } from './useFieldRegistry';
import type { IngredientPatch, RecipeFormApi } from './useRecipeForm';
import type { TextCaptureApi } from './useTextCapture';
import type { ImageUploadHandle } from '@/components/common/ImageUpload';

export interface CheckTabProps {
  form: RecipeFormApi;
  capture: Pick<TextCaptureApi, 'checks' | 'confirmRow'>;
  registerField?: RegisterField;
  /** A submit is in flight */
  disabled?: boolean;
  /** The first heading of the panel: the shell focuses it after a tab change */
  headingRef?: React.Ref<HTMLHeadingElement>;
  /** Kept by the shell so a cover upload can be cancelled after this tab unmounted */
  coverHandleRef?: React.MutableRefObject<ImageUploadHandle | null>;
  /** The stored cover does not load (a restored draft whose asset is gone) */
  onCoverBrokenChange?: (broken: boolean) => void;
}

const sectionSx = { display: 'flex', flexDirection: 'column', gap: formSpacing.field } as const;

/**
 * The recipe as structured, editable sections in one scroll: the shared row editors, at a
 * glance and the presentation fields. Rows the parser was unsure about carry an attention
 * note - never an error, never blocking - that goes away with the first edit of that row.
 */
export default function CheckTab({
  form,
  capture,
  registerField,
  disabled = false,
  headingRef,
  coverHandleRef,
  onCoverBrokenChange,
}: CheckTabProps) {
  const ingredientsId = useId();
  const stepsId = useId();
  const { ingredients } = form;
  const { confirmRow } = capture;

  // An edit makes the row the author's own: it is no longer the parser's guess
  const confirmingIngredients = useMemo(
    () => ({
      ...ingredients,
      update: (id: string, patch: IngredientPatch) => {
        confirmRow(id);
        ingredients.update(id, patch);
      },
    }),
    [ingredients, confirmRow]
  );

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: formSpacing.group }}>
      <Box component="section" sx={sectionSx}>
        <SectionHeading ref={headingRef} id={ingredientsId} component="h3">
          Ingredients
        </SectionHeading>
        <IngredientListEditor
          form={{
            values: form.values,
            errors: form.errors,
            touch: form.touch,
            ingredients: confirmingIngredients,
          }}
          registerField={registerField}
          labelledBy={ingredientsId}
          rowNotes={capture.checks}
          disabled={disabled}
        />
      </Box>

      <Box component="section" sx={sectionSx}>
        <SectionHeading id={stepsId} component="h3">
          Steps
        </SectionHeading>
        <StepListEditor
          form={form}
          registerField={registerField}
          labelledBy={stepsId}
          disabled={disabled}
        />
      </Box>

      <Box component="section" sx={sectionSx}>
        <SectionHeading component="h3">At a glance</SectionHeading>
        <AtAGlance form={form} registerField={registerField} disabled={disabled} />
      </Box>

      <Box component="section" sx={sectionSx}>
        <SectionHeading component="h3">Photo &amp; description</SectionHeading>
        <PresentationFields
          form={form}
          registerField={registerField}
          coverHandleRef={coverHandleRef}
          onCoverBrokenChange={onCoverBrokenChange}
          disabled={disabled}
        />
      </Box>
    </Box>
  );
}
