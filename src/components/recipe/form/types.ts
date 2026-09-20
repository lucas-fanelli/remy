import { DifficultyLevel, Ingredient, Instruction } from '@/domain/types/recipe';
import type { TextDescriptor } from '@/i18n/text';

/** The four sections of a recipe, in the author's order: what an issue or an [Edit] names */
export const RECIPE_FORM_SECTIONS = ['basics', 'ingredients', 'steps', 'presentation'] as const;

export type RecipeFormSection = (typeof RECIPE_FORM_SECTIONS)[number];

/** A whole number typed by the author, or '' while the field is still empty */
export type NumericFieldValue = number | '';

/** `id` is client-only: it keys the row in React and addresses it in every updater */
export interface IngredientRowValue {
  id: string;
  name: string;
  amount: string;
  unit: string;
}

/** `image` is '' while the step has no photo; the step number derives from the position */
export interface StepRowValue {
  id: string;
  description: string;
  image: string;
}

export interface RecipeFormValues {
  title: string;
  description: string;
  imageUrl: string;
  caption: string;
  prepTime: NumericFieldValue;
  cookingTime: NumericFieldValue;
  servings: NumericFieldValue;
  difficulty: DifficultyLevel;
  ingredients: IngredientRowValue[];
  steps: StepRowValue[];
}

/** Fields addressed by `setField`; rows go through the `ingredients` / `steps` APIs */
export type RecipeScalarField = Exclude<keyof RecipeFormValues, 'ingredients' | 'steps'>;

/** Rows handed to `replaceAll` / `load` may come without an id (drafts never store one) */
export type IngredientRowInput = Omit<IngredientRowValue, 'id'> & { id?: string };
export type StepRowInput = Omit<StepRowValue, 'id'> & { id?: string };

export type RecipeFormValuesInput = Omit<RecipeFormValues, 'ingredients' | 'steps'> & {
  ingredients: IngredientRowInput[];
  steps: StepRowInput[];
};

/**
 * Error paths. Scalars use their field name, lists use 'ingredients' / 'steps', rows use
 * 'ingredients.<rowId>' and row fields 'ingredients.<rowId>.name' (ids, never indexes, so
 * touched state and errors follow a row when it moves).
 */
export type RecipeFieldPath = string;

/**
 * validateRecipe has no locale and no hooks, so an issue carries DESCRIPTORS (see
 * src/i18n/text.ts) and the component that shows it renders them with useTextDescriptor().
 */
export interface RecipeIssue {
  path: RecipeFieldPath;
  section: RecipeFormSection;
  /** Names the field and the fix: 'Cook time: whole minutes between 1 and 720' */
  message: TextDescriptor;
  /** Short noun for status lines: 'cook time', 'cover photo', 'step 2' */
  label: TextDescriptor;
}

export type RecipeFormErrors = Record<RecipeFieldPath, TextDescriptor>;
export type RecipeFormTouched = Record<RecipeFieldPath, true>;

export type RecipeFormMode = 'create' | 'edit';

interface RecipePayloadCore {
  title: string;
  description: string;
  imageUrl: string;
  cookingTime: number;
  prepTime: number;
  servings: number;
  difficulty: DifficultyLevel;
  ingredients: Ingredient[];
  instructions: Instruction[];
}

/** Assignable to CreateRecipeDTO; `userId: ''` is stripped by useCreateRecipe */
export type CreateRecipePayload = RecipePayloadCore & { userId: ''; caption: string };

/** Assignable to UpdateRecipeDTO; an empty closing note is sent as null */
export type UpdateRecipePayload = RecipePayloadCore & { caption: string | null };

export type RecipePayload = CreateRecipePayload | UpdateRecipePayload;
