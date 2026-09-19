import { Recipe } from '@/domain/types/recipe';
import { RECIPE_LIMITS, UNIT_TO_TASTE } from '@/lib/constants';
import {
  createEmptyValues,
  createIngredientRow,
  createRowId,
  createStepRow,
  hydrateValues,
  isBlankIngredientRow,
  isBlankStepRow,
  isToTasteRow,
  normaliseIngredientRow,
  snapshotValues,
  trimTrailingBlankRows,
  valuesFromRecipe,
  withTrailingBlankIngredient,
} from '../formValues';
import { makeRecipe, makeValues, STEP_URL } from './fixtures';

describe('createRowId', () => {
  const originalCrypto = Object.getOwnPropertyDescriptor(globalThis, 'crypto');

  const setCrypto = (value: unknown) =>
    Object.defineProperty(globalThis, 'crypto', { value, configurable: true, writable: true });

  afterEach(() => {
    if (originalCrypto) Object.defineProperty(globalThis, 'crypto', originalCrypto);
    else delete (globalThis as { crypto?: unknown }).crypto;
  });

  it('should use crypto.randomUUID when the runtime has it', () => {
    setCrypto({ randomUUID: () => 'uuid-from-crypto' });

    expect(createRowId()).toBe('uuid-from-crypto');
  });

  it('should fall back to unique counter ids when crypto has no randomUUID', () => {
    setCrypto({});

    const ids = [createRowId(), createRowId(), createRowId()];

    expect(new Set(ids).size).toBe(3);
    ids.forEach((id) => expect(id).toMatch(/^row-\d+$/));
  });

  it('should fall back to counter ids when there is no crypto at all', () => {
    setCrypto(undefined);

    expect(createRowId()).toMatch(/^row-\d+$/);
  });
});

describe('row factories', () => {
  it('should create a blank ingredient row with an id', () => {
    const row = createIngredientRow();

    expect(row).toEqual({ id: expect.any(String), name: '', amount: '', unit: '' });
    expect(row.id).not.toBe('');
  });

  it('should keep the id and fields an ingredient row brings', () => {
    const row = createIngredientRow({ id: 'keep', name: 'Flour', amount: '2', unit: 'cups' });

    expect(row).toEqual({ id: 'keep', name: 'Flour', amount: '2', unit: 'cups' });
  });

  it('should create a blank step row with an id', () => {
    const row = createStepRow();

    expect(row).toEqual({ id: expect.any(String), description: '', image: '' });
  });

  it('should keep the id and fields a step row brings', () => {
    const row = createStepRow({ id: 'keep', description: 'Bake', image: STEP_URL });

    expect(row).toEqual({ id: 'keep', description: 'Bake', image: STEP_URL });
  });
});

describe('blank and to-taste rows', () => {
  it('should treat an ingredient row of only whitespace as blank', () => {
    expect(isBlankIngredientRow({ name: ' ', amount: '', unit: ' ' })).toBe(true);
  });

  it('should not treat an ingredient row with only a unit as blank', () => {
    expect(isBlankIngredientRow({ name: '', amount: '', unit: 'g' })).toBe(false);
  });

  it('should not treat a step with a photo and no text as blank', () => {
    expect(isBlankStepRow({ description: '', image: STEP_URL })).toBe(false);
  });

  it('should treat a step without text or photo as blank', () => {
    expect(isBlankStepRow({ description: '  ', image: '' })).toBe(true);
  });

  it('should read a named row without amount or unit as to taste', () => {
    expect(isToTasteRow({ name: 'Salt', amount: '', unit: '' })).toBe(true);
  });

  it('should read a named row with the explicit to-taste unit as to taste', () => {
    expect(isToTasteRow({ name: 'Salt', amount: '', unit: UNIT_TO_TASTE })).toBe(true);
  });

  it('should not read a row with an amount as to taste', () => {
    expect(isToTasteRow({ name: 'Salt', amount: '1', unit: '' })).toBe(false);
  });

  it('should not read a row without a name as to taste', () => {
    expect(isToTasteRow({ name: '', amount: '', unit: UNIT_TO_TASTE })).toBe(false);
  });

  it('should not read a row with a real unit as to taste', () => {
    expect(isToTasteRow({ name: 'Salt', amount: '', unit: 'g' })).toBe(false);
  });
});

describe('trimTrailingBlankRows', () => {
  const isBlank = (value: string) => value === '';

  it('should drop only the trailing blank rows', () => {
    expect(trimTrailingBlankRows(['a', '', 'b', '', ''], isBlank)).toEqual(['a', '', 'b']);
  });

  it('should return the same array when nothing trails', () => {
    const rows = ['a', 'b'];

    expect(trimTrailingBlankRows(rows, isBlank)).toBe(rows);
  });

  it('should return an empty array when every row is blank', () => {
    expect(trimTrailingBlankRows(['', ''], isBlank)).toEqual([]);
  });
});

describe('withTrailingBlankIngredient', () => {
  it('should append a blank row after a filled last row', () => {
    const rows = [createIngredientRow({ name: 'Flour' })];

    const result = withTrailingBlankIngredient(rows);

    expect(result).toHaveLength(2);
    expect(isBlankIngredientRow(result[1])).toBe(true);
  });

  it('should return the same array when it already ends with a blank row', () => {
    const rows = [createIngredientRow({ name: 'Flour' }), createIngredientRow()];

    expect(withTrailingBlankIngredient(rows)).toBe(rows);
  });

  it('should add a blank row to an empty list', () => {
    expect(withTrailingBlankIngredient([])).toHaveLength(1);
  });

  it('should not grow a full list', () => {
    const rows = Array.from({ length: RECIPE_LIMITS.ingredients }, (_, i) =>
      createIngredientRow({ name: `Ingredient ${i}` })
    );

    expect(withTrailingBlankIngredient(rows)).toBe(rows);
  });
});

