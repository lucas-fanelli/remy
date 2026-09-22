import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import React from 'react';
import { RecipeFetchError, useRecipe } from '../useRecipe';

/**
 * What the recipe page learns when it cannot show a recipe.
 *
 * A private account's recipe used to come back as "we couldn't load the recipe" — the
 * route has answered 403 for it since it stopped being readable by direct link, and this
 * hook turned every non-404 into a load failure, then retried it for a second first.
 */

const ID = '4b9ddf7b-3525-4300-a2cf-e5c2c0ed0acc';

function load() {
  const client = new QueryClient();
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  return renderHook(() => useRecipe(ID), { wrapper });
}

const answer = (status: number, body: unknown) => ({
  ok: status < 400,
  status,
  json: async () => body,
  text: async () => JSON.stringify(body),
});

describe('useRecipe, when the recipe cannot be shown', () => {
  let mockFetch: jest.Mock;

  beforeEach(() => {
    mockFetch = global.fetch as jest.Mock;
    mockFetch.mockReset();
  });

  it('says whose it is when it belongs to a private account — it did not fail', async () => {
    mockFetch.mockResolvedValue(
      answer(403, {
        error: 'This profile is private',
        code: 'user.profilePrivate',
        author: { username: 'marta' },
      })
    );

    const { result } = load();
    await waitFor(() => expect(result.current.isError).toBe(true));

    const error = result.current.error as RecipeFetchError;
    expect(error.privateAuthor).toBe('marta');
    expect(error.descriptor).toEqual({
      key: 'recipe.states.private',
      values: { username: 'marta' },
    });
  });

  it('asks once: another try will not make a private recipe visible', async () => {
    mockFetch.mockResolvedValue(
      answer(403, { code: 'user.profilePrivate', author: { username: 'marta' } })
    );

    const { result } = load();
    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it('still calls a missing recipe missing, and asks once for that too', async () => {
    mockFetch.mockResolvedValue(answer(404, { code: 'recipe.notFound' }));

    const { result } = load();
    await waitFor(() => expect(result.current.isError).toBe(true));

    const error = result.current.error as RecipeFetchError;
    expect(error.descriptor.key).toBe('recipe.states.notFound');
    expect(error.privateAuthor).toBeNull();
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it('calls a real failure a failure', async () => {
    mockFetch.mockResolvedValue(answer(500, {}));

    const { result } = load();
    await waitFor(() => expect(result.current.isError).toBe(true), { timeout: 3000 });

    expect((result.current.error as RecipeFetchError).descriptor.key).toBe(
      'recipe.states.loadFailed'
    );
  });
});
