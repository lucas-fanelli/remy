'use client';
import RecipeTextFirstDialog from '../recipe/form/RecipeTextFirstDialog';

interface CreateRecipeDialogProps {
  open: boolean;
  onClose: () => void;
}

/**
 * The 'New recipe' dialog. Mounted once, by CreateRecipeProvider; the editor publishes,
 * keeps the draft and navigates on its own, so this owner only says when it is open.
 */
export default function CreateRecipeDialog({ open, onClose }: CreateRecipeDialogProps) {
  return <RecipeTextFirstDialog mode="create" open={open} onClose={onClose} />;
}
