import { text } from '@/i18n/text';
import { RECIPE_LIMITS, UNIT_TO_TASTE } from '@/lib/constants';
import { isCloudinaryUrl } from '@/lib/utils/cloudinary';
import {
  isBlankIngredientRow,
  isBlankStepRow,
  normaliseIngredientRow,
  trimTrailingBlankRows,
} from './formValues';
import {
  NumericFieldValue,
  RECIPE_FORM_SECTIONS,
  RecipeFieldPath,
  RecipeFormSection,
  RecipeFormValuesInput,
  RecipeIssue,
} from './types';
import type { TextDescriptor } from '@/i18n/text';

/**
 * ONE rule set for Create and Edit. It mirrors the server (the zod schemas in
 * src/app/api/recipes/route.ts and RecipeService.validateRecipeData) and agrees with
 * toPayload about what is ignored: blank ingredient rows and TRAILING blank steps carry
 * nothing the author typed, everything else either is sent or is a named error here.
 *
 * It has no locale, so it names messages instead of writing them: every issue carries the
 * descriptors of src/i18n/text.ts and the component renders them (docs/I18N.md).
 */

const DIFFICULTIES = ['easy', 'medium', 'hard'];

const SECTION_BY_FIELD: Record<string, RecipeFormSection> = {
  title: 'basics',
  prepTime: 'basics',
  cookingTime: 'basics',
  servings: 'basics',
  difficulty: 'basics',
  ingredients: 'ingredients',
  steps: 'steps',
  imageUrl: 'presentation',
  description: 'presentation',
  caption: 'presentation',
};

/** The section a path belongs to; unknown paths fall back to the first section */
export function sectionOfPath(path: RecipeFieldPath): RecipeFormSection {
  return SECTION_BY_FIELD[path.split('.')[0]] ?? RECIPE_FORM_SECTIONS[0];
}

/** True when `path` is `scope` itself or lives under it ('steps.a.description' under 'steps.a') */
export const isPathWithin = (path: RecipeFieldPath, scope: RecipeFieldPath): boolean =>
  path === scope || path.startsWith(`${scope}.`);

const isWholeNumberBetween = (value: NumericFieldValue, min: number, max: number): boolean =>
  typeof value === 'number' && Number.isInteger(value) && value >= min && value <= max;

