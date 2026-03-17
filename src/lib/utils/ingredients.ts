/**
 * Normalize ingredient names for matching (case-insensitive, basic plural handling)
 */
export function normalizeIngredientName(name: string): string {
  let normalized = name.toLowerCase().trim();
  // Remove common plural suffixes (order matters: check longer suffixes first)
  if (normalized.endsWith('ies') && normalized.length > 4) {
    normalized = normalized.slice(0, -3) + 'y'; // berries -> berry
  } else if (normalized.endsWith('ves') && normalized.length > 4) {
    normalized = normalized.slice(0, -3) + 'f'; // halves -> half
  } else if (
    normalized.endsWith('ses') ||
    normalized.endsWith('xes') ||
    normalized.endsWith('zes') ||
    normalized.endsWith('ches') ||
    normalized.endsWith('shes')
  ) {
    normalized = normalized.slice(0, -2); // boxes -> box, dishes -> dish
  } else if (normalized.endsWith('s') && !normalized.endsWith('ss') && normalized.length > 3) {
    normalized = normalized.slice(0, -1); // tomatoes -> tomato, but not "stress" -> "stres"
  }
  // Replace non-alphanumeric except spaces with empty, then normalize whitespace
  return normalized
    .replace(/[^a-z0-9 ]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Unit alias map for normalizing measurement units
 */
const UNIT_ALIASES: Record<string, string> = {
  tbsp: 'tablespoon',
  tbs: 'tablespoon',
  tablespoons: 'tablespoon',
  tsp: 'teaspoon',
  teaspoons: 'teaspoon',
  ml: 'milliliter',
  milliliters: 'milliliter',
  l: 'liter',
  liters: 'liter',
  oz: 'ounce',
  ounces: 'ounce',
  lb: 'pound',
  lbs: 'pound',
  pounds: 'pound',
  g: 'gram',
  grams: 'gram',
  kg: 'kilogram',
  kilograms: 'kilogram',
  cups: 'cup',
};

/**
 * Normalize a unit string using aliases
 */
export function normalizeUnit(unit: string): string {
  const lower = unit.toLowerCase().trim();
  return UNIT_ALIASES[lower] || lower;
}

/**
 * Check if two units are compatible
 */
export function unitsMatch(a: string, b: string): boolean {
  return normalizeUnit(a) === normalizeUnit(b);
}

/**
 * Check if pantry item matches recipe ingredient using fuzzy matching
 */
export function ingredientMatches(
  pantryItem: { name: string },
  recipeIngredient: { name: string }
): boolean {
  const normalizedPantry = normalizeIngredientName(pantryItem.name);
  const normalizedRecipe = normalizeIngredientName(recipeIngredient.name);

  return (
    normalizedPantry === normalizedRecipe ||
    normalizedPantry.includes(normalizedRecipe) ||
    normalizedRecipe.includes(normalizedPantry)
  );
}
