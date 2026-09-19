import { RECIPE_DEFAULT_UNIT, RECIPE_LIMITS, RecipeUnit, UNIT_TO_TASTE } from '@/lib/constants';
import { normaliseAmount } from '@/lib/utils/normaliseAmount';

/**
 * Text <-> rows for the 'Write' tab of the recipe form: the author types or pastes the
 * ingredients one per line and the method as paragraphs, exactly like the note they already
 * have, and these pure functions turn it into the rows the form engine works with.
 *
 * Two promises, both pinned by the test table:
 *   - the parsers never throw and never lose what was typed: whatever can not be placed
 *     stays in the name / the step text, and a doubtful line is flagged 'check' with a
 *     reason instead of being guessed silently;
 *   - for rows with canonical units, parsing what the serialisers wrote gives the rows back.
 *
 * The Spanish aliases are deliberate: recipes are written in the authors' language while
 * the stored unit stays one of RECIPE_UNITS, which is what pantry matching reads.
 */

export type ParseConfidence = 'ok' | 'check';

export interface ParsedIngredient {
  /** Normalised ('1,5' -> '1.5'); '' for a to-taste row */
  amount: string;
  /** A RECIPE_UNITS value; '' for a to-taste row */
  unit: string;
  name: string;
  confidence: ParseConfidence;
  /** Why the line deserves a look; '' while `confidence` is 'ok' */
  reason: string;
  /** The line as typed, trimmed */
  sourceText: string;
}

export interface ParsedIngredients {
  rows: ParsedIngredient[];
  /** More lines than RECIPE_LIMITS.ingredients: only the first ones were read */
  capped: boolean;
}

export interface ParsedStep {
  description: string;
  /** The paragraph as typed (numbering included), trimmed */
  sourceText: string;
}

export interface ParsedMethod {
  steps: ParsedStep[];
  /** More paragraphs than RECIPE_LIMITS.steps: only the first ones were read */
  capped: boolean;
}

export const INGREDIENTS_CAPPED_MESSAGE = `Only the first ${RECIPE_LIMITS.ingredients} ingredients were read`;
export const STEPS_CAPPED_MESSAGE = `Only the first ${RECIPE_LIMITS.steps} steps were read`;

/** Lower-case alias -> canonical unit. This table is the only place the aliases live */
export const UNIT_ALIASES: Readonly<Record<string, RecipeUnit>> = {
  g: 'g',
  gr: 'g',
  grs: 'g',
  gramo: 'g',
  gramos: 'g',
  gram: 'g',
  grams: 'g',
  kg: 'kg',
  kgs: 'kg',
  kilo: 'kg',
  kilos: 'kg',
  kilogramo: 'kg',
  kilogramos: 'kg',
  kilogram: 'kg',
  kilograms: 'kg',
  ml: 'mL',
  cc: 'mL',
  mililitro: 'mL',
  mililitros: 'mL',
  millilitre: 'mL',
  millilitres: 'mL',
  milliliter: 'mL',
  milliliters: 'mL',
  l: 'L',
  lt: 'L',
  lts: 'L',
  litro: 'L',
  litros: 'L',
  litre: 'L',
  litres: 'L',
  liter: 'L',
  liters: 'L',
  cda: 'tbsp',
  cdas: 'tbsp',
  cucharada: 'tbsp',
  cucharadas: 'tbsp',
  tbsp: 'tbsp',
  tbsps: 'tbsp',
  tablespoon: 'tbsp',
  tablespoons: 'tbsp',
  cdta: 'tsp',
  cdtas: 'tsp',
  cdita: 'tsp',
  cditas: 'tsp',
  cucharadita: 'tsp',
  cucharaditas: 'tsp',
  tsp: 'tsp',
  tsps: 'tsp',
  teaspoon: 'tsp',
  teaspoons: 'tsp',
  taza: 'cups',
  tazas: 'cups',
  cup: 'cups',
  cups: 'cups',
  pizca: 'pinch',
  pizcas: 'pinch',
  pinch: 'pinch',
  pinches: 'pinch',
  unidad: 'units',
  unidades: 'units',
  u: 'units',
  unit: 'units',
  units: 'units',
  oz: 'oz',
  onza: 'oz',
  onzas: 'oz',
  ounce: 'oz',
  ounces: 'oz',
  lb: 'lb',
  lbs: 'lb',
  libra: 'lb',
  libras: 'lb',
  pound: 'lb',
  pounds: 'lb',
};

