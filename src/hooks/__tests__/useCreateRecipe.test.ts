import { CreateRecipeDTO } from '@/domain/types/recipe';
import { useCreateRecipe } from '../useCreateRecipe';

// What CreateRecipeForm.handleSubmit builds: userId is a placeholder and steps
// without a photo carry image: ''. POST /api/recipes validates with a strict schema.
const createFormData = (overrides: Partial<CreateRecipeDTO> = {}): CreateRecipeDTO => ({
  title: 'Chocotorta',
  description: 'La clásica',
  imageUrl: 'https://res.cloudinary.com/demo/image/upload/recipes/cover.jpg',
  userId: '',
  cookingTime: 30,
  prepTime: 5,
  servings: 12,
  difficulty: 'easy',
  caption: '',
  ingredients: [{ name: 'Chocolinas', amount: '500', unit: 'g' }],
  instructions: [{ step: 1, description: 'Armar las capas', image: '' }],
  ...overrides,
});

describe('useCreateRecipe', () => {
  let mockFetch: jest.Mock;

  const sentBody = () => JSON.parse(mockFetch.mock.calls[0][1].body);

  beforeEach(() => {
    mockFetch = global.fetch as jest.Mock;
    mockFetch.mockReset();
    mockFetch.mockResolvedValue({ ok: true, json: async () => ({ recipe: { id: 'r1' } }) });
  });

  it('should not send userId, which the strict API schema rejects', async () => {
    const createRecipe = useCreateRecipe();

    await createRecipe(createFormData());

    expect(sentBody()).not.toHaveProperty('userId');
  });

  it('should omit the image of steps that have no photo', async () => {
    const createRecipe = useCreateRecipe();

    await createRecipe(createFormData());

    expect(sentBody().instructions).toEqual([{ step: 1, description: 'Armar las capas' }]);
  });

  it('should keep the image of steps that have a photo', async () => {
    const image = 'https://res.cloudinary.com/demo/image/upload/recipes/step.jpg';
    const createRecipe = useCreateRecipe();

    await createRecipe(
      createFormData({ instructions: [{ step: 1, description: 'Armar las capas', image }] })
    );

    expect(sentBody().instructions).toEqual([{ step: 1, description: 'Armar las capas', image }]);
  });

  it('should send the headers required by the CSRF middleware', async () => {
    const createRecipe = useCreateRecipe();

    await createRecipe(createFormData());

    expect(mockFetch).toHaveBeenCalledWith(
      '/api/recipes',
      expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'fetch' },
      })
    );
  });

  it('should call onSuccess and return the created recipe', async () => {
    const onSuccess = jest.fn();
    const createRecipe = useCreateRecipe(onSuccess);

    const result = await createRecipe(createFormData());

    expect(onSuccess).toHaveBeenCalledTimes(1);
    expect(result).toEqual({ recipe: { id: 'r1' } });
  });

  it('should throw the API error message and skip onSuccess when the request fails', async () => {
    mockFetch.mockResolvedValue({ ok: false, json: async () => ({ error: 'Invalid url' }) });
    const onSuccess = jest.fn();
    const createRecipe = useCreateRecipe(onSuccess);

    await expect(createRecipe(createFormData())).rejects.toThrow('Invalid url');
    expect(onSuccess).not.toHaveBeenCalled();
  });
});
