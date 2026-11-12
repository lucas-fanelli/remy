/**
 * Where a recipe's comments start, as a URL fragment.
 *
 * The card's comment button links here and CommentsSection carries it as its id, so the two
 * are spelled once. They had drifted apart: the button sent people to `#comments` while
 * nothing on the page had that id, so it opened the recipe at the top — with the comments
 * 1700px further down.
 */
export const COMMENTS_FRAGMENT = 'comments';

/** A recipe page at its comments. `recipeHref` is wherever the card itself links to. */
export function commentsHref(recipeHref: string): string {
  return `${recipeHref.split('#')[0]}#${COMMENTS_FRAGMENT}`;
}
