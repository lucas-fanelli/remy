import { act, renderHook } from '@testing-library/react';
import { Recipe } from '@/domain/types/recipe';
import { text as message } from '@/i18n/text';
import { parseMethod } from '@/lib/utils/recipeText';
import { StepRowValue } from '../types';
import { toDraftValues } from '../useRecipeDraft';
import { useRecipeForm } from '../useRecipeForm';
import {
  ingredientsMatchText,
  readIngredientLines,
  reconcileSteps,
  rememberOrphanTexts,
  stepsMatchText,
  useTextCapture,
  writtenLinesOf,
} from '../useTextCapture';
import { makeRecipe, makeValues, STEP_URL } from './fixtures';

const OTHER_URL = 'https://res.cloudinary.com/demo/image/upload/recipes/other.jpg';

/** Units of the old form and of the seeds: none of them is a unit the parser knows */
const LEGACY_INGREDIENTS = [
  { name: 'eggs', amount: '2', unit: 'pieces' },
  { name: 'onion', amount: '1', unit: 'whole' },
  { name: 'olive oil', amount: '80', unit: 'ml' },
];
const LEGACY_TEXT = '2 pieces eggs\n1 whole onion\n80 ml olive oil';

/** The real engine underneath: the hook is only ever used on top of it */
const renderCapture = (initial?: Recipe) =>
  renderHook(() => {
    const form = useRecipeForm({ initial, resetKey: 'test' });
    const capture = useTextCapture(form);
    return { form, capture };
  });

const filledIngredients = (rows: { name: string; amount: string; unit: string }[]) =>
  rows
    .filter((row) => row.name !== '' || row.amount !== '')
    .map(({ name, amount, unit }) => ({ name, amount, unit }));

const step = (id: string, description: string, image = ''): StepRowValue => ({
  id,
  description,
  image,
});

