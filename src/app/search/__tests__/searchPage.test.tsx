import { ThemeProvider, createTheme } from '@mui/material/styles';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { ToastProvider } from '@/contexts/ToastContext';
import SearchPage from '../page';
import '@testing-library/jest-dom';

/**
 * The search page had no tests at all, which is why moving its read changed nothing that
 * anything noticed. These are the two failures worth holding it to.
 */

let mockQuery = 'tostadas';
jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: jest.fn(), refresh: jest.fn() }),
  useSearchParams: () => ({ get: (key: string) => (key === 'q' ? mockQuery : null) }),
}));

jest.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({ user: null }),
}));

jest.mock('@/components/recipe/RecipeCard', () => {
  return function MockRecipeCard({ recipe }: { recipe: { title: string } }) {
    return <div data-testid="result">{recipe.title}</div>;
  };
});

const recipe = (id: string, title: string) => ({
  id,
  title,
  description: '',
  imageUrl: '',
  difficulty: 'easy',
  prepTime: 1,
  cookingTime: 1,
  servings: 1,
  userId: 'u',
  likeCount: 0,
  commentCount: 0,
  viewer: null,
  author: { username: 'u' },
});

const respond = (recipes: unknown[]) => ({ ok: true, json: async () => ({ users: [], recipes }) });

function renderPage(queryClient: QueryClient) {
  return render(
    <QueryClientProvider client={queryClient}>
      <ThemeProvider theme={createTheme()}>
        <ToastProvider>
          <SearchPage />
        </ToastProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

describe('the search page', () => {
  let mockFetch: jest.Mock;

  beforeEach(() => {
    mockFetch = global.fetch as jest.Mock;
    mockFetch.mockReset();
    mockQuery = 'tostadas';
  });

  it('shows the results for what the URL says, even when an older search answers last', async () => {
    // Reproduced in a browser before this was fixed: searching "tostadas" (made slow) then
    // "empanadas" left the URL saying `empanadas` and the page showing five Tostadas. The
    // effect that fetched had no abort and no stale check, so the last answer to ARRIVE
    // won, not the last one ASKED.
    let releaseSlow: () => void = () => {};
    mockFetch.mockImplementation((url: string) => {
      if (url.includes('q=tostadas')) {
        return new Promise((resolve) => {
          releaseSlow = () => resolve(respond([recipe('t', 'Tostadas')]));
        });
      }
      return Promise.resolve(respond([recipe('e', 'Empanadas')]));
    });

    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const view = renderPage(queryClient);

    // The reader changes their mind before the first search answers.
    mockQuery = 'empanadas';
    view.rerender(
      <QueryClientProvider client={queryClient}>
        <ThemeProvider theme={createTheme()}>
          <ToastProvider>
            <SearchPage />
          </ToastProvider>
        </ThemeProvider>
      </QueryClientProvider>
    );

    await waitFor(() => expect(screen.getByText('Empanadas')).toBeInTheDocument());

    // Now the stale answer arrives.
    await act(async () => {
      releaseSlow();
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    expect(screen.getByText('Empanadas')).toBeInTheDocument();
    expect(screen.queryByText('Tostadas')).not.toBeInTheDocument();
  });

  it('says the search failed rather than that nothing matched', async () => {
    // "We found no recipes matching" is a confident claim. A 500 used to make it.
    mockFetch.mockResolvedValue({ ok: false, json: async () => ({}) });

    renderPage(new QueryClient({ defaultOptions: { queries: { retry: false } } }));

    await waitFor(() => expect(screen.getByText(/could not run the search/i)).toBeInTheDocument());
    expect(screen.queryByText(/no recipes/i)).not.toBeInTheDocument();
  });
});
