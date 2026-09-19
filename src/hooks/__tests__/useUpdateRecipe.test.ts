import { UpdateRecipeDTO } from '@/domain/types/recipe';
import { RecipeSubmitError } from '@/lib/errors/RecipeSubmitError';
import { useUpdateRecipe } from '../useUpdateRecipe';

const RECIPE_ID = '123e4567-e89b-12d3-a456-426614174000';
const STEP_IMAGE = 'https://res.cloudinary.com/demo/image/upload/recipes/step.jpg';

// What the recipe form's toPayload() builds in edit mode
const createUpdateData = (overrides: Partial<UpdateRecipeDTO> = {}): UpdateRecipeDTO => ({
  title: 'Chocotorta',
  description: 'La clásica',
  imageUrl: 'https://res.cloudinary.com/demo/image/upload/recipes/cover.jpg',
  cookingTime: 30,
  prepTime: 5,
  servings: 12,
  difficulty: 'easy',
  caption: null,
  ingredients: [{ name: 'Chocolinas', amount: '500', unit: 'g' }],
  instructions: [{ step: 1, description: 'Armar las capas' }],
  ...overrides,
});

describe('useUpdateRecipe', () => {
  let mockFetch: jest.Mock;

  const sentBody = () => JSON.parse(mockFetch.mock.calls[0][1].body);

  beforeEach(() => {
    mockFetch = global.fetch as jest.Mock;
    mockFetch.mockReset();
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ recipe: { id: RECIPE_ID }, message: 'Recipe updated successfully' }),
    });
  });

  it('should PUT to the recipe with the headers required by the CSRF middleware', async () => {
    const updateRecipe = useUpdateRecipe();

    await updateRecipe(RECIPE_ID, createUpdateData());

    expect(mockFetch).toHaveBeenCalledWith(
      `/api/recipes/${RECIPE_ID}`,
      expect.objectContaining({
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'fetch' },
      })
    );
  });

  it('should send the update as the body', async () => {
    const updateRecipe = useUpdateRecipe();

    await updateRecipe(RECIPE_ID, createUpdateData());

    expect(sentBody()).toEqual(createUpdateData());
  });

  it('should send a cleared closing note as null', async () => {
    const updateRecipe = useUpdateRecipe();

    await updateRecipe(RECIPE_ID, createUpdateData({ caption: null }));

    expect(sentBody().caption).toBeNull();
  });

  it('should not send keys the API does not know, because PUT would store them', async () => {
    const leaky = {
      ...createUpdateData(),
      userId: 'someone-else',
      section: 'steps',
      ingredients: [{ id: 'row-1', name: 'Chocolinas', amount: '500', unit: 'g' }],
      instructions: [{ id: 'row-2', step: 1, description: 'Armar las capas', uploading: true }],
    } as unknown as UpdateRecipeDTO;
    const updateRecipe = useUpdateRecipe();

    await updateRecipe(RECIPE_ID, leaky);

    expect(sentBody()).toEqual(createUpdateData());
  });

  it('should omit the image of steps that have no photo', async () => {
    const updateRecipe = useUpdateRecipe();

    await updateRecipe(
      RECIPE_ID,
      createUpdateData({ instructions: [{ step: 1, description: 'Armar las capas', image: '' }] })
    );

    expect(sentBody().instructions).toEqual([{ step: 1, description: 'Armar las capas' }]);
  });

  it('should keep the image of steps that have a photo', async () => {
    const instructions = [{ step: 1, description: 'Armar las capas', image: STEP_IMAGE }];
    const updateRecipe = useUpdateRecipe();

    await updateRecipe(RECIPE_ID, createUpdateData({ instructions }));

    expect(sentBody().instructions).toEqual(instructions);
  });

  it('should send only the fields of a partial update', async () => {
    const updateRecipe = useUpdateRecipe();

    await updateRecipe(RECIPE_ID, { title: 'Only the title' });

    expect(sentBody()).toEqual({ title: 'Only the title' });
  });

  it('should call onSuccess with the updated recipe and return the response', async () => {
    const onSuccess = jest.fn();
    const updateRecipe = useUpdateRecipe(onSuccess);

    const result = await updateRecipe(RECIPE_ID, createUpdateData());

    expect(onSuccess).toHaveBeenCalledWith({ id: RECIPE_ID });
    expect(result).toEqual({ recipe: { id: RECIPE_ID }, message: 'Recipe updated successfully' });
  });

  it('should throw the API error message and skip onSuccess when the request fails', async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 400,
      json: async () => ({ error: 'Recipe validation failed: Title is required' }),
    });
    const onSuccess = jest.fn();
    const updateRecipe = useUpdateRecipe(onSuccess);

    await expect(updateRecipe(RECIPE_ID, createUpdateData())).rejects.toThrow(
      'Recipe validation failed: Title is required'
    );
    expect(onSuccess).not.toHaveBeenCalled();
  });

  it.each([
    [401, 'Unauthorized', 'unauthorized'],
    [403, 'You do not have permission to update this recipe', 'unauthorized'],
    [404, 'Recipe not found', 'validation'],
    [429, 'Too many requests', 'rate_limited'],
    [500, 'Failed to update recipe', 'server'],
  ])('should map a %i (%s) with the same mapper as create: %s', async (status, error, code) => {
    mockFetch.mockResolvedValue({ ok: false, status, json: async () => ({ error }) });
    const updateRecipe = useUpdateRecipe();

    const rejection = await updateRecipe(RECIPE_ID, createUpdateData()).catch((e) => e);

    expect(rejection).toBeInstanceOf(RecipeSubmitError);
    expect(rejection).toMatchObject({ status, code, message: error });
  });

  it('should use its own fallback message when the failure has no JSON body', async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 502,
      json: async () => {
        throw new SyntaxError('Unexpected token <');
      },
    });
    const updateRecipe = useUpdateRecipe();

    await expect(updateRecipe(RECIPE_ID, createUpdateData())).rejects.toThrow(
      'Failed to update recipe'
    );
  });

  it('should flag a request that never got a response', async () => {
    mockFetch.mockRejectedValue(new TypeError('Failed to fetch'));
    const updateRecipe = useUpdateRecipe();

    const rejection = await updateRecipe(RECIPE_ID, createUpdateData()).catch((e) => e);

    expect(rejection).toMatchObject({ status: 0, code: 'network' });
  });
});
