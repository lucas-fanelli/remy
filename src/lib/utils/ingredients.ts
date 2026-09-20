/**
 * Parse ingredient amount strings, including fractions like "1/2"
 */
export function parseAmount(amount: string): number {
  const trimmed = amount.trim();
  if (trimmed.includes('/')) {
    const parts = trimmed.split('/');
    if (parts.length === 2) {
      const num = parseFloat(parts[0]);
      const den = parseFloat(parts[1]);
      if (!isNaN(num) && !isNaN(den) && den !== 0) return num / den;
    }
    return NaN;
  }
  return parseFloat(trimmed);
}

/**
 * Normalize ingredient names for matching (case-insensitive, basic plural handling)
 */
// Common cooking words that end in 's' or 'e' patterns but should NOT be stem-stripped
const noStripSuffixWords = new Set([
  'cheese',
  'lettuce',
  'rice',
  'sauce',
  'juice',
  'grease',
  'molasses',
  'hummus',
  'asparagus',
  'couscous',
  'jus',
  'mousse',
  'hoisin',
  'quinoa',
  'tahini',
  'edamame',
  'guacamole',
  'brioche',
  'creme',
  'praline',
  'meringue',
  'ganache',
  'puree',
  'bechamel',
  'roux',
  'au jus',
  'aioli',
  'lass',
  'bass',
  'class',
  'grass',
  'mass',
  'tortoise',
  'anise',
  'sesame',
  'flaxseed',
  'lemongrass',
  'harissa',
  'mascarpone',
  'prosciutto',
  'pancetta',
  'bruschetta',
  'focaccia',
  'sriracha',
  'tzatziki',
  'chimichurri',
  'pesto',
  'miso',
  'tofu',
  'tempeh',
  'seitan',
  'panko',
  'mozzarella',
  'ricotta',
  'brie',
  'gruyere',
  'gouda',
  'feta',
  'halloumi',
  'boursin',
  'arugula',
  'endive',
  'kale',
  'chard',
  'watercress',
  'turmeric',
  'cumin',
  'coriander',
  'cardamom',
  'nutmeg',
  'saffron',
  'oregano',
  'thyme',
  'rosemary',
  'sage',
  'basil',
  'tarragon',
  'dill',
  'vinaigrette',
  'remoulade',
  'hollandaise',
  'bearnaise',
  'veloute',
  'coleslaw',
  'salsa',
  'chutney',
  'relish',
  'compote',
  'polenta',
  'risotto',
  'gnocchi',
  'orzo',
  'penne',
  'linguine',
  'fettuccine',
  'rigatoni',
  'farfalle',
  'fusilli',
  'ravioli',
  'hummus',
  'baba ganoush',
  'tabbouleh',
  'alias',
  'atlas',
  'canvas',
  'citrus',
  'corpus',
  'campus',
  'census',
  'bonus',
  'cactus',
  'focus',
  'fungus',
  'genus',
  'humus',
  'iris',
  'lens',
  'lotus',
  'mucus',
  'nexus',
  'opus',
  'radius',
  'status',
  'venus',
  'virus',
  'thus',
]);