describe('reconcileSteps', () => {
  const parsed = (text: string) => parseMethod(text).steps;

  it('should keep the id and photo of a paragraph whose text did not change', () => {
    const current = [step('a', 'Mix'), step('b', 'Bake', STEP_URL)];

    const rows = reconcileSteps(parsed('Mix\n\nBake'), current);

    expect(rows).toEqual([
      { id: 'a', description: 'Mix', image: '' },
      { id: 'b', description: 'Bake', image: STEP_URL },
    ]);
  });

  it('should move the photo with its paragraph when a new one is written above it', () => {
    const current = [step('a', 'Mix'), step('b', 'Rest'), step('c', 'Bake', STEP_URL)];

    const rows = reconcileSteps(parsed('Mix\n\nRest\n\nGrease the tin\n\nBake'), current);

    expect(rows[2]).toEqual({ description: 'Grease the tin', image: '' });
    expect(rows[3]).toEqual({ id: 'c', description: 'Bake', image: STEP_URL });
  });

  it('should keep the photo on a paragraph that was reworded in place', () => {
    const current = [step('a', 'Mix'), step('b', 'Bake', STEP_URL)];

    const rows = reconcileSteps(parsed('Mix\n\nBake for 30 minutes'), current);

    expect(rows[1]).toEqual({ id: 'b', description: 'Bake for 30 minutes', image: STEP_URL });
  });

  it('should ignore case and spacing when it looks for the same paragraph', () => {
    const current = [step('a', 'Mix  the   filling', STEP_URL)];

    const rows = reconcileSteps(parsed('Something new\n\nmix the filling'), current);

    expect(rows[1]).toMatchObject({ id: 'a', image: STEP_URL });
  });

  it('should keep a photo whose paragraph was deleted, at the end and without text', () => {
    const current = [step('a', 'Mix', STEP_URL), step('b', 'Bake')];

    const rows = reconcileSteps(parsed('Bake'), current);

    expect(rows).toEqual([
      { id: 'b', description: 'Bake', image: '' },
      { id: 'a', description: '', image: STEP_URL },
    ]);
  });

  it('should keep every photo when the whole text is deleted', () => {
    const current = [step('a', 'Mix', STEP_URL), step('b', 'Bake', OTHER_URL), step('c', 'Eat')];

    const rows = reconcileSteps(parsed(''), current);

    expect(rows).toEqual([
      { id: 'a', description: '', image: STEP_URL },
      { id: 'b', description: '', image: OTHER_URL },
    ]);
  });

  it('should not hand an orphaned photo to a paragraph written later', () => {
    const current = [step('b', 'Bake'), step('a', '', STEP_URL)];

    const rows = reconcileSteps(parsed('Bake\n\nServe warm'), current);

    expect(rows).toEqual([
      { id: 'b', description: 'Bake', image: '' },
      { description: 'Serve warm', image: '' },
      { id: 'a', description: '', image: STEP_URL },
    ]);
  });

  it('should give each of two equal paragraphs its own row', () => {
    const current = [step('a', 'Stir', STEP_URL), step('b', 'Stir', OTHER_URL)];

    const rows = reconcileSteps(parsed('Stir\n\nStir'), current);

    expect(rows.map((row) => row.id)).toEqual(['a', 'b']);
  });

  it('should drop the blank row of an empty form', () => {
    const rows = reconcileSteps(parsed('Mix'), [step('blank', '')]);

    expect(rows).toEqual([{ description: 'Mix', image: '' }]);
  });

  describe('equal paragraphs', () => {
    const current = [
      step('a', 'Mix'),
      step('b', 'Rest'),
      step('c', 'Mix', STEP_URL),
      step('d', 'Bake'),
    ];

    it('should keep the photo on the remaining one when the first of two is deleted', () => {
      const rows = reconcileSteps(parsed('Rest\n\nMix\n\nBake'), current);

      expect(rows).toEqual([
        { id: 'b', description: 'Rest', image: '' },
        { id: 'c', description: 'Mix', image: STEP_URL },
        { id: 'd', description: 'Bake', image: '' },
      ]);
    });

    it('should not swap them when a paragraph is written above both', () => {
      const rows = reconcileSteps(parsed('Preheat\n\nMix\n\nRest\n\nMix\n\nBake'), current);

      expect(rows.map((row) => row.id)).toEqual([undefined, 'a', 'b', 'c', 'd']);
    });

    it('should keep the one with a photo when only one of two neighbours is left', () => {
      const rows = reconcileSteps(parsed('Stir'), [step('a', 'Stir'), step('b', 'Stir', STEP_URL)]);

      expect(rows).toEqual([{ id: 'b', description: 'Stir', image: STEP_URL }]);
    });
  });

  describe('a paragraph that moved', () => {
    it('should follow a paragraph that was cut and pasted below the others', () => {
      const current = [step('a', 'Alpha', STEP_URL), step('b', 'Beta'), step('c', 'Gamma')];

      const rows = reconcileSteps(parsed('Beta\n\nGamma\n\nAlpha'), current);

      expect(rows).toEqual([
        { id: 'b', description: 'Beta', image: '' },
        { id: 'c', description: 'Gamma', image: '' },
        { id: 'a', description: 'Alpha', image: STEP_URL },
      ]);
    });

    it('should take the row with a photo when two rows say what the moved paragraph says', () => {
      const current = [
        step('a', 'Stir', STEP_URL),
        step('b', 'Stir'),
        step('x', 'Rest'),
        step('y', 'Bake'),
      ];

      const rows = reconcileSteps(parsed('Rest\n\nBake\n\nStir'), current);

      expect(rows.map((row) => row.id)).toEqual(['x', 'y', 'a']);
    });

    it('should take the nearest row when neither has a photo', () => {
      const current = [step('a', 'Stir'), step('b', 'Stir'), step('x', 'Rest'), step('y', 'Bake')];

      const rows = reconcileSteps(parsed('Rest\n\nBake\n\nStir'), current);

      expect(rows.map((row) => row.id)).toEqual(['x', 'y', 'b']);
    });
  });

  describe('a photo-only row that remembers its text', () => {
    const orphanTexts = new Map([['a', 'alpha']]);

    it('should give the photo back when the paragraph is pasted somewhere else', () => {
      const current = [step('b', 'Beta'), step('c', 'Gamma'), step('a', '', STEP_URL)];

      const rows = reconcileSteps(parsed('Beta\n\nGamma\n\nAlpha'), current, orphanTexts);

      expect(rows[2]).toEqual({ id: 'a', description: 'Alpha', image: STEP_URL });
      expect(rows).toHaveLength(3);
    });

    it('should give the photo back when the deletion is undone', () => {
      const current = [step('b', 'Beta'), step('a', '', STEP_URL)];

      const rows = reconcileSteps(parsed('Alpha\n\nBeta'), current, orphanTexts);

      expect(rows).toEqual([
        { id: 'a', description: 'Alpha', image: STEP_URL },
        { id: 'b', description: 'Beta', image: '' },
      ]);
    });

    it('should still refuse a paragraph that says something else', () => {
      const current = [step('b', 'Beta'), step('a', '', STEP_URL)];

      const rows = reconcileSteps(parsed('Beta\n\nServe warm'), current, orphanTexts);

      expect(rows[1]).toEqual({ description: 'Serve warm', image: '' });
      expect(rows[2]).toEqual({ id: 'a', description: '', image: STEP_URL });
    });
  });
});

