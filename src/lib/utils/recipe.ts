/**
 * Safely resolve averageRating, preserving null for unrated recipes.
 * Returns null for undefined inputs, otherwise passes through the value as-is.
 *
 * Assumes ratings are on a 1-5 scale. A return value of null means
 * "no rating" (the recipe has not been rated yet).
 *
 * This should only be used at API boundaries (e.g. serializing a response).
 * In display components, check `averageRating !== null && averageRating > 0`
 * to decide whether to show rating UI.
 */
export function safeRating(value: number | null | undefined): number | null {
  if (value == null) return null;
  if (!Number.isFinite(value) || value < 0 || value > 5) return null;
  return Math.round(value * 10) / 10;
}

/**
 * Get MUI color for recipe difficulty level
 */
const warnedDifficulties = new Set<string>();

export function getDifficultyColor(
  difficulty: string
): 'success' | 'warning' | 'error' | 'default' {
  switch (difficulty?.toLowerCase()) {
    case 'easy':
      return 'success';
    case 'medium':
      return 'warning';
    case 'hard':
      return 'error';
    default:
      // Data quality issue, not an app error — use console.warn instead of logServerError
      // Dedup Set prevents flooding logs with repeated warnings for the same value
      if (warnedDifficulties.size < 50 && !warnedDifficulties.has(difficulty)) {
        warnedDifficulties.add(difficulty);
        console.warn(`Unknown difficulty value: "${difficulty}"`);
      }
      return 'default';
  }
}
