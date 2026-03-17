/**
 * Get MUI color for recipe difficulty level
 */
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
      return 'default';
  }
}
