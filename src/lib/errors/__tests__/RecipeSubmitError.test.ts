import { RecipeSubmitError, toNetworkSubmitError, toRecipeSubmitError } from '../RecipeSubmitError';

const FALLBACK = 'Failed to create recipe';

/** The slice of a fetch Response the mapper reads */
const respond = (status: number, body: unknown, headers: Record<string, string> = {}): Response =>
  ({
    ok: false,
    status,
    json: async () => body,
    headers: { get: (name: string) => headers[name] ?? null },
  }) as unknown as Response;

describe('RecipeSubmitError', () => {
  it('should be an Error that carries status, code and retryAfter', () => {
    const error = new RecipeSubmitError('Too many requests', 429, 'rate_limited', 60);

    expect(error).toBeInstanceOf(Error);
    expect(error).toBeInstanceOf(RecipeSubmitError);
    expect(error).toMatchObject({
      name: 'RecipeSubmitError',
      message: 'Too many requests',
      status: 429,
      code: 'rate_limited',
      retryAfter: 60,
    });
  });

  it('should not define retryAfter when there is none', () => {
    const error = new RecipeSubmitError('Unauthorized', 401, 'unauthorized');

    expect(error).not.toHaveProperty('retryAfter');
  });
});

describe('toRecipeSubmitError', () => {
  it.each([
    [401, 'Unauthorized', 'unauthorized'],
    [403, 'You do not have permission to update this recipe', 'unauthorized'],
    [400, 'Recipe validation failed: Title is required', 'validation'],
    [404, 'Recipe not found', 'validation'],
    [500, 'Failed to create recipe', 'server'],
    [503, 'Service unavailable', 'server'],
  ])('should map status %i (%s) to the %s code', async (status, text, code) => {
    const error = await toRecipeSubmitError(respond(status, { error: text }), FALLBACK);

    expect(error).toMatchObject({ status, code, message: text });
  });

  it('should tell the daily recipe limit from the rate limiter by its text', async () => {
    const text = 'Daily recipe creation limit reached (10 per day). Please try again tomorrow.';

    const error = await toRecipeSubmitError(respond(429, { error: text }), FALLBACK);

    expect(error.code).toBe('daily_limit');
    expect(error).not.toHaveProperty('retryAfter');
  });

  it('should read retryAfter, in seconds, from the rate limiter body', async () => {
    const body = { error: 'Too many requests', retryAfter: 42 };

    const error = await toRecipeSubmitError(respond(429, body), FALLBACK);

    expect(error).toMatchObject({ code: 'rate_limited', retryAfter: 42 });
  });

  it('should fall back to the Retry-After header', async () => {
    const response = respond(429, { error: 'Too many requests' }, { 'Retry-After': '90' });

    const error = await toRecipeSubmitError(response, FALLBACK);

    expect(error.retryAfter).toBe(90);
  });

  it('should round a fractional retryAfter up', async () => {
    const body = { error: 'Too many requests', retryAfter: 0.2 };

    const error = await toRecipeSubmitError(respond(429, body), FALLBACK);

    expect(error.retryAfter).toBe(1);
  });

  it.each([['soon'], [-5], [null]])(
    'should leave retryAfter out when the server sends %p',
    async (retryAfter) => {
      const body = { error: 'Too many requests', retryAfter };

      const error = await toRecipeSubmitError(respond(429, body), FALLBACK);

      expect(error).not.toHaveProperty('retryAfter');
    }
  );

  it('should survive a body that is not JSON', async () => {
    const response = {
      ok: false,
      status: 502,
      json: async () => {
        throw new SyntaxError('Unexpected token <');
      },
    } as unknown as Response;

    const error = await toRecipeSubmitError(response, FALLBACK);

    expect(error).toMatchObject({ status: 502, code: 'server', message: FALLBACK });
  });

  it.each([
    ['null', null],
    ['a string', 'Bad gateway'],
    ['an object without error', { message: 'nope' }],
    ['an empty error', { error: '' }],
    ['an error that is not text', { error: { detail: 'x' } }],
  ])('should use the fallback message when the body is %s', async (_name, body) => {
    const error = await toRecipeSubmitError(respond(400, body), FALLBACK);

    expect(error.message).toBe(FALLBACK);
  });

  it('should treat a response without a status as a server failure', async () => {
    const response = { ok: false, json: async () => ({ error: 'Invalid url' }) };

    const error = await toRecipeSubmitError(response as unknown as Response, FALLBACK);

    expect(error).toMatchObject({ status: 0, code: 'server', message: 'Invalid url' });
  });

  it('should not need headers to map a rate-limited response', async () => {
    const response = { ok: false, status: 429, json: async () => ({ error: 'Too many requests' }) };

    const error = await toRecipeSubmitError(response as unknown as Response, FALLBACK);

    expect(error.code).toBe('rate_limited');
  });
});

describe('toNetworkSubmitError', () => {
  it('should keep the message of the failure', () => {
    const error = toNetworkSubmitError(new TypeError('Failed to fetch'), FALLBACK);

    expect(error).toMatchObject({ status: 0, code: 'network', message: 'Failed to fetch' });
  });

  it('should use the fallback when the failure has no message', () => {
    expect(toNetworkSubmitError(new Error(''), FALLBACK).message).toBe(FALLBACK);
  });

  it('should use the fallback when the failure is not an Error', () => {
    expect(toNetworkSubmitError('offline', FALLBACK).message).toBe(FALLBACK);
  });
});
