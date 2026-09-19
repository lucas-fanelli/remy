import { Recipe } from '@/domain/types/recipe';
import { RecipeFormValues } from '../types';

export const COVER_URL = 'https://res.cloudinary.com/demo/image/upload/recipes/cover.jpg';
export const STEP_URL = 'https://res.cloudinary.com/demo/image/upload/recipes/step.jpg';

/** A complete, valid form: every test changes only what it is about */
export const makeValues = (overrides: Partial<RecipeFormValues> = {}): RecipeFormValues => ({
  title: 'Chocotorta',
  description: 'La clásica',
  imageUrl: COVER_URL,
  caption: '',
  prepTime: 0,
  cookingTime: 30,
  servings: 12,
  difficulty: 'easy',
  ingredients: [
    { id: 'i1', name: 'Chocolinas', amount: '500', unit: 'g' },
    { id: 'i2', name: 'Dulce de leche', amount: '400', unit: 'g' },
    { id: 'i3', name: '', amount: '', unit: '' },
  ],
  steps: [
    { id: 's1', description: 'Mix the filling', image: '' },
    { id: 's2', description: 'Build the layers', image: STEP_URL },
  ],
  ...overrides,
});

export const makeRecipe = (overrides: Partial<Recipe> = {}): Recipe => ({
  id: 'recipe-1',
  title: 'Chocotorta',
  description: 'La clásica',
  imageUrl: COVER_URL,
  userId: 'user-1',
  cookingTime: 30,
  prepTime: 10,
  servings: 12,
  difficulty: 'easy',
  ingredients: [
    { name: 'Chocolinas', amount: '500', unit: 'g' },
    { name: 'Salt', amount: '', unit: 'to taste' },
  ],
  instructions: [
    { step: 1, description: 'Mix the filling' },
    { step: 2, description: 'Build the layers', image: STEP_URL },
  ],
  caption: 'Better the next day',
  createdAt: new Date('2026-01-01T00:00:00Z'),
  updatedAt: new Date('2026-01-01T00:00:00Z'),
  ...overrides,
});