export function validateRecipe(values: RecipeFormValuesInput): RecipeIssue[] {
  const issues: RecipeIssue[] = [];
  const add = (path: RecipeFieldPath, label: TextDescriptor, message: TextDescriptor) =>
    issues.push({ path, section: sectionOfPath(path), label, message });

  // Basics: title + at a glance
  if (values.title.trim() === '') {
    add('title', text('recipeForm.fields.title'), text('recipeForm.issues.titleRequired'));
  } else if (values.title.trim().length > RECIPE_LIMITS.title) {
    add(
      'title',
      text('recipeForm.fields.title'),
      text('recipeForm.issues.titleTooLong', { max: RECIPE_LIMITS.title })
    );
  }

  const { prep, cook, servings } = RECIPE_LIMITS;
  if (!isWholeNumberBetween(values.prepTime, prep.min, prep.max)) {
    add(
      'prepTime',
      text('recipeForm.fields.prepTime'),
      text('recipeForm.issues.prepTimeRange', { min: prep.min, max: prep.max })
    );
  }
  if (!isWholeNumberBetween(values.cookingTime, cook.min, cook.max)) {
    add(
      'cookingTime',
      text('recipeForm.fields.cookTime'),
      text('recipeForm.issues.cookTimeRange', { min: cook.min, max: cook.max })
    );
  }
  if (!isWholeNumberBetween(values.servings, servings.min, servings.max)) {
    add(
      'servings',
      text('recipeForm.fields.servings'),
      text('recipeForm.issues.servingsRange', { min: servings.min, max: servings.max })
    );
  }
  if (!DIFFICULTIES.includes(values.difficulty)) {
    add(
      'difficulty',
      text('recipeForm.fields.difficulty'),
      text('recipeForm.issues.difficultyRequired')
    );
  }

  // Ingredients: blank rows are ignored wherever they are
  const filledIngredients = values.ingredients.filter((row) => !isBlankIngredientRow(row));
  if (filledIngredients.length === 0) {
    add(
      'ingredients',
      text('recipeForm.fields.ingredients'),
      text('recipeForm.issues.ingredientsRequired')
    );
  } else if (filledIngredients.length > RECIPE_LIMITS.ingredients) {
    const extra = filledIngredients.length - RECIPE_LIMITS.ingredients;
    add(
      'ingredients',
      text('recipeForm.fields.ingredients'),
      text('recipeForm.issues.ingredientsTooMany', { max: RECIPE_LIMITS.ingredients, extra })
    );
  }
  values.ingredients.forEach((rawRow, index) => {
    if (isBlankIngredientRow(rawRow)) return;
    // Validate what toPayload will send (amount normalised, 'units' filled in)
    const row = normaliseIngredientRow(rawRow);
    const path = `ingredients.${row.id ?? index}`;
    const position = index + 1;
    const label = text('recipeForm.fields.ingredientAt', { position });
    const name = row.name.trim();
    // Messages name the ingredient when it has a name ('Flour: add an amount...') and fall
    // back to its position; the message picks the half with an ICU select
    const subject = { named: name === '' ? 'no' : 'yes', name, position };

    if (name === '') {
      add(`${path}.name`, label, text('recipeForm.issues.ingredientNameRequired', { position }));
    } else if (name.length > RECIPE_LIMITS.name) {
      add(
        `${path}.name`,
        label,
        text('recipeForm.issues.ingredientNameTooLong', { position, max: RECIPE_LIMITS.name })
      );
    }
    if (row.amount === '' && row.unit !== '' && row.unit !== UNIT_TO_TASTE) {
      add(`${path}.amount`, label, text('recipeForm.issues.ingredientAmountRequired', subject));
    } else if (row.amount.length > RECIPE_LIMITS.amount) {
      add(
        `${path}.amount`,
        label,
        text('recipeForm.issues.ingredientAmountTooLong', {
          ...subject,
          max: RECIPE_LIMITS.amount,
        })
      );
    }
    if (row.unit.length > RECIPE_LIMITS.unit) {
      add(
        `${path}.unit`,
        label,
        text('recipeForm.issues.ingredientUnitTooLong', { ...subject, max: RECIPE_LIMITS.unit })
      );
    }
  });

  // Steps: only TRAILING blank rows are ignored, the numbering of the rest matters
  const steps = trimTrailingBlankRows(values.steps, isBlankStepRow);
  if (steps.length === 0) {
    add('steps', text('recipeForm.fields.steps'), text('recipeForm.issues.stepsRequired'));
  } else if (steps.length > RECIPE_LIMITS.steps) {
    const extra = steps.length - RECIPE_LIMITS.steps;
    add(
      'steps',
      text('recipeForm.fields.steps'),
      text('recipeForm.issues.stepsTooMany', { max: RECIPE_LIMITS.steps, extra })
    );
  }
  steps.forEach((row, index) => {
    const path = `steps.${row.id ?? index}`;
    const position = index + 1;
    const label = text('recipeForm.fields.stepAt', { position });

    if (row.description.trim() === '') {
      add(
        `${path}.description`,
        label,
        row.image === ''
          ? text('recipeForm.issues.stepEmpty', { position })
          : text('recipeForm.issues.stepPhotoWithoutText', { position })
      );
    } else if (row.description.trim().length > RECIPE_LIMITS.stepText) {
      add(
        `${path}.description`,
        label,
        text('recipeForm.issues.stepTooLong', { position, max: RECIPE_LIMITS.stepText })
      );
    }
    if (row.image !== '' && !isCloudinaryUrl(row.image)) {
      add(`${path}.image`, label, text('recipeForm.issues.stepImageInvalid', { position }));
    }
  });

  // Presentation: cover + description + closing note
  if (values.imageUrl.trim() === '') {
    add('imageUrl', text('recipeForm.fields.coverPhoto'), text('recipeForm.issues.coverRequired'));
  } else if (!isCloudinaryUrl(values.imageUrl)) {
    add('imageUrl', text('recipeForm.fields.coverPhoto'), text('recipeForm.issues.coverInvalid'));
  }
  if (values.description.trim() === '') {
    add(
      'description',
      text('recipeForm.fields.description'),
      text('recipeForm.issues.descriptionRequired')
    );
  } else if (values.description.trim().length > RECIPE_LIMITS.description) {
    add(
      'description',
      text('recipeForm.fields.description'),
      text('recipeForm.issues.descriptionTooLong', { max: RECIPE_LIMITS.description })
    );
  }
  if (values.caption.trim().length > RECIPE_LIMITS.caption) {
    add(
      'caption',
      text('recipeForm.fields.closingNote'),
      text('recipeForm.issues.captionTooLong', { max: RECIPE_LIMITS.caption })
    );
  }

  return issues;
}
