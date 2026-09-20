/**
 * Normalise an ingredient amount as typed by the author into something `parseAmount`
 * (src/lib/utils/ingredients.ts) reads correctly: it takes '1 1/2' for 0.5 and '1,5' for 1.
 *
 *   '1,5'   -> '1.5'      '1 1/2' -> '1.5'      '½' -> '0.5'      '1½' -> '1.5'
 *
 * Plain numbers and simple fractions ('1/2') are kept as typed. Anything that is not a
 * recognised number ('a handful', '2-3') is returned trimmed and otherwise untouched:
 * text the author typed is never destroyed.
 */

const UNICODE_FRACTIONS: Record<string, number> = {
  '½': 1 / 2,
  '⅓': 1 / 3,
  '⅔': 2 / 3,
  '¼': 1 / 4,
  '¾': 3 / 4,
  '⅕': 1 / 5,
  '⅖': 2 / 5,
  '⅗': 3 / 5,
  '⅘': 4 / 5,
  '⅙': 1 / 6,
  '⅚': 5 / 6,
  '⅐': 1 / 7,
  '⅛': 1 / 8,
  '⅜': 3 / 8,
  '⅝': 5 / 8,
  '⅞': 7 / 8,
  '⅑': 1 / 9,
  '⅒': 1 / 10,
};

const UNICODE_FRACTION_CLASS = `[${Object.keys(UNICODE_FRACTIONS).join('')}]`;

const DECIMAL_COMMA = /^(\d+),(\d+)$/;
const MIXED_NUMBER = /^(\d+)\s+(\d+)\s*\/\s*(\d+)$/;
const SIMPLE_FRACTION = /^(\d+)\s*\/\s*(\d+)$/;
const UNICODE_AMOUNT = new RegExp(`^(\\d+)?\\s*(${UNICODE_FRACTION_CLASS})$`);

/** At most three decimals, without trailing zeros: 1.3333 -> '1.333', 1.50 -> '1.5' */
const formatDecimal = (value: number): string => String(Math.round(value * 1000) / 1000);

export function normaliseAmount(raw: string): string {
  const value = raw.trim().replace(/\s+/g, ' ');
  if (value === '') return '';

  const decimalComma = DECIMAL_COMMA.exec(value);
  if (decimalComma) return `${decimalComma[1]}.${decimalComma[2]}`;

  const mixed = MIXED_NUMBER.exec(value);
  if (mixed) {
    const denominator = Number(mixed[3]);
    if (denominator === 0) return value;
    return formatDecimal(Number(mixed[1]) + Number(mixed[2]) / denominator);
  }

  const fraction = SIMPLE_FRACTION.exec(value);
  if (fraction) return `${fraction[1]}/${fraction[2]}`;

  const unicode = UNICODE_AMOUNT.exec(value);
  if (unicode) {
    const whole = unicode[1] ? Number(unicode[1]) : 0;
    return formatDecimal(whole + UNICODE_FRACTIONS[unicode[2]]);
  }

  return value;
}
