import { ThemeProvider, createTheme } from '@mui/material/styles';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { ToastProvider } from '@/contexts/ToastContext';
import SearchPage from '../page';
import '@testing-library/jest-dom';

/**
 * The search page had no tests at all, which is why moving its read changed nothing that
 * anything noticed. These are the two failures worth holding it to.
 */

let mockQuery = 'tostadas';
const mockPush = jest.fn();
jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush, refresh: jest.fn() }),
  useSearchParams: () => ({ get: (key: string) => (key === 'q' ? mockQuery : null) }),
}));

let mockSearchReader: { id: string; username: string } | null = null;
jest.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({ user: mockSearchReader }),
}));

jest.mock('@/components/recipe/RecipeCard', () => {
  return function MockRecipeCard({
    recipe,
    onLike,
    onSave,
  }: {
    recipe: { title: string };
    onLike?: () => void;
    onSave?: () => void;
  }) {
    return (
      <div data-testid="result">
        <span>{recipe.title}</span>
        {onLike && <button onClick={onLike}>Like</button>}
        {onSave && <button onClick={onSave}>Save</button>}
      </div>
    );
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

  it('shows where the results will be while it searches, not an empty area', () => {
    // The P2 plan asked every screen moved onto the cache to replace its blank loading
    // state; this one was moved and kept rendering nothing under its tabs.
    mockFetch.mockReturnValue(new Promise(() => {}));

    renderPage(new QueryClient({ defaultOptions: { queries: { retry: false } } }));

    expect(screen.getByRole('status', { name: 'Loading...' })).toBeInTheDocument();
    // And no count on the tabs: "(0)" is an answer, and there is none yet.
    expect(screen.getByText('Recipes')).toBeInTheDocument();
    expect(screen.queryByText('Recipes (0)')).not.toBeInTheDocument();
  });

  it('counts the results on the tabs once there are some', async () => {
    mockFetch.mockResolvedValue(respond([recipe('t', 'Tostadas'), recipe('u', 'Tostadas II')]));

    renderPage(new QueryClient({ defaultOptions: { queries: { retry: false } } }));

    expect(await screen.findByText('Recipes (2)')).toBeInTheDocument();
    expect(screen.getByText('Users (0)')).toBeInTheDocument();
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

describe('a search result card', () => {
  it('can be saved from the results, like every card', async () => {
    mockSearchReader = { id: 'u1', username: 'reader' };
    const mockFetch = global.fetch as jest.Mock;
    mockFetch.mockReset();
    mockQuery = 'tostadas';
    mockFetch.mockImplementation((url: string) =>
      url.includes('/save')
        ? Promise.resolve({ ok: true, json: async () => ({ saved: true }) })
        : Promise.resolve(respond([recipe('t', 'Tostadas')]))
    );

    renderPage(new QueryClient({ defaultOptions: { queries: { retry: false } } }));
    fireEvent.click(await screen.findByRole('button', { name: 'Save' }));

    await waitFor(() =>
      expect(mockFetch).toHaveBeenCalledWith(
        '/api/recipes/t/save',
        expect.objectContaining({ body: JSON.stringify({ saved: true }) })
      )
    );
    mockSearchReader = null;
  });
});

// Private accounts are found too: one nobody can find is one nobody can ask to follow.
describe('the Users tab', () => {
  const found = [
    { username: 'ana_cocina', fullName: 'Ana', isPrivate: true },
    { username: 'beto', fullName: 'Beto', isPrivate: false },
  ];

  async function openUsersTab() {
    const mockFetch = global.fetch as jest.Mock;
    mockFetch.mockReset();
    mockPush.mockClear();
    mockQuery = 'a';
    mockFetch.mockResolvedValue({ ok: true, json: async () => ({ users: found, recipes: [] }) });

    renderPage(new QueryClient({ defaultOptions: { queries: { retry: false } } }));
    fireEvent.click(await screen.findByText('Users (2)'));
    await screen.findByText('ana_cocina');
  }

  const cardOf = (username: string) => screen.getByText(username).closest('.MuiCard-root');

  it('marks a private account with a lock that is read as well as seen', async () => {
    await openUsersTab();

    const lock = screen.getByRole('img', { name: 'Private Account' });
    expect(cardOf('ana_cocina')).toContainElement(lock);
    // One lock, on the private account only.
    expect(screen.getAllByRole('img', { name: 'Private Account' })).toHaveLength(1);
    expect(cardOf('beto')).not.toContainElement(lock);
  });

  it('offers no follow button on a private account, as Instagram does not', async () => {
    // The request is made from the profile, where the reader can see who they are asking.
    await openUsersTab();

    expect(screen.queryByRole('button', { name: /follow|request/i })).not.toBeInTheDocument();
  });

  it('opens the private account’s profile when it is tapped, where the lock explains itself', async () => {
    await openUsersTab();

    fireEvent.click(screen.getByText('ana_cocina'));

    expect(mockPush).toHaveBeenCalledWith('/profile/ana_cocina');
  });

  it('draws no lock for a row that does not say it is private', async () => {
    // An answer without the flag reads as public. The profile still decides what is shown.
    const mockFetch = global.fetch as jest.Mock;
    mockFetch.mockReset();
    mockQuery = 'c';
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ users: [{ username: 'caro' }], recipes: [] }),
    });

    renderPage(new QueryClient({ defaultOptions: { queries: { retry: false } } }));
    fireEvent.click(await screen.findByText('Users (1)'));
    await screen.findByText('caro');

    expect(screen.queryByRole('img', { name: 'Private Account' })).not.toBeInTheDocument();
  });
});
