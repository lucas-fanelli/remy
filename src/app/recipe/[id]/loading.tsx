'use client';

import RecipeSkeleton from '@/components/recipe/RecipeSkeleton';

/**
 * What shows the moment a recipe is opened, while the page is on its way. It used to be
 * null — the comment claimed it kept the previous page visible, but a loading boundary
 * replaces the page at once, so the main area went blank until the recipe arrived.
 */
export default function Loading() {
  return <RecipeSkeleton />;
}
