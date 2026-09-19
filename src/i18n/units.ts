import { useTranslations } from 'next-intl';
import { useMemo } from 'react';
import { RECIPE_UNIT_LABELS, UNIT_TO_TASTE, type RecipeUnit } from '@/lib/constants';

/**
 * Units are the one thing that is NEVER translated in storage.
 *
 * A recipe row keeps 'cups', 'tbsp', 'to taste' in English forever: the pantry matcher and
 * the free-text parser compare against those exact strings, and a Spanish user's recipe has
 * to match an English user's pantry. Only the LABEL on screen changes language, through the
 * 'units' namespace - which is why this module maps a stored value to a message key rather
 * than translating anything itself.
 */

/** 'to taste' is not a legal key path segment, so it gets a camelCase name like the rest */
const MESSAGE_KEY_BY_UNIT: Record<RecipeUnit, string> = {
  g: 'g',
  kg: 'kg',
  mL: 'mL',
  L: 'L',
  units: 'units',
  tsp: 'tsp',
  tbsp: 'tbsp',
  cups: 'cups',
  pinch: 'pinch',
  oz: 'oz',
  lb: 'lb',
  [UNIT_TO_TASTE]: 'toTaste',
};

const isKnownUnit = (unit: string): unit is RecipeUnit => unit in MESSAGE_KEY_BY_UNIT;

export interface UnitLabels {
  /** What goes next to an amount: '2 tazas', '250 g'. Plural-aware where the language cares. */
  label: (unit: string, count?: number) => string;
  /** The long name for a picker: 'grams' / 'gramos' */
  name: (unit: string) => string;
  /** One option of the unit picker: 'g - grams' / 'g - gramos' */
  option: (unit: string) => string;
}

export function useUnitLabels(): UnitLabels {
  const t = useTranslations('units');

  return useMemo(() => {
    // A recipe saved before the unit list was closed can hold anything. Showing the stored
    // value is better than showing a missing-key path.
    const fallbackName = (unit: string) => (isKnownUnit(unit) ? RECIPE_UNIT_LABELS[unit] : unit);

    const label: UnitLabels['label'] = (unit, count = 1) =>
      isKnownUnit(unit)
        ? (t as (key: string, values?: Record<string, number>) => string)(
            `label.${MESSAGE_KEY_BY_UNIT[unit]}`,
            { count }
          )
        : unit;

    const name: UnitLabels['name'] = (unit) =>
      isKnownUnit(unit)
        ? (t as (key: string) => string)(`name.${MESSAGE_KEY_BY_UNIT[unit]}`)
        : fallbackName(unit);

    return {
      label,
      name,
      option: (unit) => t('option', { label: label(unit), name: name(unit) }),
    };
  }, [t]);
}
