import { CreateRecipeDTO, UpdateRecipeDTO } from '@/domain/types/recipe';
import { UNIT_TO_TASTE } from '@/lib/constants';
import { toPayload } from '../toPayload';
import { makeValues, STEP_URL } from './fixtures';

describe('toPayload', () => {
  it('should build the create payload the API expects', () => {
    const payload = toPayload(makeValues(), 'create');

    expect(payload).toEqual({
      title: 'Chocotorta',
      description: 'La clásica',
      imageUrl: makeValues().imageUrl,
      cookingTime: 30,
      prepTime: 0,
      servings: 12,
      difficulty: 'easy',
      ingredients: [
        { name: 'Chocolinas', amount: '500', unit: 'g' },
        { name: 'Dulce de leche', amount: '400', unit: 'g' },
      ],
      instructions: [
        { step: 1, description: 'Mix the filling' },
        { step: 2, description: 'Build the layers', image: STEP_URL },
      ],
      caption: '',
      userId: '',
    });
  });

  it('should be assignable to the DTOs of both hooks', () => {
    const created: CreateRecipeDTO = toPayload(makeValues(), 'create');
    const updated: UpdateRecipeDTO = toPayload(makeValues(), 'edit');

    expect(created.userId).toBe('');
    expect(updated).not.toHaveProperty('userId');
  });

  it('should never emit a client row id', () => {
    const payload = toPayload(makeValues(), 'create');

    const rows = [...payload.ingredients, ...payload.instructions];

    rows.forEach((row) => expect(row).not.toHaveProperty('id'));
  });

  it('should strip client-only keys that leak into the values', () => {
    const values = makeValues({
      ingredients: [
        { id: 'i1', name: 'Flour', amount: '2', unit: 'cups', isEditing: true } as never,
      ],
      steps: [{ id: 's1', description: 'Bake', image: '', uploading: true } as never],
    });

    const payload = toPayload({ ...values, section: 'steps' } as never, 'edit');

    expect(payload.ingredients).toEqual([{ name: 'Flour', amount: '2', unit: 'cups' }]);
    expect(payload.instructions).toEqual([{ step: 1, description: 'Bake' }]);
    expect(payload).not.toHaveProperty('section');
  });

  it("should omit the image key of a step whose image is ''", () => {
    const payload = toPayload(makeValues(), 'create');

    expect(payload.instructions[0]).not.toHaveProperty('image');
  });

  it('should keep the image of a step that has a photo', () => {
    const payload = toPayload(makeValues(), 'create');

    expect(payload.instructions[1].image).toBe(STEP_URL);
  });

  it('should number the steps 1..n by position', () => {
    const values = makeValues({
      steps: [
        { id: 'c', description: 'Third becomes first', image: '' },
        { id: 'a', description: 'First becomes second', image: '' },
        { id: 'b', description: 'Second becomes third', image: '' },
      ],
    });

    const payload = toPayload(values, 'create');

    expect(payload.instructions.map((i) => i.step)).toEqual([1, 2, 3]);
  });

  it('should drop trailing blank steps only', () => {
    const values = makeValues({
      steps: [
        { id: 's1', description: 'Mix', image: '' },
        { id: 's2', description: '', image: '' },
        { id: 's3', description: 'Bake', image: '' },
        { id: 's4', description: '', image: '' },
        { id: 's5', description: '  ', image: '' },
      ],
    });

    const payload = toPayload(values, 'create');

    expect(payload.instructions).toEqual([
      { step: 1, description: 'Mix' },
      { step: 2, description: '' },
      { step: 3, description: 'Bake' },
    ]);
  });

  it('should keep a trailing step that only has a photo', () => {
    const values = makeValues({ steps: [{ id: 's1', description: '', image: STEP_URL }] });

    const payload = toPayload(values, 'create');

    expect(payload.instructions).toEqual([{ step: 1, description: '', image: STEP_URL }]);
  });

  it('should drop blank ingredient rows', () => {
    const values = makeValues({
      ingredients: [
        { id: 'i1', name: '', amount: '', unit: '' },
        { id: 'i2', name: 'Flour', amount: '2', unit: 'cups' },
        { id: 'i3', name: ' ', amount: '', unit: '' },
      ],
    });

    const payload = toPayload(values, 'create');

    expect(payload.ingredients).toEqual([{ name: 'Flour', amount: '2', unit: 'cups' }]);
  });

  it('should map a named row without amount or unit to the to-taste unit', () => {
    const values = makeValues({
      ingredients: [{ id: 'i1', name: 'Salt', amount: '', unit: '' }],
    });

    const payload = toPayload(values, 'create');

    expect(payload.ingredients).toEqual([{ name: 'Salt', amount: '', unit: UNIT_TO_TASTE }]);
  });

  it('should keep an explicit to-taste row as it is', () => {
    const values = makeValues({
      ingredients: [{ id: 'i1', name: 'Salt', amount: '', unit: UNIT_TO_TASTE }],
    });

    const payload = toPayload(values, 'create');

    expect(payload.ingredients).toEqual([{ name: 'Salt', amount: '', unit: UNIT_TO_TASTE }]);
  });

  it("should fill in 'units' for an amount without a unit", () => {
    const values = makeValues({
      ingredients: [{ id: 'i1', name: 'Eggs', amount: '2', unit: '' }],
    });

    const payload = toPayload(values, 'create');

    expect(payload.ingredients).toEqual([{ name: 'Eggs', amount: '2', unit: 'units' }]);
  });

  it('should normalise amounts', () => {
    const values = makeValues({
      ingredients: [{ id: 'i1', name: 'Milk', amount: '1 1/2', unit: 'cups' }],
    });

    const payload = toPayload(values, 'create');

    expect(payload.ingredients[0].amount).toBe('1.5');
  });

  it('should trim the title, the description, the caption, names and step texts', () => {
    const values = makeValues({
      title: '  Chocotorta ',
      description: ' La clásica\n',
      caption: '  Enjoy ',
      ingredients: [{ id: 'i1', name: ' Flour ', amount: '2', unit: 'cups' }],
      steps: [{ id: 's1', description: ' Line one\nLine two ', image: '' }],
    });

    const payload = toPayload(values, 'create');

    expect(payload).toMatchObject({
      title: 'Chocotorta',
      description: 'La clásica',
      caption: 'Enjoy',
      ingredients: [{ name: 'Flour' }],
      instructions: [{ description: 'Line one\nLine two' }],
    });
  });

  it("should send a blank caption as '' on create", () => {
    expect(toPayload(makeValues({ caption: '  ' }), 'create').caption).toBe('');
  });

  it('should send a blank caption as null on edit', () => {
    expect(toPayload(makeValues({ caption: '  ' }), 'edit').caption).toBeNull();
  });

  it('should keep a written caption on edit', () => {
    expect(toPayload(makeValues({ caption: 'Enjoy' }), 'edit').caption).toBe('Enjoy');
  });

  it('should not carry userId on edit, where an unknown key would be stored', () => {
    expect(toPayload(makeValues(), 'edit')).not.toHaveProperty('userId');
  });

  it('should render numbers that were not typed yet as 0 so the preview never breaks', () => {
    const values = makeValues({ prepTime: '', cookingTime: '', servings: '' });

    const payload = toPayload(values, 'create');

    expect(payload).toMatchObject({ prepTime: 0, cookingTime: 0, servings: 0 });
  });
});