describe('rememberOrphanTexts', () => {
  it('should remember what a row said when it has just lost its paragraph', () => {
    const current = [step('a', 'Mix  the Filling', STEP_URL), step('b', 'Bake')];
    const next = [
      { id: 'b', description: 'Bake', image: '' },
      { id: 'a', description: '', image: STEP_URL },
    ];

    const remembered = rememberOrphanTexts(new Map(), current, next);

    expect(Array.from(remembered)).toEqual([['a', 'mix the filling']]);
  });

  it('should keep what it knows about a row that is still photo-only', () => {
    const current = [step('a', '', STEP_URL)];
    const next = [{ id: 'a', description: '', image: STEP_URL }];

    const remembered = rememberOrphanTexts(new Map([['a', 'alpha']]), current, next);

    expect(remembered.get('a')).toBe('alpha');
  });

  it('should know nothing about a row that was emptied by hand', () => {
    const current = [step('a', '', STEP_URL)];
    const next = [{ id: 'a', description: '', image: STEP_URL }];

    const remembered = rememberOrphanTexts(new Map(), current, next);

    expect(remembered.size).toBe(0);
  });

  it('should forget a row that has its paragraph again, and rows that are gone', () => {
    const current = [step('a', '', STEP_URL), step('z', '', OTHER_URL)];
    const next = [
      { id: 'a', description: 'Alpha', image: STEP_URL },
      { description: 'New', image: '' },
    ];

    const remembered = rememberOrphanTexts(
      new Map([
        ['a', 'alpha'],
        ['z', 'zeta'],
      ]),
      current,
      next
    );

    expect(remembered.size).toBe(0);
  });
});

describe('readIngredientLines', () => {
  const values = (rows: { name: string; amount: string; unit: string }[]) =>
    rows.map(({ name, amount, unit }) => ({ name, amount, unit }));

  it('should parse a line that was not written from a row', () => {
    expect(readIngredientLines('2 tazas de leche').rows).toEqual([
      { name: 'leche', amount: '2', unit: 'cups', reason: null },
    ]);
  });

  it('should read a line that was written from a row as that row, unit included', () => {
    const written = writtenLinesOf(LEGACY_INGREDIENTS);

    expect(values(readIngredientLines(LEGACY_TEXT, written).rows)).toEqual(LEGACY_INGREDIENTS);
  });

  it('should read the lines between the written ones with the parser', () => {
    const written = writtenLinesOf(LEGACY_INGREDIENTS);

    const { rows } = readIngredientLines('2 pieces eggs\n1 tsp salt\n1 whole onion', written);

    expect(values(rows)).toEqual([
      LEGACY_INGREDIENTS[0],
      { name: 'salt', amount: '1', unit: 'tsp' },
      LEGACY_INGREDIENTS[1],
    ]);
  });

  it('should take a change of case for an edit of the line', () => {
    const written = writtenLinesOf([{ name: 'eggs', amount: '2', unit: 'pieces' }]);

    expect(values(readIngredientLines('2 pieces Eggs', written).rows)).toEqual([
      { name: 'pieces Eggs', amount: '2', unit: 'units' },
    ]);
  });

  it('should not mind the spacing of a written line', () => {
    const written = writtenLinesOf([{ name: 'olive  oil', amount: '80', unit: 'ml' }]);

    expect(values(readIngredientLines('  80 ml   olive oil ', written).rows)).toEqual([
      { name: 'olive  oil', amount: '80', unit: 'ml' },
    ]);
  });

  it('should hand out two rows that were written as the same line in their order', () => {
    const rows = [
      { name: 'eggs', amount: '2', unit: 'pieces' },
      { name: 'pieces eggs', amount: '2', unit: 'units' },
    ];

    const read = readIngredientLines('2 pieces eggs\n2 pieces eggs', writtenLinesOf(rows));

    expect(values(read.rows)).toEqual(rows);
  });

  it('should read a further copy of a written line like the row it was copied from', () => {
    const written = writtenLinesOf([{ name: 'eggs', amount: '2', unit: 'pieces' }]);

    const read = readIngredientLines('2 pieces eggs\n2 pieces eggs', written);

    expect(read.rows.map((row) => row.unit)).toEqual(['pieces', 'pieces']);
  });

  it('should doubt a parsed line and never a written one', () => {
    const written = writtenLinesOf([{ name: 'lata de tomate', amount: '1', unit: 'units' }]);

    const read = readIngredientLines('1 lata de tomate\n3 dientes de ajo', written);

    expect(read.rows.map((row) => row.reason)).toEqual([
      null,
      message('recipeParser.reasons.unknownContainer', { word: 'dientes' }),
    ]);
  });

  it('should know no line of a blank row', () => {
    expect(writtenLinesOf([{ name: '', amount: '', unit: '' }]).size).toBe(0);
  });

  it('should say when the text holds more lines than a recipe has ingredients', () => {
    const text = Array.from({ length: 101 }, (_, index) => `${index + 1} g cosa`).join('\n');

    expect(readIngredientLines(text).capped).toBe(true);
  });
});