// LIMITATION: Manual suffix stripping below handles common English plurals but will
// produce incorrect stems for irregular words and non-English ingredient names.
// Consider replacing with a stemming library (e.g., 'stemmer' or 'natural') for
// more accurate normalization if matching quality becomes an issue.
export function normalizeIngredientName(name: string): string {
  if (name.length > 200) return name.slice(0, 200).toLowerCase().trim();
  let normalized = name.toLowerCase().trim();

  // Check exceptions before any plural stripping
  if (noStripSuffixWords.has(normalized)) {
    return normalized
      .replace(/[^a-z0-9 ]/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

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
  } else if (normalized.endsWith('oes') && normalized.length > 4) {
    normalized = normalized.slice(0, -2); // tomatoes -> tomato, potatoes -> potato
  } else if (normalized.endsWith('s') && !normalized.endsWith('ss') && normalized.length > 3) {
    normalized = normalized.slice(0, -1); // tomatoes -> tomato, but not "stress" -> "stres"
  }

  // Guard: if stripping produced a very short result (< 3 chars), fall back to
  // the original name. This handles naturally short ingredient names like "za'atar"
  // or single-kanji items that become very short after cleanup, as well as cases
  // where aggressive plural stripping reduced a word too far.
  const cleaned = normalized
    .replace(/[^a-z0-9 ]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  if (cleaned.length < 3) {
    return name
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9 ]/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  }
  return cleaned;
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
  // Countable things, plural to singular. Without these a recipe asking for "2 pieces"
  // did not match a pantry holding "piece" — the two strings simply differed, and the
  // deduction was skipped in silence.
  pieces: 'piece',
  cloves: 'clove',
  sprigs: 'sprig',
  stalks: 'stalk',
  sheets: 'sheet',
  slices: 'slice',
  cans: 'can',
  packs: 'pack',
  units: 'unit',
};

/**
 * What a unit measures, and how much of the dimension's base unit it is worth.
 * Base units: gram for mass, milliliter for volume.
 *
 * Anything absent from this table — a piece, a clove, "to taste" — is countable or
 * unmeasurable and converts only to itself.
 */
const UNIT_SCALE: Record<string, { dimension: 'mass' | 'volume'; inBaseUnits: number }> = {
  gram: { dimension: 'mass', inBaseUnits: 1 },
  kilogram: { dimension: 'mass', inBaseUnits: 1000 },
  ounce: { dimension: 'mass', inBaseUnits: 28.349523125 },
  pound: { dimension: 'mass', inBaseUnits: 453.59237 },
  milliliter: { dimension: 'volume', inBaseUnits: 1 },
  liter: { dimension: 'volume', inBaseUnits: 1000 },
  cup: { dimension: 'volume', inBaseUnits: 240 },
  tablespoon: { dimension: 'volume', inBaseUnits: 15 },
  teaspoon: { dimension: 'volume', inBaseUnits: 5 },
};

/**
 * Normalize a unit string using aliases
 */
export function normalizeUnit(unit: string): string {
  const lower = unit.toLowerCase().trim();
  return UNIT_ALIASES[lower] || lower;
}

/**
 * Check if two units are the same unit. Prefer {@link convertAmount} when you need to
 * compare quantities: a pantry holding kilograms can satisfy a recipe asking for grams,
 * and this returns false for that.
 */
export function unitsMatch(a: string, b: string): boolean {
  return normalizeUnit(a) === normalizeUnit(b);
}

/**
 * Express `amount` of `from` in `to`, or null when the two do not measure the same thing.
 *
 * This is why a recipe asking for 500 g found nothing in a pantry holding 1 kg: matching
 * was string equality on the unit, so every mixed-unit pairing silently deducted nothing
 * and reported no shortage. Grams and millilitres stay apart — converting between mass and
 * volume needs a density this app does not know.
 *
 * ```ts
 * convertAmount(1, 'kg', 'g')  // 1000
 * convertAmount(500, 'g', 'kg') // 0.5
 * convertAmount(2, 'cloves', 'g') // null — a clove is not a mass
 * ```
 */
export function convertAmount(amount: number, from: string, to: string): number | null {
  if (!Number.isFinite(amount)) return null;

  const fromScale = UNIT_SCALE[normalizeUnit(from)];
  const toScale = UNIT_SCALE[normalizeUnit(to)];

  if (fromScale && toScale) {
    if (fromScale.dimension !== toScale.dimension) return null;
    return (amount * fromScale.inBaseUnits) / toScale.inBaseUnits;
  }

  // One or both are countable ("2 pieces") or unrecognised. Those only convert to
  // themselves — guessing how many grams a clove weighs is how you get a pantry that
  // quietly disagrees with reality.
  return unitsMatch(from, to) ? amount : null;
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
