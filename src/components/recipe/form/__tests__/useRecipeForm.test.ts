import { act, renderHook } from '@testing-library/react';
import { Recipe } from '@/domain/types/recipe';
import { text } from '@/i18n/text';
import { RECIPE_LIMITS, UNIT_TO_TASTE } from '@/lib/constants';
import { isBlankIngredientRow } from '../formValues';
import { useRecipeForm } from '../useRecipeForm';
import { COVER_URL, makeRecipe, makeValues, STEP_URL } from './fixtures';

const renderCreate = () => renderHook(() => useRecipeForm({ resetKey: 'create' }));

const renderEdit = (recipe: Recipe = makeRecipe()) =>
  renderHook(
    ({ initial, resetKey }: { initial: Recipe; resetKey: string }) =>
      useRecipeForm({ initial, resetKey }),
    { initialProps: { initial: recipe, resetKey: recipe.id } }
  );

/** A promise whose resolution the test controls, standing in for an upload in flight */
const deferred = <T>() => {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((r) => {
    resolve = r;
  });
  return { promise, resolve };
};

describe('useRecipeForm', () => {
  describe('initial state', () => {
    it('should start a create form empty, clean and in create mode', () => {
      const { result } = renderCreate();

      expect(result.current).toMatchObject({
        mode: 'create',
        errors: {},
        touched: {},
        publishAttempted: false,
        isDirty: false,
        uploadsInFlight: 0,
      });
      expect(result.current.values).toMatchObject({ title: '', cookingTime: '', servings: 4 });
    });

    it('should prefill an edit form from the recipe', () => {
      const { result } = renderEdit();

      expect(result.current.mode).toBe('edit');
      expect(result.current.values).toMatchObject({ title: 'Chocotorta', prepTime: 10 });
      expect(result.current.values.steps.map((s) => s.description)).toEqual([
        'Mix the filling',
        'Build the layers',
      ]);
    });

    it('should not be dirty right after prefilling an edit form', () => {
      const { result } = renderEdit();

      expect(result.current.isDirty).toBe(false);
    });

    it('should treat a null recipe as a create form', () => {
      const { result } = renderHook(() => useRecipeForm({ initial: null, resetKey: 'x' }));

      expect(result.current.mode).toBe('create');
    });
  });

  describe('setField', () => {
    it('should update the field and mark the form dirty', () => {
      const { result } = renderCreate();

      act(() => result.current.setField('title', 'Empanadas'));

      expect(result.current.values.title).toBe('Empanadas');
      expect(result.current.isDirty).toBe(true);
    });

    it('should stop being dirty when the change is undone', () => {
      const { result } = renderCreate();

      act(() => result.current.setField('title', 'Empanadas'));
      act(() => result.current.setField('title', ''));

      expect(result.current.isDirty).toBe(false);
    });

    it('should keep the same values object when the value does not change', () => {
      const { result } = renderCreate();
      const before = result.current.values;

      act(() => result.current.setField('servings', 4));

      expect(result.current.values).toBe(before);
    });
  });

  describe('stale closures and async uploads', () => {
    it('should keep the text typed while a deferred step upload resolves', async () => {
      const { result } = renderCreate();
      const stepId = result.current.values.steps[0].id;
      const upload = deferred<string>();
      // ImageUpload captures the updater of the render in which the upload STARTED
      const updateFromOldRender = result.current.steps.update;
      const pending = upload.promise.then((url) => updateFromOldRender(stepId, { image: url }));

      act(() => result.current.steps.update(stepId, { description: 'Knead the dough' }));
      act(() => result.current.setField('title', 'Bread'));
      await act(async () => {
        upload.resolve(STEP_URL);
        await pending;
      });

      expect(result.current.values.steps[0]).toEqual({
        id: stepId,
        description: 'Knead the dough',
        image: STEP_URL,
      });
      expect(result.current.values.title).toBe('Bread');
    });

    it('should keep the rows added while a deferred cover upload resolves', async () => {
      const { result } = renderCreate();
      const upload = deferred<string>();
      const setFieldFromOldRender = result.current.setField;
      const pending = upload.promise.then((url) => setFieldFromOldRender('imageUrl', url));

      act(() => {
        result.current.steps.add();
      });
      await act(async () => {
        upload.resolve(COVER_URL);
        await pending;
      });

      expect(result.current.values.imageUrl).toBe(COVER_URL);
      expect(result.current.values.steps).toHaveLength(2);
    });

    it('should drop the URL when the row was removed before the upload resolved', async () => {
      const { result } = renderCreate();
      const stepId = result.current.values.steps[0].id;
      const upload = deferred<string>();
      const updateFromOldRender = result.current.steps.update;
      const pending = upload.promise.then((url) => updateFromOldRender(stepId, { image: url }));

      act(() => result.current.steps.remove(stepId));
      await act(async () => {
        upload.resolve(STEP_URL);
        await pending;
      });

      expect(result.current.values.steps).toEqual([]);
    });

    it('should keep every mutator identity stable across renders', () => {
      const { result } = renderCreate();
      const before = result.current;

      act(() => result.current.setField('title', 'Bread'));

      expect(result.current.setField).toBe(before.setField);
      expect(result.current.touch).toBe(before.touch);
      expect(result.current.setUploading).toBe(before.setUploading);
      expect(result.current.validate).toBe(before.validate);
      expect(result.current.steps.update).toBe(before.steps.update);
      expect(result.current.ingredients.update).toBe(before.ingredients.update);
    });
  });

  describe('ingredients', () => {
    it('should grow a new trailing blank row when the last row gets content', () => {
      const { result } = renderCreate();
      const firstId = result.current.values.ingredients[0].id;

      act(() => result.current.ingredients.update(firstId, { name: 'Flour' }));

      const rows = result.current.values.ingredients;
      expect(rows).toHaveLength(2);
      expect(rows[0]).toMatchObject({ id: firstId, name: 'Flour' });
      expect(isBlankIngredientRow(rows[1])).toBe(true);
    });

    it('should clear the amount when to taste is chosen', () => {
      const { result } = renderCreate();
      const id = result.current.values.ingredients[0].id;
      act(() => result.current.ingredients.update(id, { name: 'Salt', amount: '2', unit: 'g' }));

      act(() => result.current.ingredients.update(id, { unit: UNIT_TO_TASTE }));

      expect(result.current.values.ingredients[0]).toMatchObject({
        amount: '',
        unit: UNIT_TO_TASTE,
      });
    });

    it('should clear the to-taste unit when an amount is typed', () => {
      const { result } = renderCreate();
      const id = result.current.values.ingredients[0].id;
      act(() => result.current.ingredients.update(id, { name: 'Salt', unit: UNIT_TO_TASTE }));

      act(() => result.current.ingredients.update(id, { amount: '2' }));

      expect(result.current.values.ingredients[0]).toMatchObject({ amount: '2', unit: '' });
    });

    it('should never let a patch change the row id', () => {
      const { result } = renderCreate();
      const id = result.current.values.ingredients[0].id;

      act(() => result.current.ingredients.update(id, { id: 'hijacked', name: 'Salt' } as never));

      expect(result.current.values.ingredients[0].id).toBe(id);
    });

    it('should ignore an update for a row that does not exist', () => {
      const { result } = renderCreate();
      const before = result.current.values;

      act(() => result.current.ingredients.update('missing', { name: 'Ghost' }));

      expect(result.current.values).toBe(before);
    });

    it('should replace the trailing blank row when adding at the end', () => {
      const { result } = renderCreate();
      const firstId = result.current.values.ingredients[0].id;
      act(() => result.current.ingredients.update(firstId, { name: 'Flour' }));
      let newId: string | null = null;

      act(() => {
        newId = result.current.ingredients.add();
      });

      const rows = result.current.values.ingredients;
      expect(rows).toHaveLength(2);
      expect(rows[1].id).toBe(newId);
    });

    it('should insert a blank row after the given row', () => {
      const { result } = renderEdit();
      const [first, second] = result.current.values.ingredients;
      let newId: string | null = null;

      act(() => {
        newId = result.current.ingredients.add(first.id);
      });

      const rows = result.current.values.ingredients;
      expect(rows.map((row) => row.id).slice(0, 3)).toEqual([first.id, newId, second.id]);
    });

    it('should treat adding after the last filled row as adding at the end', () => {
      const { result } = renderEdit();
      const lastFilled = result.current.values.ingredients[1];

      act(() => {
        result.current.ingredients.add(lastFilled.id);
      });

      const rows = result.current.values.ingredients;
      expect(rows).toHaveLength(3);
      expect(rows.filter(isBlankIngredientRow)).toHaveLength(1);
    });

    it('should refuse to add once the list is full', () => {
      const { result } = renderCreate();
      const full = Array.from({ length: RECIPE_LIMITS.ingredients }, (_, i) => ({
        name: `Ingredient ${i}`,
        amount: '1',
        unit: 'g',
      }));
      act(() => result.current.ingredients.replaceAll(full));
      let newId: string | null = 'unset';

      act(() => {
        newId = result.current.ingredients.add();
      });

      expect(newId).toBeNull();
      expect(result.current.ingredients.canAdd).toBe(false);
      expect(result.current.values.ingredients).toHaveLength(RECIPE_LIMITS.ingredients);
    });

    it('should not grow past the limit when the last free row is filled and a row is added in one batch', () => {
      const { result } = renderCreate();
      const almostFull = Array.from({ length: RECIPE_LIMITS.ingredients - 1 }, (_, i) => ({
        name: `Ingredient ${i}`,
        amount: '1',
        unit: 'g',
      }));
      act(() => result.current.ingredients.replaceAll(almostFull));
      const trailingBlank = result.current.values.ingredients[RECIPE_LIMITS.ingredients - 1];

      act(() => {
        result.current.ingredients.update(trailingBlank.id, { name: 'The hundredth' });
        result.current.ingredients.add();
      });

      expect(result.current.values.ingredients).toHaveLength(RECIPE_LIMITS.ingredients);
      expect(result.current.values.ingredients.filter(isBlankIngredientRow)).toEqual([]);
    });

    it('should allow adding while the list has room', () => {
      const { result } = renderCreate();

      expect(result.current.ingredients.canAdd).toBe(true);
    });

    it('should remove a row and keep one trailing blank row', () => {
      const { result } = renderEdit();
      const [first] = result.current.values.ingredients;

      act(() => result.current.ingredients.remove(first.id));

      const rows = result.current.values.ingredients;
      expect(rows.map((row) => row.name)).toEqual(['Salt', '']);
    });

    it('should leave one blank row when the only row is removed', () => {
      const { result } = renderCreate();
      const onlyId = result.current.values.ingredients[0].id;

      act(() => result.current.ingredients.remove(onlyId));

      const rows = result.current.values.ingredients;
      expect(rows).toHaveLength(1);
      expect(rows[0].id).not.toBe(onlyId);
    });

    it('should ignore the removal of a row that does not exist', () => {
      const { result } = renderCreate();
      const before = result.current.values;

      act(() => result.current.ingredients.remove('missing'));

      expect(result.current.values).toBe(before);
    });

    it('should restore a removed row at its index with its original id', () => {
      const { result } = renderEdit();
      const [first] = result.current.values.ingredients;
      act(() => result.current.ingredients.remove(first.id));

      act(() => result.current.ingredients.restore(first, 0));

      expect(result.current.values.ingredients[0]).toEqual(first);
    });

    it('should not restore a row that is already in the list', () => {
      const { result } = renderEdit();
      const before = result.current.values;

      act(() => result.current.ingredients.restore(before.ingredients[0], 1));

      expect(result.current.values).toBe(before);
    });

    it('should not restore into a full list', () => {
      const { result } = renderCreate();
      const full = Array.from({ length: RECIPE_LIMITS.ingredients }, (_, i) => ({
        name: `Ingredient ${i}`,
        amount: '1',
        unit: 'g',
      }));
      act(() => result.current.ingredients.replaceAll(full));

      act(() =>
        result.current.ingredients.restore({ id: 'extra', name: 'Extra', amount: '', unit: '' }, 0)
      );

      expect(result.current.values.ingredients).toHaveLength(RECIPE_LIMITS.ingredients);
    });

    it('should give replaced rows ids and a trailing blank row', () => {
      const { result } = renderCreate();

      act(() =>
        result.current.ingredients.replaceAll([{ name: 'Flour', amount: '2', unit: 'cups' }])
      );

      const rows = result.current.values.ingredients;
      expect(rows).toHaveLength(2);
      expect(rows[0]).toMatchObject({ id: expect.any(String), name: 'Flour' });
    });
  });

  describe('steps', () => {
    it('should append a blank step and return its id', () => {
      const { result } = renderCreate();
      let newId: string | null = null;

      act(() => {
        newId = result.current.steps.add();
      });

      const rows = result.current.values.steps;
      expect(rows).toHaveLength(2);
      expect(rows[1]).toEqual({ id: newId, description: '', image: '' });
    });

    it('should insert a blank step after the given step', () => {
      const { result } = renderEdit();
      const [first, second] = result.current.values.steps;
      let newId: string | null = null;

      act(() => {
        newId = result.current.steps.add(first.id);
      });

      expect(result.current.values.steps.map((s) => s.id)).toEqual([first.id, newId, second.id]);
    });

    it('should append when the step to add after does not exist', () => {
      const { result } = renderEdit();

      act(() => {
        result.current.steps.add('missing');
      });

      expect(result.current.values.steps[2].description).toBe('');
    });

    it('should refuse to add once there are 50 steps', () => {
      const { result } = renderCreate();
      const full = Array.from({ length: RECIPE_LIMITS.steps }, (_, i) => ({
        description: `Step ${i}`,
        image: '',
      }));
      act(() => result.current.steps.replaceAll(full));
      let newId: string | null = 'unset';

      act(() => {
        newId = result.current.steps.add();
      });

      expect(newId).toBeNull();
      expect(result.current.steps.canAdd).toBe(false);
    });

    it('should not grow past 50 steps when two adds race in one batch', () => {
      const { result } = renderCreate();
      const almostFull = Array.from({ length: RECIPE_LIMITS.steps - 1 }, (_, i) => ({
        description: `Step ${i}`,
        image: '',
      }));
      act(() => result.current.steps.replaceAll(almostFull));

      act(() => {
        result.current.steps.add();
        result.current.steps.add();
      });

      expect(result.current.values.steps).toHaveLength(RECIPE_LIMITS.steps);
    });

    it('should update a step by id', () => {
      const { result } = renderEdit();
      const [, second] = result.current.values.steps;

      act(() => result.current.steps.update(second.id, { description: 'Stack them' }));

      expect(result.current.values.steps[1]).toEqual({ ...second, description: 'Stack them' });
    });

    it('should remove a step by id', () => {
      const { result } = renderEdit();
      const [first, second] = result.current.values.steps;

      act(() => result.current.steps.remove(first.id));

      expect(result.current.values.steps).toEqual([second]);
    });

    it('should ignore the removal of a step that does not exist', () => {
      const { result } = renderEdit();
      const before = result.current.values;

      act(() => result.current.steps.remove('missing'));

      expect(result.current.values).toBe(before);
    });

    it('should move a step down', () => {
      const { result } = renderEdit();
      const [first, second] = result.current.values.steps;

      act(() => result.current.steps.move(first.id, 1));

      expect(result.current.values.steps.map((s) => s.id)).toEqual([second.id, first.id]);
    });

    it('should move a step up', () => {
      const { result } = renderEdit();
      const [first, second] = result.current.values.steps;

      act(() => result.current.steps.move(second.id, -1));

      expect(result.current.values.steps.map((s) => s.id)).toEqual([second.id, first.id]);
    });

    it.each([
      ['the first step up', 0, -1 as const],
      ['the last step down', 1, 1 as const],
    ])('should not move %s', (_name, index, direction) => {
      const { result } = renderEdit();
      const before = result.current.values;

      act(() => result.current.steps.move(before.steps[index].id, direction));

      expect(result.current.values).toBe(before);
    });

    it('should ignore a move for a step that does not exist', () => {
      const { result } = renderEdit();
      const before = result.current.values;

      act(() => result.current.steps.move('missing', 1));

      expect(result.current.values).toBe(before);
    });

    it('should restore a removed step at its index with its original id', () => {
      const { result } = renderEdit();
      const [first, second] = result.current.values.steps;
      act(() => result.current.steps.remove(first.id));

      act(() => result.current.steps.restore(first, 0));

      expect(result.current.values.steps).toEqual([first, second]);
    });

    it('should clamp the restore index to the list', () => {
      const { result } = renderEdit();
      const [first, second] = result.current.values.steps;
      act(() => result.current.steps.remove(first.id));

      act(() => result.current.steps.restore(first, 99));

      expect(result.current.values.steps).toEqual([second, first]);
    });

    it('should not restore a step that is already in the list', () => {
      const { result } = renderEdit();
      const before = result.current.values;

      act(() => result.current.steps.restore(before.steps[0], 1));

      expect(result.current.values).toBe(before);
    });

    it('should not restore into a full list', () => {
      const { result } = renderCreate();
      const full = Array.from({ length: RECIPE_LIMITS.steps }, (_, i) => ({
        description: `Step ${i}`,
        image: '',
      }));
      act(() => result.current.steps.replaceAll(full));

      act(() => result.current.steps.restore({ id: 'extra', description: 'Extra', image: '' }, 0));

      expect(result.current.values.steps).toHaveLength(RECIPE_LIMITS.steps);
    });
  });

  describe('error timing', () => {
    it('should show no error at rest', () => {
      const { result } = renderCreate();

      expect(result.current.errors).toEqual({});
    });

    it('should show the error of a field on its first blur, and only that one', () => {
      const { result } = renderCreate();

      act(() => result.current.touch('title'));

      expect(result.current.errors).toEqual({ title: text('recipeForm.issues.titleRequired') });
      expect(result.current.touched).toEqual({ title: true });
    });

    it('should not show an error for a field that was never blurred while typing elsewhere', () => {
      const { result } = renderCreate();

      act(() => result.current.setField('description', 'Tasty'));

      expect(result.current.errors).toEqual({});
    });

    it('should re-validate on change while the field is in error', () => {
      const { result } = renderCreate();
      act(() => result.current.touch('title'));

      act(() => result.current.setField('title', 'Empanadas'));

      expect(result.current.errors).toEqual({});
    });

    it('should not bring an error back on change once the field is valid', () => {
      const { result } = renderCreate();
      act(() => result.current.touch('title'));
      act(() => result.current.setField('title', 'Empanadas'));

      act(() => result.current.setField('title', ''));

      expect(result.current.errors).toEqual({});
    });

    it('should bring the error back on the next blur', () => {
      const { result } = renderCreate();
      act(() => result.current.setField('title', 'Empanadas'));
      act(() => result.current.touch('title'));
      act(() => result.current.setField('title', ''));

      act(() => result.current.touch('title'));

      expect(result.current.errors.title).toEqual(text('recipeForm.issues.titleRequired'));
    });

    it('should validate an ingredient row when focus leaves the row', () => {
      const { result } = renderCreate();
      const id = result.current.values.ingredients[0].id;
      act(() => result.current.ingredients.update(id, { name: 'Flour', unit: 'g' }));

      act(() => result.current.touch(`ingredients.${id}`));

      expect(result.current.errors).toEqual({
        [`ingredients.${id}.amount`]: text('recipeForm.issues.ingredientAmountRequired', {
          named: 'yes',
          name: 'Flour',
          position: 1,
        }),
      });
    });

    it('should not turn amount and unit red on the first keystroke of the name', () => {
      const { result } = renderCreate();
      const id = result.current.values.ingredients[0].id;

      act(() => result.current.ingredients.update(id, { name: 'F' }));

      expect(result.current.errors).toEqual({});
    });

    it("should normalise the amount and fill in 'units' when focus leaves the row", () => {
      const { result } = renderCreate();
      const id = result.current.values.ingredients[0].id;
      act(() => result.current.ingredients.update(id, { name: 'Milk', amount: '1,5' }));

      act(() => result.current.touch(`ingredients.${id}`));

      expect(result.current.values.ingredients[0]).toMatchObject({ amount: '1.5', unit: 'units' });
    });

    it('should keep the values object when a blur changes nothing', () => {
      const { result } = renderEdit();
      const before = result.current.values;

      act(() => result.current.touch(`ingredients.${before.ingredients[0].id}`));

      expect(result.current.values).toBe(before);
    });

    it('should not mark a path as touched twice', () => {
      const { result } = renderCreate();
      act(() => result.current.touch('title'));
      const before = result.current.touched;

      act(() => result.current.touch('title'));

      expect(result.current.touched).toBe(before);
    });

    it('should renumber a visible step error when an earlier step is removed', () => {
      const { result } = renderCreate();
      act(() =>
        result.current.steps.replaceAll([
          { description: 'Mix', image: '' },
          { description: 'Rest', image: '' },
          { description: '', image: STEP_URL },
        ])
      );
      const [first, , third] = result.current.values.steps;
      act(() => result.current.touch(`steps.${third.id}`));

      act(() => result.current.steps.remove(first.id));

      expect(result.current.errors[`steps.${third.id}.description`]).toEqual(
        text('recipeForm.issues.stepPhotoWithoutText', { position: 2 })
      );
    });

    it('should hand the current steps to a replaceAll updater so a late photo survives', () => {
      const { result } = renderCreate();
      const [first] = result.current.values.steps;

      act(() => {
        // The photo arrives in the same batch, after the caller computed nothing yet
        result.current.steps.update(first.id, { image: STEP_URL });
        result.current.steps.replaceAll((current) =>
          current.map((row) => ({ ...row, description: 'Mix' }))
        );
      });

      expect(result.current.values.steps).toEqual([
        { id: first.id, description: 'Mix', image: STEP_URL },
      ]);
    });

    it('should forget the touched state and errors of a removed row', () => {
      const { result } = renderCreate();
      act(() => {
        result.current.steps.add();
      });
      const [first] = result.current.values.steps;
      act(() => result.current.touch(`steps.${first.id}`));

      act(() => result.current.steps.remove(first.id));

      expect(result.current.touched).toEqual({});
      expect(result.current.errors).toEqual({});
    });
  });

  describe('validate', () => {
    it('should return every issue and show every error on a failed publish', () => {
      const { result } = renderCreate();
      let issues: ReturnType<typeof result.current.validate> = [];

      act(() => {
        issues = result.current.validate();
      });

      expect(issues.map((issue) => issue.path)).toEqual([
        'title',
        'prepTime',
        'cookingTime',
        'ingredients',
        'steps',
        'imageUrl',
        'description',
      ]);
      expect(Object.keys(result.current.errors)).toEqual(issues.map((issue) => issue.path));
      expect(result.current.publishAttempted).toBe(true);
    });

    it('should return no issues for a complete recipe', () => {
      const { result } = renderEdit();
      let issues: unknown[] = ['unset'];

      act(() => {
        issues = result.current.validate();
      });

      expect(issues).toEqual([]);
      expect(result.current.errors).toEqual({});
    });

    it('should validate the values of the latest render', () => {
      const { result } = renderEdit();
      act(() => result.current.setField('title', ''));
      let issues: ReturnType<typeof result.current.validate> = [];

      act(() => {
        issues = result.current.validate();
      });

      expect(issues.map((issue) => issue.path)).toEqual(['title']);
    });

    it('should expose the hidden issues while typing', () => {
      const { result } = renderCreate();

      act(() => result.current.setField('title', 'Empanadas'));

      expect(result.current.issues.map((issue) => issue.path)).not.toContain('title');
      expect(result.current.issues.map((issue) => issue.path)).toContain('imageUrl');
    });
  });

  describe('uploadsInFlight', () => {
    it('should count each busy key once', () => {
      const { result } = renderCreate();

      act(() => {
        result.current.setUploading('imageUrl', true);
        result.current.setUploading('imageUrl', true);
        result.current.setUploading('steps.s1', true);
      });

      expect(result.current.uploadsInFlight).toBe(2);
    });

    it('should release a key when its upload ends', () => {
      const { result } = renderCreate();
      act(() => {
        result.current.setUploading('imageUrl', true);
        result.current.setUploading('other', true);
      });

      act(() => result.current.setUploading('imageUrl', false));

      expect(result.current.uploadsInFlight).toBe(1);
    });

    it('should ignore the end of an upload that was never counted', () => {
      const { result } = renderCreate();

      act(() => result.current.setUploading('imageUrl', false));

      expect(result.current.uploadsInFlight).toBe(0);
    });

    it('should release the key of a step that is removed while uploading', () => {
      const { result } = renderCreate();
      const stepId = result.current.values.steps[0].id;
      act(() => {
        result.current.setUploading(`steps.${stepId}`, true);
        result.current.setUploading('imageUrl', true);
      });

      act(() => result.current.steps.remove(stepId));

      expect(result.current.uploadsInFlight).toBe(1);
    });
  });

  describe('toPayload', () => {
    it('should build the create payload from the current values', () => {
      const { result } = renderCreate();
      act(() => result.current.setField('title', ' Empanadas '));

      const payload = result.current.toPayload();

      expect(payload).toMatchObject({ title: 'Empanadas', userId: '', caption: '' });
    });

    it('should build the edit payload without userId or row ids', () => {
      const { result } = renderEdit();

      const payload = result.current.toPayload();

      expect(payload).toEqual({
        title: 'Chocotorta',
        description: 'La clásica',
        imageUrl: COVER_URL,
        cookingTime: 30,
        prepTime: 10,
        servings: 12,
        difficulty: 'easy',
        ingredients: [
          { name: 'Chocolinas', amount: '500', unit: 'g' },
          { name: 'Salt', amount: '', unit: UNIT_TO_TASTE },
        ],
        instructions: [
          { step: 1, description: 'Mix the filling' },
          { step: 2, description: 'Build the layers', image: STEP_URL },
        ],
        caption: 'Better the next day',
      });
    });
  });

  describe('reset, resetKey and load', () => {
    it('should not re-prefill when only the identity of the recipe object changes', () => {
      const { result, rerender } = renderEdit();
      act(() => result.current.setField('title', 'My edit'));

      rerender({ initial: makeRecipe(), resetKey: 'recipe-1' });

      expect(result.current.values.title).toBe('My edit');
    });

    it('should re-initialise when resetKey changes', () => {
      const { result, rerender } = renderEdit();
      act(() => result.current.setField('title', 'My edit'));
      act(() => result.current.touch('description'));

      rerender({ initial: makeRecipe({ id: 'recipe-2', title: 'Flan' }), resetKey: 'recipe-2' });

      expect(result.current.values.title).toBe('Flan');
      expect(result.current.touched).toEqual({});
      expect(result.current.isDirty).toBe(false);
    });

    it('should go back to the latest recipe on reset', () => {
      const { result, rerender } = renderEdit();
      rerender({ initial: makeRecipe({ title: 'Refetched title' }), resetKey: 'recipe-1' });
      act(() => result.current.setField('title', 'My edit'));
      act(() => {
        result.current.validate();
      });

      act(() => result.current.reset());

      expect(result.current.values.title).toBe('Refetched title');
      expect(result.current.publishAttempted).toBe(false);
    });

    it('should empty a create form on reset', () => {
      const { result } = renderCreate();
      act(() => result.current.setField('title', 'Empanadas'));
      act(() => result.current.setUploading('imageUrl', true));

      act(() => result.current.reset());

      expect(result.current.values.title).toBe('');
      expect(result.current.uploadsInFlight).toBe(0);
      expect(result.current.isDirty).toBe(false);
    });

    it('should load draft values and mark the form dirty', () => {
      const { result } = renderCreate();
      const draft = makeValues();

      act(() => result.current.load(draft));

      expect(result.current.values.title).toBe('Chocotorta');
      expect(result.current.values.ingredients[0]).toMatchObject({ id: 'i1', name: 'Chocolinas' });
      expect(result.current.isDirty).toBe(true);
    });

    it('should give ids to loaded rows that come without one', () => {
      const { result } = renderCreate();
      const { ingredients: _i, steps: _s, ...scalars } = makeValues();

      act(() =>
        result.current.load({
          ...scalars,
          ingredients: [{ name: 'Flour', amount: '2', unit: 'cups' }],
          steps: [{ description: 'Bake', image: '' }],
        })
      );

      expect(result.current.values.ingredients[0].id).toEqual(expect.any(String));
      expect(result.current.values.steps[0].id).toEqual(expect.any(String));
    });

    it('should clear errors when values are loaded', () => {
      const { result } = renderCreate();
      act(() => {
        result.current.validate();
      });

      act(() => result.current.load(makeValues()));

      expect(result.current.errors).toEqual({});
      expect(result.current.publishAttempted).toBe(false);
    });
  });
});