describe('ingredientsMatchText', () => {
  const rows = makeValues().ingredients;

  it('should match the lines the rows were written as, whatever the parser makes of them', () => {
    const written = writtenLinesOf(LEGACY_INGREDIENTS);

    expect(ingredientsMatchText(LEGACY_INGREDIENTS, LEGACY_TEXT, written)).toBe(true);
  });

  it('should not match rows with a unit the parser does not know when nothing was written', () => {
    expect(ingredientsMatchText(LEGACY_INGREDIENTS, LEGACY_TEXT)).toBe(false);
  });

  it('should match the text the rows were read from, whatever its wording', () => {
    expect(ingredientsMatchText(rows, '500 gr de Chocolinas\n- 400 g Dulce de leche')).toBe(true);
  });

  it('should not match once a row was edited', () => {
    const edited = rows.map((row) => (row.id === 'i1' ? { ...row, amount: '600' } : row));

    expect(ingredientsMatchText(edited, '500 g Chocolinas\n400 g Dulce de leche')).toBe(false);
  });

  it('should not match once a row was added', () => {
    expect(ingredientsMatchText(rows, '500 g Chocolinas')).toBe(false);
  });

  it('should treat a row that is still to be normalised like its normalised form', () => {
    const typed = [{ id: 'i1', name: 'papas', amount: '1,5', unit: 'kg' }];

    expect(ingredientsMatchText(typed, '1,5 kg papas')).toBe(true);
  });

  it("should treat the explicit 'to taste' unit like no amount and no unit", () => {
    const explicit = [{ id: 'i1', name: 'sal', amount: '', unit: 'to taste' }];

    expect(ingredientsMatchText(explicit, 'sal a gusto')).toBe(true);
  });
});

describe('stepsMatchText', () => {
  it('should match numbered text against the bare steps', () => {
    expect(stepsMatchText(makeValues().steps, '1. Mix the filling\n\n2. Build the layers')).toBe(
      true
    );
  });

  it('should ignore steps that only hold a photo', () => {
    const steps = [...makeValues().steps, step('s3', '', STEP_URL)];

    expect(stepsMatchText(steps, 'Mix the filling\n\nBuild the layers')).toBe(true);
  });

  it('should not match once a step was reworded', () => {
    expect(stepsMatchText(makeValues().steps, 'Mix\n\nBuild the layers')).toBe(false);
  });
});