const UNICODE_FRACTIONS = '½⅓⅔¼¾⅕⅖⅗⅘⅙⅚⅐⅛⅜⅝⅞⅑⅒';
const NUMBER = '\\d+(?:[.,]\\d+)?';
// Longest first: a range, 'n a/b', 'a/b', 'n½' / '½', a decimal, an integer
const AMOUNT = [
  `${NUMBER}\\s*[-–]\\s*${NUMBER}`,
  '\\d+\\s+\\d+\\s*/\\s*\\d+',
  '\\d+\\s*/\\s*\\d+',
  `\\d*\\s*[${UNICODE_FRACTIONS}]`,
  NUMBER,
].join('|');

const LIST_MARKER = /^\s*(?:[-*•·]\s*|\d+[.)]\s+)/;
const LEADING_AMOUNT = new RegExp(`^(${AMOUNT})\\s*(.*)$`);
const TRAILING_AMOUNT = new RegExp(`^(.*?)[\\s:,(–-]+(${AMOUNT})\\s*([\\p{L}]+)\\.?\\)?$`, 'u');
const UNIT_TOKEN = /^([\p{L}]+)\.?(?=\s|$)\s*(.*)$/u;
const CONNECTOR = /^(?:de|del|of)\s+/i;
const CONTAINER_OF = /^(\S+)\s+(?:de|del|of)\s+\S/i;
const TO_TASTE_MARKER =
  /[\s,;(–-]*\b(?:a gusto|al gusto|to taste|cantidad necesaria|c\/n)(?:\b|(?=\s|$))\)?/i;
const HAS_DIGIT = /\d/;

// '1.', '1)', 'Paso 1:', 'Step 1 -', '-'. A bare '5 - 10 min' or '1.5 kg' is not numbering
const STEP_MARKER =
  /^\s*(?:(?:paso|step)\s*\d+\s*[.:)-]?\s+|\d+[.)](?:\s+|(?=\p{L})|$)|[-*•·]\s+)/iu;
// Longer lines are prose, not 'name amount unit': the lazy scan is not worth running
const TRAILING_AMOUNT_MAX_LENGTH = 250;

const collapse = (text: string): string => text.trim().replace(/\s+/g, ' ');

/** How lines are compared: case and spacing do not make a line a different one */
export const normaliseLine = (text: string): string => collapse(text).toLowerCase();

const toLines = (text: string): string[] => text.replace(/\r\n?/g, '\n').split('\n');

const lookUpUnit = (token: string): RecipeUnit | undefined =>
  Object.prototype.hasOwnProperty.call(UNIT_ALIASES, token.toLowerCase())
    ? UNIT_ALIASES[token.toLowerCase()]
    : undefined;

const ok = (sourceText: string, amount: string, unit: string, name: string): ParsedIngredient => ({
  amount,
  unit,
  name,
  confidence: 'ok',
  reason: '',
  sourceText,
});

const check = (row: ParsedIngredient, reason: string): ParsedIngredient => ({
  ...row,
  confidence: 'check',
  reason,
});

/** A name the form would reject is worth a look before Publish names it */
const withNameChecks = (row: ParsedIngredient): ParsedIngredient => {
  if (row.name === '') return check(row, 'No ingredient name on this line');
  if (row.name.length > RECIPE_LIMITS.name) {
    return check(row, `Longer than ${RECIPE_LIMITS.name} characters - shorten the name`);
  }
  return row;
};

function parseIngredientLine(line: string): ParsedIngredient {
  const sourceText = collapse(line);
  const text = collapse(line.replace(LIST_MARKER, ''));

  const leading = LEADING_AMOUNT.exec(text);
  const hasMarker = TO_TASTE_MARKER.test(text);

  if (leading) {
    const amount = normaliseAmount(leading[1]);
    const rest = leading[2];
    const token = UNIT_TOKEN.exec(rest);
    const unit = token ? lookUpUnit(token[1]) : undefined;

    if (token && unit) {
      const name = collapse(token[2].replace(CONNECTOR, ''));
      const row = withNameChecks(ok(sourceText, amount, unit, name));
      return hasMarker && row.confidence === 'ok'
        ? check(row, "An amount and 'to taste' on one line - keep one")
        : row;
    }

    // The server needs a unit, so a bare count is stored as 'units' ('2 huevos')
    const row = withNameChecks(ok(sourceText, amount, RECIPE_DEFAULT_UNIT, collapse(rest)));
    if (row.confidence === 'check') return row;
    if (hasMarker) return check(row, "An amount and 'to taste' on one line - keep one");
    // '1 lata de tomate': the first word may be a measure this list does not know
    const container = CONTAINER_OF.exec(row.name);
    return container
      ? check(row, `No unit recognised - is "${container[1]}" part of the name?`)
      : row;
  }

  if (hasMarker) {
    const name = collapse(text.replace(TO_TASTE_MARKER, ' '));
    return withNameChecks(ok(sourceText, '', '', name));
  }

  // 'harina 500 g', 'harina: 500g', 'harina (500 g)'
  const trailing =
    HAS_DIGIT.test(text) && text.length <= TRAILING_AMOUNT_MAX_LENGTH
      ? TRAILING_AMOUNT.exec(text)
      : null;
  const trailingUnit = trailing ? lookUpUnit(trailing[3]) : undefined;
  if (trailing && trailingUnit && trailing[1].trim() !== '') {
    return withNameChecks(
      ok(sourceText, normaliseAmount(trailing[2]), trailingUnit, collapse(trailing[1]))
    );
  }

  // No amount at all is 'to taste' (Pantry's model); a number that could not be placed
  // stays in the name and is pointed out
  const row = withNameChecks(ok(sourceText, '', '', text));
  if (row.confidence === 'check') return row;
  return HAS_DIGIT.test(text)
    ? check(row, 'Found a number but could not read it as an amount')
    : row;
}