describe('normaliseIngredientRow', () => {
  it('should normalise the amount', () => {
    const row = normaliseIngredientRow({ name: 'Milk', amount: '1,5', unit: 'L' });

    expect(row.amount).toBe('1.5');
  });

  it("should fill in 'units' when there is an amount and no unit", () => {
    const row = normaliseIngredientRow({ name: 'Eggs', amount: '2', unit: '' });

    expect(row.unit).toBe('units');
  });

  it('should not fill in a unit when there is no amount', () => {
    const row = normaliseIngredientRow({ name: 'Salt', amount: '', unit: '' });

    expect(row.unit).toBe('');
  });

  it('should return the same row when nothing changes', () => {
    const row = { name: 'Flour', amount: '2', unit: 'cups' };

    expect(normaliseIngredientRow(row)).toBe(row);
  });
});

describe('createEmptyValues', () => {
  it('should prefill only servings and difficulty', () => {
    const values = createEmptyValues();

    expect(values).toMatchObject({
      title: '',
      description: '',
      imageUrl: '',
      caption: '',
      prepTime: '',
      cookingTime: '',
      servings: 4,
      difficulty: 'medium',
    });
  });

  it('should start with one blank ingredient row and one blank step', () => {
    const values = createEmptyValues();

    expect(values.ingredients).toHaveLength(1);
    expect(values.steps).toHaveLength(1);
  });
});

describe('hydrateValues', () => {
  it('should give every row an id and end the ingredients with a blank row', () => {
    const { ingredients, steps, ...scalars } = makeValues();

    const values = hydrateValues({
      ...scalars,
      ingredients: [{ name: 'Flour', amount: '2', unit: 'cups' }],
      steps: [{ description: 'Bake', image: '' }],
    });

    expect(values.ingredients).toHaveLength(2);
    expect(values.ingredients[0].id).toEqual(expect.any(String));
    expect(values.steps[0].id).toEqual(expect.any(String));
  });

  it('should start with one blank step when there are none', () => {
    const values = hydrateValues({ ...makeValues(), steps: [] });

    expect(values.steps).toEqual([{ id: expect.any(String), description: '', image: '' }]);
  });
});

describe('valuesFromRecipe', () => {
  it('should copy the scalar fields of the recipe', () => {
    const values = valuesFromRecipe(makeRecipe());

    expect(values).toMatchObject({
      title: 'Chocotorta',
      description: 'La clásica',
      caption: 'Better the next day',
      prepTime: 10,
      cookingTime: 30,
      servings: 12,
      difficulty: 'easy',
    });
  });

  it('should map a stored to-taste ingredient to a named row without amount or unit', () => {
    const values = valuesFromRecipe(makeRecipe());

    expect(values.ingredients[1]).toMatchObject({ name: 'Salt', amount: '', unit: '' });
  });

  it('should keep a legacy to-taste ingredient that carries an amount untouched', () => {
    const recipe = makeRecipe({
      ingredients: [{ name: 'Salt', amount: 'a pinch', unit: UNIT_TO_TASTE }],
    });

    const values = valuesFromRecipe(recipe);

    expect(values.ingredients[0]).toMatchObject({ amount: 'a pinch', unit: UNIT_TO_TASTE });
  });

  it('should keep a legacy unit that is not in the unit list', () => {
    const recipe = makeRecipe({ ingredients: [{ name: 'Eggs', amount: '2', unit: 'pieces' }] });

    const values = valuesFromRecipe(recipe);

    expect(values.ingredients[0].unit).toBe('pieces');
  });

  it('should read a stored ingredient whose amount is a number or whose fields are missing', () => {
    const recipe = makeRecipe({
      ingredients: [
        { name: 'Spaghetti', amount: 400, unit: 'g' },
        { name: 'Salt', amount: null, unit: undefined },
      ] as unknown as Recipe['ingredients'],
    });

    const values = valuesFromRecipe(recipe);

    expect(values.ingredients[0]).toMatchObject({ name: 'Spaghetti', amount: '400', unit: 'g' });
    expect(values.ingredients[1]).toMatchObject({ name: 'Salt', amount: '', unit: '' });
  });

  it("should use '' for a missing caption and a missing step image", () => {
    const values = valuesFromRecipe(makeRecipe({ caption: undefined }));

    expect(values.caption).toBe('');
    expect(values.steps[0].image).toBe('');
  });
});

describe('snapshotValues', () => {
  it('should ignore row ids', () => {
    const a = makeValues();
    const b = makeValues({
      ingredients: a.ingredients.map((row) => ({ ...row, id: `other-${row.id}` })),
    });

    expect(snapshotValues(a)).toBe(snapshotValues(b));
  });

  it('should ignore trailing blank rows', () => {
    const a = makeValues();
    const b = makeValues({ steps: [...a.steps, { id: 's3', description: '', image: '' }] });

    expect(snapshotValues(a)).toBe(snapshotValues(b));
  });

  it('should change when a field changes', () => {
    expect(snapshotValues(makeValues())).not.toBe(snapshotValues(makeValues({ title: 'Other' })));
  });
});
