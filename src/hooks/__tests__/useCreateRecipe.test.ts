import { CreateRecipeDTO } from '@/domain/types/recipe';
import { RecipeSubmitError } from '@/lib/errors/RecipeSubmitError';
import { useCreateRecipe } from '../useCreateRecipe';

// The most a caller may hand over: userId is a placeholder (the editor's toPayload() sends
// '') and a step without a photo may carry image: '' (toPayload() already leaves it out).
// POST /api/recipes validates with a strict schema.
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

  describe('typed errors', () => {
    const failWith = (status: number, body: unknown) =>
      mockFetch.mockResolvedValue({
        ok: false,
        status,
        json: async () => body,
        headers: { get: () => null },
      });

    const createRecipe = useCreateRecipe();

    const submitError = async (): Promise<RecipeSubmitError> =>
      createRecipe(createFormData()).then(
        () => {
          throw new Error('createRecipe should have rejected');
        },
        (error) => error
      );

    it('should reject with a RecipeSubmitError', async () => {
      failWith(400, { error: 'Invalid url' });

      expect(await submitError()).toBeInstanceOf(RecipeSubmitError);
    });

    it('should flag an expired session', async () => {
      failWith(401, { error: 'Unauthorized' });

      expect(await submitError()).toMatchObject({ status: 401, code: 'unauthorized' });
    });

    it('should flag the daily recipe limit', async () => {
      failWith(429, {
        error: 'Daily recipe creation limit reached (10 per day). Please try again tomorrow.',
      });

      expect((await submitError()).code).toBe('daily_limit');
    });

    it('should flag rate limiting with the seconds to wait', async () => {
      failWith(429, { error: 'Too many requests', retryAfter: 120 });

      expect(await submitError()).toMatchObject({ code: 'rate_limited', retryAfter: 120 });
    });

    it('should flag a rejected payload and keep the server text', async () => {
      failWith(400, { error: 'Recipe validation failed: Title is required' });

      expect(await submitError()).toMatchObject({
        code: 'validation',
        message: 'Recipe validation failed: Title is required',
      });
    });

    it('should flag a server failure whose body is not JSON', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 502,
        json: async () => {
          throw new SyntaxError('Unexpected token <');
        },
      });

      expect(await submitError()).toMatchObject({
        status: 502,
        code: 'server',
        message: 'Failed to create recipe',
      });
    });

    it('should flag a request that never got a response', async () => {
      mockFetch.mockRejectedValue(new TypeError('Failed to fetch'));

      expect(await submitError()).toMatchObject({ status: 0, code: 'network' });
    });

    it('should skip onSuccess when the request never got a response', async () => {
      mockFetch.mockRejectedValue(new TypeError('Failed to fetch'));
      const onSuccess = jest.fn();
      const createRecipe = useCreateRecipe(onSuccess);

      await createRecipe(createFormData()).catch(() => undefined);

      expect(onSuccess).not.toHaveBeenCalled();
    });
  });
});