describe('useTextCapture', () => {
  describe('text -> rows', () => {
    it('should start a new recipe with empty texts', () => {
      const { result } = renderCapture();

      expect(result.current.capture.ingredientsText).toBe('');
      expect(result.current.capture.methodText).toBe('');
    });

    it('should turn the ingredient lines into rows at once', () => {
      const { result } = renderCapture();

      act(() => result.current.capture.setIngredientsText('500 g harina\n2 huevos\nsal a gusto'));

      expect(filledIngredients(result.current.form.values.ingredients)).toEqual([
        { name: 'harina', amount: '500', unit: 'g' },
        { name: 'huevos', amount: '2', unit: 'units' },
        { name: 'sal', amount: '', unit: '' },
      ]);
    });

    it('should keep the blank row the row editor expects at the end', () => {
      const { result } = renderCapture();

      act(() => result.current.capture.setIngredientsText('500 g harina'));

      const rows = result.current.form.values.ingredients;
      expect(rows).toHaveLength(2);
      expect(rows[1]).toMatchObject({ name: '', amount: '', unit: '' });
    });

    it('should flag the rows the parser was unsure about, by row id', () => {
      const { result } = renderCapture();

      act(() => result.current.capture.setIngredientsText('500 g harina\n1 lata de tomate'));

      const [, lata] = result.current.form.values.ingredients;
      expect(result.current.capture.checks).toEqual({
        [lata.id]: message('recipeParser.reasons.unknownContainer', { word: 'lata' }),
      });
      expect(result.current.capture.checkCount).toBe(1);
    });

    it('should not make a flagged row an error', () => {
      const { result } = renderCapture();

      act(() => result.current.capture.setIngredientsText('1 lata de tomate'));

      const ingredientIssues = result.current.form.issues.filter(
        (issue) => issue.section === 'ingredients'
      );
      expect(ingredientIssues).toEqual([]);
    });

    it('should drop the flag of a row once it is confirmed', () => {
      const { result } = renderCapture();
      act(() => result.current.capture.setIngredientsText('1 lata de tomate'));
      const [lata] = result.current.form.values.ingredients;

      act(() => result.current.capture.confirmRow(lata.id));

      expect(result.current.capture.checks).toEqual({});
    });

    it('should ignore the confirmation of a row that carries no flag', () => {
      const { result } = renderCapture();
      act(() => result.current.capture.setIngredientsText('500 g harina'));
      const before = result.current.capture.checks;

      act(() => result.current.capture.confirmRow('unknown'));

      expect(result.current.capture.checks).toBe(before);
    });

    it('should forget the flag of a row that was removed on the other tab', () => {
      const { result } = renderCapture();
      act(() => result.current.capture.setIngredientsText('1 lata de tomate\n2 huevos'));
      const [lata] = result.current.form.values.ingredients;

      act(() => result.current.form.ingredients.remove(lata.id));

      expect(result.current.capture.checkCount).toBe(0);
    });

    it('should say when more than 100 lines were typed', () => {
      const { result } = renderCapture();
      const text = Array.from({ length: 101 }, (_, index) => `${index + 1} g cosa`).join('\n');

      act(() => result.current.capture.setIngredientsText(text));

      expect(result.current.capture.ingredientsCapped).toBe(true);
    });

    it('should turn the paragraphs into steps at once', () => {
      const { result } = renderCapture();

      act(() => result.current.capture.setMethodText('1. Mezclar\n2. Hornear'));

      expect(result.current.form.values.steps.map((row) => row.description)).toEqual([
        'Mezclar',
        'Hornear',
      ]);
    });

    it('should say when more than 50 paragraphs were typed', () => {
      const { result } = renderCapture();
      const text = Array.from({ length: 51 }, (_, index) => `Paso ${index + 1}: algo`).join('\n');

      act(() => result.current.capture.setMethodText(text));

      expect(result.current.capture.stepsCapped).toBe(true);
    });

    it('should keep a step photo on its step when a paragraph is written above it', () => {
      const { result } = renderCapture();
      act(() => result.current.capture.setMethodText('Mix\n\nRest\n\nBake'));
      const bake = result.current.form.values.steps[2];
      act(() => result.current.form.steps.update(bake.id, { image: STEP_URL }));

      act(() => result.current.capture.setMethodText('Mix\n\nRest\n\nGrease the tin\n\nBake'));

      expect(result.current.form.values.steps[3]).toEqual({
        id: bake.id,
        description: 'Bake',
        image: STEP_URL,
      });
    });

    it('should never delete a photo when paragraphs are deleted', () => {
      const { result } = renderCapture();
      act(() => result.current.capture.setMethodText('Mix\n\nBake'));
      const mix = result.current.form.values.steps[0];
      act(() => result.current.form.steps.update(mix.id, { image: STEP_URL }));

      act(() => result.current.capture.setMethodText('Bake'));

      expect(result.current.form.values.steps).toEqual([
        expect.objectContaining({ description: 'Bake', image: '' }),
        { id: mix.id, description: '', image: STEP_URL },
      ]);
      expect(result.current.form.issues.map((issue) => issue.message)).toContainEqual(
        message('recipeForm.issues.stepPhotoWithoutText', { position: 2 })
      );
    });

    /** Three steps, the first one with a photo */
    const writeWithPhotoOnFirst = (text: string) => {
      const view = renderCapture();
      act(() => view.result.current.capture.setMethodText(text));
      const first = view.result.current.form.values.steps[0];
      act(() => view.result.current.form.steps.update(first.id, { image: STEP_URL }));
      return { ...view, first };
    };

    it('should move the photo with a paragraph that is cut and then pasted at the end', () => {
      const { result, first } = writeWithPhotoOnFirst('Alpha\n\nBeta\n\nGamma');

      act(() => result.current.capture.setMethodText('Beta\n\nGamma'));
      act(() => result.current.capture.setMethodText('Beta\n\nGamma\n\nAlpha'));

      expect(result.current.form.values.steps).toEqual([
        expect.objectContaining({ description: 'Beta', image: '' }),
        expect.objectContaining({ description: 'Gamma', image: '' }),
        { id: first.id, description: 'Alpha', image: STEP_URL },
      ]);
    });

    it('should give the photo back when the deletion of its paragraph is undone', () => {
      const { result, first } = writeWithPhotoOnFirst('1. Alpha\n2. Beta');

      act(() => result.current.capture.setMethodText('1. \n2. Beta'));
      act(() => result.current.capture.setMethodText('1. Alpha\n2. Beta'));

      expect(result.current.form.values.steps).toEqual([
        { id: first.id, description: 'Alpha', image: STEP_URL },
        expect.objectContaining({ description: 'Beta', image: '' }),
      ]);
    });

    it('should give the photo back to a paragraph that is typed again letter by letter', () => {
      const { result, first } = writeWithPhotoOnFirst('Alpha\n\nBeta');
      act(() => result.current.capture.setMethodText('Beta'));

      ['Beta\n\nA', 'Beta\n\nAl', 'Beta\n\nAlpha'].forEach((text) => {
        act(() => result.current.capture.setMethodText(text));
      });

      expect(result.current.form.values.steps).toEqual([
        expect.objectContaining({ description: 'Beta', image: '' }),
        { id: first.id, description: 'Alpha', image: STEP_URL },
      ]);
    });

    it('should keep the photo on the second of two equal steps when the first is deleted', () => {
      const { result } = renderCapture();
      act(() => result.current.capture.setMethodText('Mix\n\nRest\n\nMix\n\nBake'));
      const second = result.current.form.values.steps[2];
      act(() => result.current.form.steps.update(second.id, { image: STEP_URL }));

      act(() => result.current.capture.setMethodText('Rest\n\nMix\n\nBake'));

      expect(result.current.form.values.steps).toEqual([
        expect.objectContaining({ description: 'Rest', image: '' }),
        { id: second.id, description: 'Mix', image: STEP_URL },
        expect.objectContaining({ description: 'Bake', image: '' }),
      ]);
    });
  });

  describe('rows -> text', () => {
    it('should write an existing recipe as text', () => {
      const { result } = renderCapture(makeRecipe());

      expect(result.current.capture.ingredientsText).toBe('500 g Chocolinas\nSalt');
      expect(result.current.capture.methodText).toBe('1. Mix the filling\n\n2. Build the layers');
    });

    it('should not touch the recipe when its text is only looked at', () => {
      const { result } = renderCapture(makeRecipe());

      act(() => result.current.capture.syncFromRows());

      expect(result.current.form.isDirty).toBe(false);
    });

    it('should keep the wording while the rows still say the same', () => {
      const { result } = renderCapture();
      act(() => result.current.capture.setIngredientsText('2 tazas de leche'));

      act(() => result.current.capture.syncFromRows());

      expect(result.current.capture.ingredientsText).toBe('2 tazas de leche');
    });

    it('should rewrite the ingredients after a row was edited by hand', () => {
      const { result } = renderCapture();
      act(() => result.current.capture.setIngredientsText('2 tazas de leche\n2 huevos'));
      const [leche] = result.current.form.values.ingredients;
      act(() => result.current.form.ingredients.update(leche.id, { amount: '3' }));

      act(() => result.current.capture.syncFromRows());

      expect(result.current.capture.ingredientsText).toBe('3 cups leche\n2 huevos');
    });

    it('should rewrite the method after a step was edited by hand', () => {
      const { result } = renderCapture();
      act(() => result.current.capture.setMethodText('Mezclar\nHornear'));
      const [mezclar] = result.current.form.values.steps;
      act(() => result.current.form.steps.update(mezclar.id, { description: 'Mezclar bien' }));

      act(() => result.current.capture.syncFromRows());

      expect(result.current.capture.methodText).toBe('1. Mezclar bien\n\n2. Hornear');
    });

    it('should leave the method alone when only the ingredients were edited', () => {
      const { result } = renderCapture();
      act(() => {
        result.current.capture.setIngredientsText('2 huevos');
        result.current.capture.setMethodText('Mezclar\nHornear');
      });
      const [huevos] = result.current.form.values.ingredients;
      act(() => result.current.form.ingredients.update(huevos.id, { amount: '3' }));

      act(() => result.current.capture.syncFromRows());

      expect(result.current.capture.methodText).toBe('Mezclar\nHornear');
    });

    it('should drop the cap notice once the text is rewritten from the rows', () => {
      const { result } = renderCapture();
      const text = Array.from({ length: 101 }, (_, index) => `${index + 1} g cosa`).join('\n');
      act(() => result.current.capture.setIngredientsText(text));
      const [first] = result.current.form.values.ingredients;
      act(() => result.current.form.ingredients.remove(first.id));

      act(() => result.current.capture.syncFromRows());

      expect(result.current.capture.ingredientsCapped).toBe(false);
    });

    it('should not doubt again a line it wrote from a row the author settled', () => {
      const { result } = renderCapture();
      act(() => result.current.capture.setIngredientsText('1 lata de tomate'));
      const [lata] = result.current.form.values.ingredients;
      act(() => {
        result.current.form.ingredients.update(lata.id, { amount: '2' });
        result.current.capture.confirmRow(lata.id);
      });
      act(() => result.current.capture.syncFromRows());

      act(() => result.current.capture.setIngredientsText('2 lata de tomate\n3 dientes de ajo'));

      const [, ajo] = result.current.form.values.ingredients;
      expect(Object.keys(result.current.capture.checks)).toEqual([ajo.id]);
    });

    it('should hand the draft a text that agrees with the rows', () => {
      const { result } = renderCapture();
      act(() => result.current.capture.setIngredientsText('2 tazas de leche'));
      const [leche] = result.current.form.values.ingredients;

      act(() => result.current.form.ingredients.update(leche.id, { amount: '3' }));

      expect(result.current.capture.draftText.ingredients).toBe('3 cups leche');
    });

    it('should hand the draft the wording itself while it still fits', () => {
      const { result } = renderCapture();

      act(() => result.current.capture.setMethodText('Mezclar\nHornear'));

      expect(result.current.capture.draftText.method).toBe('Mezclar\nHornear');
    });
  });

  describe('lines written from rows', () => {
    const renderLegacy = () => renderCapture(makeRecipe({ ingredients: LEGACY_INGREDIENTS }));

    it('should leave the rows of an existing recipe alone when a line is added', () => {
      const { result } = renderLegacy();

      act(() => result.current.capture.setIngredientsText(`${LEGACY_TEXT}\n1 tsp salt`));

      expect(filledIngredients(result.current.form.values.ingredients)).toEqual([
        ...LEGACY_INGREDIENTS,
        { name: 'salt', amount: '1', unit: 'tsp' },
      ]);
      expect(result.current.capture.checkCount).toBe(0);
    });

    it('should call the recipe unchanged again once an edit of its text is undone', () => {
      const { result } = renderLegacy();
      act(() => result.current.capture.setIngredientsText(`${LEGACY_TEXT}s`));

      act(() => result.current.capture.setIngredientsText(LEGACY_TEXT));

      expect(result.current.form.isDirty).toBe(false);
    });

    it('should give the rows back when their lines are cut and pasted back', () => {
      const { result } = renderLegacy();
      act(() => result.current.capture.setIngredientsText(''));

      act(() => result.current.capture.setIngredientsText(LEGACY_TEXT));

      expect(filledIngredients(result.current.form.values.ingredients)).toEqual(LEGACY_INGREDIENTS);
    });

    it('should keep the wording of the new lines when the text is looked at again', () => {
      const { result } = renderLegacy();
      act(() => result.current.capture.setIngredientsText(`${LEGACY_TEXT}\n1 cucharadita de sal`));

      act(() => result.current.capture.syncFromRows());

      expect(result.current.capture.ingredientsText).toBe(`${LEGACY_TEXT}\n1 cucharadita de sal`);
    });

    it('should read a line it wrote from a row edited by hand as that row', () => {
      const { result } = renderCapture();
      act(() => result.current.capture.setIngredientsText('2 cup noodles'));
      const [noodles] = result.current.form.values.ingredients;
      act(() => {
        result.current.form.ingredients.update(noodles.id, { name: 'cup noodles', unit: 'units' });
        result.current.capture.confirmRow(noodles.id);
      });
      act(() => result.current.capture.syncFromRows());

      act(() => result.current.capture.setIngredientsText('2 cup noodles\n2 huevos'));

      expect(filledIngredients(result.current.form.values.ingredients)).toEqual([
        { name: 'cup noodles', amount: '2', unit: 'units' },
        { name: 'huevos', amount: '2', unit: 'units' },
      ]);
    });

    it('should parse every line again after Start over', () => {
      const { result } = renderLegacy();
      act(() => result.current.capture.clear());

      act(() => result.current.capture.setIngredientsText('2 pieces eggs'));

      expect(filledIngredients(result.current.form.values.ingredients)).toEqual([
        { name: 'pieces eggs', amount: '2', unit: 'units' },
      ]);
    });
  });

  describe('load', () => {
    const draftValues = () =>
      toDraftValues(
        makeValues({
          ingredients: [
            { id: 'x1', name: 'harina', amount: '500', unit: 'g' },
            { id: 'x2', name: 'lata de tomate', amount: '1', unit: 'units' },
          ],
          steps: [
            { id: 'y1', description: 'Mezclar', image: STEP_URL },
            { id: 'y2', description: 'Hornear', image: '' },
          ],
        })
      );

    it('should load the values into the form', () => {
      const { result } = renderCapture();

      act(() => result.current.capture.load(draftValues()));

      expect(result.current.form.values.title).toBe('Chocotorta');
      expect(result.current.form.values.steps[0]).toMatchObject({ image: STEP_URL });
    });

    it('should bring the wording back while it still fits the rows', () => {
      const { result } = renderCapture();
      const text = { ingredients: '500 gr harina\n1 lata de tomate', method: 'Mezclar\nHornear' };

      act(() => result.current.capture.load(draftValues(), text));

      expect(result.current.capture.ingredientsText).toBe(text.ingredients);
      expect(result.current.capture.methodText).toBe(text.method);
    });

    it('should flag again what the parser was unsure about', () => {
      const { result } = renderCapture();
      const text = { ingredients: '500 gr harina\n1 lata de tomate', method: 'Mezclar\nHornear' };

      act(() => result.current.capture.load(draftValues(), text));

      const [, lata] = result.current.form.values.ingredients;
      expect(result.current.capture.checks).toEqual({
        [lata.id]: message('recipeParser.reasons.unknownContainer', { word: 'lata' }),
      });
    });

    it('should write the texts from the rows when the stored wording no longer fits', () => {
      const { result } = renderCapture();
      const text = { ingredients: '400 g harina', method: 'Todo junto' };

      act(() => result.current.capture.load(draftValues(), text));

      expect(result.current.capture.ingredientsText).toBe('500 g harina\n1 lata de tomate');
      expect(result.current.capture.methodText).toBe('1. Mezclar\n\n2. Hornear');
      expect(result.current.capture.checks).toEqual({});
    });

    it('should write the texts from the rows of a draft that stores no wording', () => {
      const { result } = renderCapture();

      act(() => result.current.capture.load(draftValues()));

      expect(result.current.capture.ingredientsText).toBe('500 g harina\n1 lata de tomate');
    });

    it('should read the lines it wrote from the rows of a draft as those rows', () => {
      const { result } = renderCapture();
      const values = toDraftValues(
        makeValues({ ingredients: [{ id: 'x1', name: 'cup noodles', amount: '2', unit: 'units' }] })
      );
      act(() => result.current.capture.load(values));

      act(() => result.current.capture.setIngredientsText('2 cup noodles\n2 huevos'));

      expect(filledIngredients(result.current.form.values.ingredients)[0]).toEqual({
        name: 'cup noodles',
        amount: '2',
        unit: 'units',
      });
    });

    it('should parse the wording of a draft that still fits its rows', () => {
      const { result } = renderCapture();
      const text = { ingredients: '500 gr harina\n1 lata de tomate', method: 'Mezclar\nHornear' };
      act(() => result.current.capture.load(draftValues(), text));

      act(() => result.current.capture.setIngredientsText(`${text.ingredients}\n2 huevos`));

      expect(result.current.capture.checkCount).toBe(1);
    });
  });

  describe('clear', () => {
    it('should empty both texts and forget the flags', () => {
      const { result } = renderCapture();
      act(() => {
        result.current.capture.setIngredientsText('1 lata de tomate');
        result.current.capture.setMethodText('Mezclar');
      });

      act(() => result.current.capture.clear());

      expect(result.current.capture).toMatchObject({
        ingredientsText: '',
        methodText: '',
        checks: {},
      });
    });
  });
});
