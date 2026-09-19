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

/**
 * ONE rule set for Create and Edit. It mirrors the server (the zod schemas in
 * src/app/api/recipes/route.ts and RecipeService.validateRecipeData) and agrees with
 * toPayload about what is ignored: blank ingredient rows and TRAILING blank steps carry
 * nothing the author typed, everything else either is sent or is a named error here.
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
  const add = (path: RecipeFieldPath, label: string, message: string) =>
    issues.push({ path, section: sectionOfPath(path), label, message });

  // Basics: title + at a glance
  if (values.title.trim() === '') {
    add('title', 'title', 'Add a title');
  } else if (values.title.trim().length > RECIPE_LIMITS.title) {
    add('title', 'title', `Title: ${RECIPE_LIMITS.title} characters at most`);
  }

  const { prep, cook, servings } = RECIPE_LIMITS;
  if (!isWholeNumberBetween(values.prepTime, prep.min, prep.max)) {
    add('prepTime', 'prep time', `Prep time: whole minutes between ${prep.min} and ${prep.max}`);
  }
  if (!isWholeNumberBetween(values.cookingTime, cook.min, cook.max)) {
    add('cookingTime', 'cook time', `Cook time: whole minutes between ${cook.min} and ${cook.max}`);
  }
  if (!isWholeNumberBetween(values.servings, servings.min, servings.max)) {
    add(
      'servings',
      'servings',
      `Servings: a whole number between ${servings.min} and ${servings.max}`
    );
  }
  if (!DIFFICULTIES.includes(values.difficulty)) {
    add('difficulty', 'difficulty', 'Difficulty: choose Easy, Medium or Hard');
  }

  // Ingredients: blank rows are ignored wherever they are
  const filledIngredients = values.ingredients.filter((row) => !isBlankIngredientRow(row));
  if (filledIngredients.length === 0) {
    add('ingredients', 'ingredients', 'Add at least one ingredient');
  } else if (filledIngredients.length > RECIPE_LIMITS.ingredients) {
    const extra = filledIngredients.length - RECIPE_LIMITS.ingredients;
    add(
      'ingredients',
      'ingredients',
      `A recipe can have ${RECIPE_LIMITS.ingredients} ingredients at most - remove ${extra}`
    );
  }
  values.ingredients.forEach((rawRow, index) => {
    if (isBlankIngredientRow(rawRow)) return;
    // Validate what toPayload will send (amount normalised, 'units' filled in)
    const row = normaliseIngredientRow(rawRow);
    const path = `ingredients.${row.id ?? index}`;
    const position = `Ingredient ${index + 1}`;
    const label = `ingredient ${index + 1}`;
    const name = row.name.trim();
    // Messages name the ingredient when it has a name: 'Flour: add an amount...'
    const subject = name || position;

    if (name === '') {
      add(`${path}.name`, label, `${position}: add a name, or clear the row`);
    } else if (name.length > RECIPE_LIMITS.name) {
      add(
        `${path}.name`,
        label,
        `${position}: the name is ${RECIPE_LIMITS.name} characters at most`
      );
    }
    if (row.amount === '' && row.unit !== '' && row.unit !== UNIT_TO_TASTE) {
      add(`${path}.amount`, label, `${subject}: add an amount, or clear the unit for to taste`);
    } else if (row.amount.length > RECIPE_LIMITS.amount) {
      add(
        `${path}.amount`,
        label,
        `${subject}: the amount is ${RECIPE_LIMITS.amount} characters at most`
      );
    }
    if (row.unit.length > RECIPE_LIMITS.unit) {
      add(
        `${path}.unit`,
        label,
        `${subject}: the unit is ${RECIPE_LIMITS.unit} characters at most`
      );
    }
  });

  // Steps: only TRAILING blank rows are ignored, the numbering of the rest matters
  const steps = trimTrailingBlankRows(values.steps, isBlankStepRow);
  if (steps.length === 0) {
    add('steps', 'steps', 'Add at least one step');
  } else if (steps.length > RECIPE_LIMITS.steps) {
    const extra = steps.length - RECIPE_LIMITS.steps;
    add(
      'steps',
      'steps',
      `A recipe can have ${RECIPE_LIMITS.steps} steps at most - remove ${extra}`
    );
  }
  steps.forEach((row, index) => {
    const path = `steps.${row.id ?? index}`;
    const position = `Step ${index + 1}`;
    const label = `step ${index + 1}`;

    if (row.description.trim() === '') {
      add(
        `${path}.description`,
        label,
        row.image === ''
          ? `${position} is empty - write it or remove it`
          : `${position} has a photo but no text - describe it or remove the step`
      );
    } else if (row.description.trim().length > RECIPE_LIMITS.stepText) {
      add(
        `${path}.description`,
        label,
        `${position}: ${RECIPE_LIMITS.stepText} characters at most`
      );
    }
    if (row.image !== '' && !isCloudinaryUrl(row.image)) {
      add(`${path}.image`, label, `${position}: upload the photo again`);
    }
  });

  // Presentation: cover + description + closing note
  if (values.imageUrl.trim() === '') {
    add('imageUrl', 'cover photo', 'Add a cover photo (JPG, PNG, WebP or GIF)');
  } else if (!isCloudinaryUrl(values.imageUrl)) {
    add('imageUrl', 'cover photo', 'Cover photo: upload it again (JPG, PNG, WebP or GIF)');
  }
  if (values.description.trim() === '') {
    add('description', 'description', 'Add a short description');
  } else if (values.description.trim().length > RECIPE_LIMITS.description) {
    add(
      'description',
      'description',
      `Description: ${RECIPE_LIMITS.description} characters at most`
    );
  }
  if (values.caption.trim().length > RECIPE_LIMITS.caption) {
    add('caption', 'closing note', `Closing note: ${RECIPE_LIMITS.caption} characters at most`);
  }

  return issues;
}
