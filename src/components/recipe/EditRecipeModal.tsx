'use client';
import { Recipe } from '@/domain/types/recipe';
import RecipeTextFirstDialog from './form/RecipeTextFirstDialog';

interface EditRecipeModalProps {
  open: boolean;
  recipe: Recipe | null;
  onClose: () => void;
  onSuccess: (updatedRecipe: Recipe) => void;
}

/**
 * 'Edit recipe': the same editor as 'New recipe', opened on its structured tab. The only
 * edit-specific parts are the labels, the initial tab and the transport (PUT), all inside
 * the editor. The form resets on `recipe.id` + `open`, never on the identity of `recipe`:
 * the recipe page hands over a fresh object on every render.
 */
export default function EditRecipeModal({
  open,
  recipe,
  onClose,
  onSuccess,
}: EditRecipeModalProps) {
  if (!recipe) return null;

  return (
    <RecipeTextFirstDialog
      mode="edit"
      open={open}
      onClose={onClose}
      recipe={recipe}
      resetKey={`${recipe.id}:${open}`}
      onSuccess={onSuccess}
    />
  );
}