/**
 * One ingredient per non-empty line. Bullets and list numbering are dropped, a leading
 * amount and a known unit are read, a connecting 'de' / 'of' is skipped and the rest is the
 * name. 'a gusto' / 'c/n' / 'to taste', or no amount at all, make a to-taste row (empty
 * amount AND unit). Never throws.
 */
export function parseIngredientLines(text: string): ParsedIngredients {
  const lines = toLines(text).filter((line) => line.trim() !== '');
  return {
    rows: lines.slice(0, RECIPE_LIMITS.ingredients).map(parseIngredientLine),
    capped: lines.length > RECIPE_LIMITS.ingredients,
  };
}

/**
 * One step per paragraph. When the text has blank lines or numbered / bulleted lines
 * ('1.', '1)', 'Paso 1:', 'Step 1:', '-') those start the steps and the other lines
 * continue the step above them; in a plain block of lines every line is a step. The
 * numbering is dropped: a step's number is its position. Never throws.
 */
export function parseMethod(text: string): ParsedMethod {
  // Trimmed first, so a blank line can only be one BETWEEN paragraphs
  const lines = toLines(text.trim());
  const structured = lines.some((line) => line.trim() === '' || STEP_MARKER.test(line));

  const paragraphs: string[][] = [];
  let afterBlank = true;
  lines.forEach((line) => {
    if (line.trim() === '') {
      afterBlank = true;
      return;
    }
    if (!structured || afterBlank || STEP_MARKER.test(line)) {
      paragraphs.push([line]);
    } else {
      paragraphs[paragraphs.length - 1].push(line);
    }
    afterBlank = false;
  });

  const steps = paragraphs.map((paragraph): ParsedStep => {
    const [first, ...others] = paragraph.map((line) => line.trim());
    // Typed line breaks inside a step survive: the recipe page prints steps pre-line
    const description = [first.replace(STEP_MARKER, '').trim(), ...others].join('\n').trim();
    return { description, sourceText: paragraph.join('\n').trim() };
  });

  // '1.' alone on a line carries no step
  const written = steps.filter((step) => step.description !== '');
  return {
    steps: written.slice(0, RECIPE_LIMITS.steps),
    capped: written.length > RECIPE_LIMITS.steps,
  };
}

interface IngredientLike {
  name: string;
  amount: string;
  unit: string;
}

interface StepLike {
  description: string;
}

/** '500 g harina', '2 huevos' ('units' is not written), 'sal' for a to-taste row */
export function serialiseIngredient(row: IngredientLike): string {
  const amount = row.amount.trim();
  const unit = row.unit.trim();
  const printedUnit = unit === RECIPE_DEFAULT_UNIT || unit === UNIT_TO_TASTE ? '' : unit;
  return [amount, printedUnit, row.name.trim()].filter(Boolean).join(' ');
}

/** One line per named or measured row; blank rows (the form's trailing one) are skipped */
export function serialiseIngredients(rows: IngredientLike[]): string {
  return rows
    .map(serialiseIngredient)
    .filter((line) => line !== '')
    .join('\n');
}

/**
 * Numbered paragraphs separated by a blank line. The numbers make the text parse back to
 * the same steps even when a step holds line breaks of its own; blank lines inside a step
 * are closed up, because a blank line IS the step separator.
 */
export function serialiseSteps(rows: StepLike[]): string {
  return rows
    .map((row) => row.description.trim().replace(/\n\s*\n/g, '\n'))
    .filter((description) => description !== '')
    .map((description, index) => `${index + 1}. ${description}`)
    .join('\n\n');
}
