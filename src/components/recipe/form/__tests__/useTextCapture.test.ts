import { act, renderHook } from '@testing-library/react';
import { Recipe } from '@/domain/types/recipe';
import { parseMethod } from '@/lib/utils/recipeText';
import { StepRowValue } from '../types';
import { toDraftValues } from '../useRecipeDraft';
import { useRecipeForm } from '../useRecipeForm';
import {
  ingredientsMatchText,
  reconcileSteps,
  stepsMatchText,
  useTextCapture,
} from '../useTextCapture';
import { makeRecipe, makeValues, STEP_URL } from './fixtures';

const OTHER_URL = 'https://res.cloudinary.com/demo/image/upload/recipes/other.jpg';

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
});

describe('ingredientsMatchText', () => {
  const rows = makeValues().ingredients;

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
        [lata.id]: 'No unit recognised - is "lata" part of the name?',
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
      expect(result.current.form.issues.map((issue) => issue.message)).toContain(
        'Step 2 has a photo but no text - describe it or remove the step'
      );
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
        [lata.id]: 'No unit recognised - is "lata" part of the name?',
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
