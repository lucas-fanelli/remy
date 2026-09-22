import { ThemeProvider, createTheme } from '@mui/material/styles';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor, fireEvent, act, configure } from '@testing-library/react';
import React from 'react';
import '@testing-library/jest-dom';
import { AuthProvider } from '@/contexts/AuthContext';
import { ToastProvider } from '@/contexts/ToastContext';
import { queryKeys } from '@/lib/query/keys';
import RecipeFeed from '../RecipeFeed';

// Speed up waitFor - needs longer timeout for multiple sequential async operations
configure({ asyncUtilTimeout: 250 });

// TODO: Centralize this framer-motion mock into a shared file (e.g., src/__mocks__/framer-motion.ts)
// and use jest.config moduleNameMapper to apply it globally across all test files.
// Mock framer-motion - comprehensive mock supporting all patterns
jest.mock('framer-motion', () => {
  const mockMotion: any = (component: any) => component;
  mockMotion.create = (component: any) => component;
  mockMotion.div = ({
    children,
    initial,
    animate,
    exit,
    transition,
    whileHover,
    whileTap,
    ...props
  }: any) => <div {...props}>{children}</div>;

  return {
    motion: mockMotion,
    AnimatePresence: ({ children, mode }: any) => <>{children}</>,
  };
});

// Mock next/navigation
const mockPush = jest.fn();
jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
  }),
}));

// Mock AuthContext
const mockUseAuth = jest.fn();
jest.mock('@/contexts/AuthContext', () => ({
  ...jest.requireActual('@/contexts/AuthContext'),
  useAuth: () => mockUseAuth(),
  AuthProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

// Mock RecipeCard component.
//
// It renders `viewer` and `likeCount` into the DOM on purpose. The mock used to destructure
// only the callbacks and throw the rest away, which meant the feed could hand every card a
// heart that said `false` — as it did — and every test here would still pass.
jest.mock('../RecipeCard', () => {
  return function MockRecipeCard({
    recipe,
    viewer,
    href,
    onLike,
    onComment,
    onEdit,
    onDelete,
  }: any) {
    return (
      <div data-testid={`recipe-card-${recipe.id}`}>
        {/* A link, because the real card's title is one now — the feed's navigation is an
            anchor rather than a handler, and a mock that still rendered a button would
            hide that from every test in this file. */}
        <a href={href ?? `/recipe/${recipe.id}`}>{recipe.title}</a>
        <div data-testid={`viewer-liked-${recipe.id}`}>
          {viewer === null ? 'signed-out' : String(viewer?.liked)}
        </div>
        {/* The counts ride on the recipe now, not as sibling props. */}
        <div data-testid={`like-count-${recipe.id}`}>{String(recipe.likeCount)}</div>
        <div data-testid={`comment-count-${recipe.id}`}>{String(recipe.commentCount)}</div>
        <button onClick={onLike}>Like</button>
        <button onClick={onComment}>Comment</button>
        {onEdit && <button onClick={onEdit}>Edit</button>}
        {onDelete && <button onClick={onDelete}>Delete</button>}
      </div>
    );
  };
});

// Mock EditRecipeModal component
jest.mock('../EditRecipeModal', () => {
  return function MockEditRecipeModal({ open, recipe, onClose, onSuccess }: any) {
    if (!open) return null;
    return (
      <div data-testid="edit-recipe-modal">
        <div>Editing: {recipe?.title}</div>
        <button onClick={onClose}>Close</button>
        <button onClick={() => onSuccess({ ...recipe, title: 'Updated Recipe' })}>Save</button>
      </div>
    );
  };
});

const mockTheme = createTheme();

/**
 * The feed's list is in the React Query cache now, and its like goes through the shared
 * mutation layer, so it needs both providers. `retry: false` keeps a failure test from
 * waiting out a retry, and a fresh client per render keeps one test's pages out of the
 * next test's cache.
 */
const renderWithProviders = (
  component: React.ReactElement,
  queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
) => {
  let result: any;
  act(() => {
    result = render(
      <QueryClientProvider client={queryClient}>
        <ThemeProvider theme={mockTheme}>
          <ToastProvider>{component}</ToastProvider>
        </ThemeProvider>
      </QueryClientProvider>
    );
  });
  return result;
};

const mockRecipe = {
  id: '1',
  userId: 'user1',
  title: 'Test Recipe 1',
  description: 'Description 1',
  imageUrl: '/recipe1.jpg',
  prepTime: 10,
  cookingTime: 20,
  servings: 4,
  difficulty: 'easy',
  cuisine: 'Italian',
  ingredients: [],
  instructions: [],
  tags: [],
  isPublic: true,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

// IntersectionObserver mock for infinite scroll
let intersectionCallback: IntersectionObserverCallback;
const mockObserve = jest.fn();
const mockDisconnect = jest.fn();

describe('RecipeFeed Component', () => {
  let mockFetch: jest.Mock;

  beforeEach(() => {
    mockFetch = global.fetch as jest.Mock;
    mockFetch.mockClear();
    mockPush.mockClear();
    mockUseAuth.mockReturnValue({ token: null, user: null }); // Default to no token

    // Mock IntersectionObserver
    (global as any).IntersectionObserver = jest.fn((callback) => {
      intersectionCallback = callback;
      return { observe: mockObserve, disconnect: mockDisconnect, unobserve: jest.fn() };
    });
  });

  afterEach(async () => {
    // Wait for all pending fetch calls to complete to eliminate act() warnings
    // Check if fetch calls are still pending by waiting for call count to stabilize
    let previousCallCount = -1;
    let currentCallCount = mockFetch.mock.calls.length;
    let attempts = 0;
    const maxAttempts = 20;

    while (previousCallCount !== currentCallCount && attempts < maxAttempts) {
      previousCallCount = currentCallCount;
      await act(async () => {});
      currentCallCount = mockFetch.mock.calls.length;
      attempts++;
    }

    // Final flush to ensure all state updates complete
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
  });

  const setupSuccessfulFetch = (recipes = [mockRecipe]) => {
    // Engagement data — including who the reader is and what they already did — comes with
    // the recipe. Anything not given here stands in for what the API actually sends.
    const recipesWithEngagement = recipes.map((r: any) => ({
      likeCount: 0,
      commentCount: 0,
      viewer: null,
      ...r,
    }));
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ recipes: recipesWithEngagement }),
    });
  };

  // Helper to wait for all fetch calls including engagement data
  const waitForAllFetches = async (expectedCalls: number) => {
    await waitFor(
      () => {
        expect(mockFetch).toHaveBeenCalledTimes(expectedCalls);
      },
      { timeout: 3000 }
    );
    // Additional flush to ensure all state updates from fetches complete
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
  };

  // Helper to wait for component loading to complete
  const waitForLoadingComplete = async (container: HTMLElement) => {
    // Wait for any content to appear (loading returns null now)
    await waitFor(
      () => {
        expect(screen.queryByText('Discover Recipes')).toBeInTheDocument();
      },
      { timeout: 3000 }
    );
    // Additional flush to ensure all state updates complete
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
  };

  it('should render loading state initially as null content', () => {
    mockFetch.mockImplementation(() => new Promise(() => {}));

    const { container } = renderWithProviders(<RecipeFeed />);

    // Loading state now renders null for the loading skeleton area
    // Discover Recipes heading should still be present
    expect(screen.getByText('Discover Recipes')).toBeInTheDocument();
  });

  it('should fetch and display recipes', async () => {
    setupSuccessfulFetch();

    renderWithProviders(<RecipeFeed />);

    await waitFor(() => {
      expect(screen.getByText('Test Recipe 1')).toBeInTheDocument();
    });
  });

  it('should handle fetch failure gracefully', async () => {
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    mockFetch.mockRejectedValueOnce(new Error('Failed to fetch'));

    renderWithProviders(<RecipeFeed />);

    // Component should still render the discover recipes heading even on error
    await waitFor(() => {
      expect(screen.getByText('Discover Recipes')).toBeInTheDocument();
    });

    consoleErrorSpy.mockRestore();
  });

  it('should render Discover Recipes heading', async () => {
    setupSuccessfulFetch();

    const { container } = renderWithProviders(<RecipeFeed />);

    expect(screen.getByText('Discover Recipes')).toBeInTheDocument();

    // Wait for loading to complete to avoid act() warnings
    await waitForLoadingComplete(container);
  });

  it('should render New recipe button when onCreateRecipe prop is provided', async () => {
    setupSuccessfulFetch();
    const mockOnCreateRecipe = jest.fn();

    renderWithProviders(<RecipeFeed onCreateRecipe={mockOnCreateRecipe} />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /^new recipe$/i })).toBeInTheDocument();
    });
  });

  it('should call onCreateRecipe when New recipe button is clicked', async () => {
    setupSuccessfulFetch();
    const mockOnCreateRecipe = jest.fn();

    renderWithProviders(<RecipeFeed onCreateRecipe={mockOnCreateRecipe} />);

    await waitFor(() => {
      const createButton = screen.getByRole('button', { name: /^new recipe$/i });
      fireEvent.click(createButton);
    });

    expect(mockOnCreateRecipe).toHaveBeenCalled();
  });

  it('should render filter controls', async () => {
    setupSuccessfulFetch();

    renderWithProviders(<RecipeFeed />);

    // Filters section should be present
    expect(screen.getByText('Filters')).toBeInTheDocument();

    // Wait for recipes to load
    await waitFor(() => {
      expect(screen.getByText('Test Recipe 1')).toBeInTheDocument();
    });
  });

  it('should show no recipes message when no recipes found', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ recipes: [] }),
    });

    renderWithProviders(<RecipeFeed />);

    await waitFor(() => {
      expect(screen.getByText('No recipes found')).toBeInTheDocument();
    });
  });

  it('should render create button in empty state', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ recipes: [] }),
    });

    const mockOnCreateRecipe = jest.fn();
    renderWithProviders(<RecipeFeed onCreateRecipe={mockOnCreateRecipe} />);

    await waitFor(() => {
      expect(screen.getByText('No recipes found')).toBeInTheDocument();
    });

    const createButtons = screen.getAllByRole('button', { name: /publish your first recipe/i });
    expect(createButtons.length).toBeGreaterThan(0);
  });

  it('should show end of feed message when all recipes loaded', async () => {
    setupSuccessfulFetch();

    renderWithProviders(<RecipeFeed />);

    await waitFor(() => {
      expect(screen.getByText('Test Recipe 1')).toBeInTheDocument();
    });

    await waitFor(() => {
      expect(screen.getByText(/you've reached the end/i)).toBeInTheDocument();
    });
  });

  it('should reach the recipe detail through a link, not a scripted push', async () => {
    // The feed is the primary navigation of the app and it used to be a click handler on
    // a card: no new tab, no href, nothing announced as a link.
    setupSuccessfulFetch();

    renderWithProviders(<RecipeFeed />);

    await waitFor(() => {
      expect(screen.getByText('Test Recipe 1')).toBeInTheDocument();
    });

    expect(screen.getByRole('link', { name: 'Test Recipe 1' })).toHaveAttribute(
      'href',
      '/recipe/1'
    );
  });

  it('should navigate to comment section when comment button is clicked', async () => {
    setupSuccessfulFetch();

    renderWithProviders(<RecipeFeed />);

    await waitFor(() => {
      expect(screen.getByText('Test Recipe 1')).toBeInTheDocument();
    });

    const commentButton = screen.getByRole('button', { name: /comment/i });
    fireEvent.click(commentButton);

    expect(mockPush).toHaveBeenCalledWith('/recipe/1#comments');
  });

  it('should open delete dialog when delete button is clicked', async () => {
    setupSuccessfulFetch();

    renderWithProviders(<RecipeFeed />);

    await waitFor(() => {
      expect(screen.getByText('Test Recipe 1')).toBeInTheDocument();
    });

    const deleteButton = screen.getByRole('button', { name: /delete/i });
    fireEvent.click(deleteButton);

    await waitFor(() => {
      expect(screen.getByText('Delete selected recipe?')).toBeInTheDocument();
    });
  });

  it('should close delete dialog when cancel is clicked', async () => {
    setupSuccessfulFetch();

    renderWithProviders(<RecipeFeed />);

    await waitFor(() => {
      expect(screen.getByText('Test Recipe 1')).toBeInTheDocument();
    });

    const deleteButton = screen.getByRole('button', { name: /delete/i });
    fireEvent.click(deleteButton);

    await waitFor(() => {
      expect(screen.getByText('Delete selected recipe?')).toBeInTheDocument();
    });

    const cancelButton = screen.getByRole('button', { name: /^cancel$/i });
    fireEvent.click(cancelButton);

    await waitFor(() => {
      expect(screen.queryByText('Delete selected recipe?')).not.toBeInTheDocument();
    });
  });

  it('should open edit modal when edit button is clicked', async () => {
    setupSuccessfulFetch();

    renderWithProviders(<RecipeFeed />);

    await waitFor(() => {
      expect(screen.getByText('Test Recipe 1')).toBeInTheDocument();
    });

    const editButton = screen.getByRole('button', { name: /edit/i });
    fireEvent.click(editButton);

    await waitFor(() => {
      expect(screen.getByTestId('edit-recipe-modal')).toBeInTheDocument();
    });
  });

  it('should close edit modal when close button is clicked', async () => {
    setupSuccessfulFetch();

    renderWithProviders(<RecipeFeed />);

    await waitFor(() => {
      expect(screen.getByText('Test Recipe 1')).toBeInTheDocument();
    });

    const editButton = screen.getByRole('button', { name: /edit/i });
    fireEvent.click(editButton);

    await waitFor(() => {
      expect(screen.getByTestId('edit-recipe-modal')).toBeInTheDocument();
    });

    const closeButton = screen.getByRole('button', { name: /close/i });
    fireEvent.click(closeButton);

    await waitFor(() => {
      expect(screen.queryByTestId('edit-recipe-modal')).not.toBeInTheDocument();
    });
  });

  it('should update recipe in list when edit is successful', async () => {
    setupSuccessfulFetch();

    renderWithProviders(<RecipeFeed />);

    await waitFor(() => {
      expect(screen.getByText('Test Recipe 1')).toBeInTheDocument();
    });

    const editButton = screen.getByRole('button', { name: /edit/i });
    fireEvent.click(editButton);

    await waitFor(() => {
      expect(screen.getByTestId('edit-recipe-modal')).toBeInTheDocument();
    });

    const saveButton = screen.getByRole('button', { name: /save/i });
    fireEvent.click(saveButton);

    await waitFor(() => {
      expect(screen.getByText(/recipe updated successfully/i)).toBeInTheDocument();
    });
  });

  it('should filter by difficulty', async () => {
    setupSuccessfulFetch();

    renderWithProviders(<RecipeFeed />);

    await waitFor(() => {
      expect(screen.getByText('Test Recipe 1')).toBeInTheDocument();
    });

    setupSuccessfulFetch([{ ...mockRecipe, difficulty: 'easy' }]);

    const difficultySelect = screen.getAllByRole('combobox')[0]; // Difficulty is first (after removing cuisine)
    fireEvent.mouseDown(difficultySelect);

    const easyOption = await screen.findByText('Easy');
    fireEvent.click(easyOption);

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('difficulty=easy'),
        expect.anything()
      );
    });

    // Wait for all skeleton loaders to disappear (indicates async operations completed)
    await waitFor(
      () => {
        const skeletons = screen.queryAllByTestId('recipe-skeleton');
        expect(skeletons.length).toBe(0);
      },
      { timeout: 3000 }
    );

    // Flush all pending promises to prevent act() warnings
    await act(async () => {});
  });

  it('should filter by max time', async () => {
    setupSuccessfulFetch();

    renderWithProviders(<RecipeFeed />);

    await waitFor(() => {
      expect(screen.getByText('Test Recipe 1')).toBeInTheDocument();
    });

    setupSuccessfulFetch([mockRecipe]);

    const maxTimeSelect = screen.getAllByRole('combobox')[1]; // Max Time is second (after removing cuisine)
    fireEvent.mouseDown(maxTimeSelect);

    const under30Option = await screen.findByText('Under 30 min');
    fireEvent.click(under30Option);

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('maxTime=30'),
        expect.anything()
      );
    });

    // Wait for all skeleton loaders to disappear (indicates async operations completed)
    await waitFor(
      () => {
        const skeletons = screen.queryAllByTestId('recipe-skeleton');
        expect(skeletons.length).toBe(0);
      },
      { timeout: 3000 }
    );

    // Flush all pending promises to prevent act() warnings
    await act(async () => {});
  });

  it('should show clear filters button when filters are active', async () => {
    setupSuccessfulFetch();

    renderWithProviders(<RecipeFeed />);

    await waitFor(() => {
      expect(screen.getByText('Test Recipe 1')).toBeInTheDocument();
    });

    setupSuccessfulFetch([mockRecipe]);

    // Apply a filter
    // Wait for selects to render
    await waitFor(() => {
      const selects = screen.queryAllByRole('combobox');
      expect(selects.length).toBeGreaterThan(0);
    });
    const difficultySelect = screen.getAllByRole('combobox')[0]; // Difficulty is first
    fireEvent.mouseDown(difficultySelect);

    const easyOption = await screen.findByText('Easy');
    fireEvent.click(easyOption);

    // Clear button should appear
    await waitFor(() => {
      expect(screen.getByText('Clear')).toBeInTheDocument();
    });

    // Wait for all skeleton loaders to disappear (indicates async operations completed)
    await waitFor(
      () => {
        const skeletons = screen.queryAllByTestId('recipe-skeleton');
        expect(skeletons.length).toBe(0);
      },
      { timeout: 3000 }
    );

    // Flush all pending promises to prevent act() warnings
    await act(async () => {});
  });

  it('should clear all filters when clear button is clicked', async () => {
    setupSuccessfulFetch();

    renderWithProviders(<RecipeFeed />);

    await waitFor(() => {
      expect(screen.getByText('Test Recipe 1')).toBeInTheDocument();
    });

    setupSuccessfulFetch([mockRecipe]);

    // Apply filters
    // Wait for selects to render
    await waitFor(() => {
      const selects = screen.queryAllByRole('combobox');
      expect(selects.length).toBeGreaterThan(0);
    });
    const difficultySelect = screen.getAllByRole('combobox')[0]; // Difficulty is first
    fireEvent.mouseDown(difficultySelect);
    const easyOption = await screen.findByText('Easy');
    fireEvent.click(easyOption);

    await waitFor(() => {
      expect(screen.getByText('Clear')).toBeInTheDocument();
    });

    setupSuccessfulFetch([mockRecipe]);

    // Click clear
    const clearButton = screen.getByText('Clear');
    fireEvent.click(clearButton);

    // Filters should reset
    await waitFor(() => {
      expect(screen.queryByText('Clear')).not.toBeInTheDocument();
    });

    // Wait for all skeleton loaders to disappear (indicates async operations completed)
    await waitFor(
      () => {
        const skeletons = screen.queryAllByTestId('recipe-skeleton');
        expect(skeletons.length).toBe(0);
      },
      { timeout: 3000 }
    );

    // Flush all pending promises to prevent act() warnings
    await act(async () => {});
  });

  it('should delete recipe successfully', async () => {
    mockUseAuth.mockReturnValue({ token: null, user: { id: 'user1' } });
    setupSuccessfulFetch();

    renderWithProviders(<RecipeFeed />);

    await waitFor(() => {
      expect(screen.getByText('Test Recipe 1')).toBeInTheDocument();
    });

    const deleteButton = screen.getByRole('button', { name: /delete/i });
    fireEvent.click(deleteButton);

    await waitFor(() => {
      expect(screen.getByText('Delete selected recipe?')).toBeInTheDocument();
    });

    // Mock delete API call
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({}),
    });

    const confirmButton = screen.getByRole('button', { name: /^delete$/i });
    fireEvent.click(confirmButton);

    await waitFor(() => {
      expect(screen.getByText(/recipe deleted successfully/i)).toBeInTheDocument();
    });
  });

  it('takes a deleted recipe off every cached list, not only the feed', async () => {
    // The feed's delete filtered the feed's own pages and nothing else, so the recipe stayed
    // on its author's profile — and in the pantry matches shown beside this very feed.
    mockUseAuth.mockReturnValue({ token: null, user: { id: 'user1' } });
    setupSuccessfulFetch();
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
    queryClient.setQueryData(queryKeys.profile('author'), {
      visibility: 'public',
      user: { id: 'u', username: 'author' },
      stats: { recipesCount: 1, followersCount: 0, followingCount: 0 },
      recipes: [{ id: mockRecipe.id }],
      savedRecipes: [],
      isFollowing: null,
    });

    renderWithProviders(<RecipeFeed />, queryClient);
    await waitFor(() => {
      expect(screen.getByText('Test Recipe 1')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /delete/i }));
    await waitFor(() => {
      expect(screen.getByText('Delete selected recipe?')).toBeInTheDocument();
    });
    mockFetch.mockResolvedValueOnce({ ok: true, json: async () => ({}) });
    fireEvent.click(screen.getByRole('button', { name: /^delete$/i }));

    await waitFor(() => {
      expect(screen.getByText(/recipe deleted successfully/i)).toBeInTheDocument();
    });
    const profile = queryClient.getQueryData<{ recipes: unknown[] }>(queryKeys.profile('author'));
    expect(profile?.recipes).toEqual([]);
  });

  it('should handle delete error', async () => {
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    mockUseAuth.mockReturnValue({ token: null, user: { id: 'user1' } });
    setupSuccessfulFetch();

    renderWithProviders(<RecipeFeed />);

    await waitFor(() => {
      expect(screen.getByText('Test Recipe 1')).toBeInTheDocument();
    });

    const deleteButton = screen.getByRole('button', { name: /delete/i });
    fireEvent.click(deleteButton);

    await waitFor(() => {
      expect(screen.getByText('Delete selected recipe?')).toBeInTheDocument();
    });

    // Mock delete API failure
    mockFetch.mockResolvedValueOnce({
      ok: false,
      json: async () => ({ error: 'Failed to delete' }),
    });

    const confirmButton = screen.getByRole('button', { name: /^delete$/i });
    fireEvent.click(confirmButton);

    await waitFor(() => {
      expect(screen.getByText(/failed to delete/i)).toBeInTheDocument();
    });

    consoleErrorSpy.mockRestore();
  });

  it('should show info message when liking without token', async () => {
    setupSuccessfulFetch();

    renderWithProviders(<RecipeFeed />);

    await waitFor(() => {
      expect(screen.getByText('Test Recipe 1')).toBeInTheDocument();
    });

    const likeButton = screen.getByRole('button', { name: /like/i });
    fireEvent.click(likeButton);

    await waitFor(() => {
      expect(screen.getByText(/please log in to like recipes/i)).toBeInTheDocument();
    });
  });

  it('tells the reader the connection failed, and says it put the like back', async () => {
    // A THROWN fetch is the network, not the server, and the layer now says so in its own
    // words. This test asserted the generic "failed to update like" for this case, which
    // was the only sentence available before — the distinction is new and is the half of
    // the owner's request that is about being offline.
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    mockUseAuth.mockReturnValue({ token: null, user: { id: 'user1' } });
    setupSuccessfulFetch();

    renderWithProviders(<RecipeFeed />);

    await waitFor(() => {
      expect(screen.getByText('Test Recipe 1')).toBeInTheDocument();
    });

    mockFetch.mockRejectedValueOnce(new Error('Like failed'));

    fireEvent.click(screen.getByRole('button', { name: /like/i }));

    await waitFor(() => {
      expect(screen.getByText(/no connection/i)).toBeInTheDocument();
    });

    consoleErrorSpy.mockRestore();
  });

  it('uses the generic failure when the SERVER is the one refusing', async () => {
    // The other half of the split: a 500 is not an offline. Without this pair, classifying
    // a thrown fetch as offline could silently swallow every server rejection into the
    // same sentence.
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    mockUseAuth.mockReturnValue({ token: null, user: { id: 'user1' } });
    setupSuccessfulFetch();

    renderWithProviders(<RecipeFeed />);

    await waitFor(() => {
      expect(screen.getByText('Test Recipe 1')).toBeInTheDocument();
    });

    mockFetch.mockResolvedValueOnce({ ok: false, status: 500, json: async () => ({}) });

    fireEvent.click(screen.getByRole('button', { name: /like/i }));

    await waitFor(() => {
      expect(screen.getByText(/failed to update like/i)).toBeInTheDocument();
    });

    consoleErrorSpy.mockRestore();
  });

  it('shows the reader their own hearts on the first render, with no extra request', async () => {
    setupSuccessfulFetch([
      {
        ...mockRecipe,
        likeCount: 3,
        viewer: { liked: true, saved: false, cooked: false, myRating: null },
      },
    ]);

    renderWithProviders(<RecipeFeed />);

    await waitFor(() => {
      expect(screen.getByTestId('viewer-liked-1')).toHaveTextContent('true');
    });
    expect(screen.getByTestId('like-count-1')).toHaveTextContent('3');

    // One request. The heart is right because the feed response said so, not because a
    // follow-up probe corrected it a moment later.
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it('tells a signed-out reader apart from one who simply has not liked anything', async () => {
    setupSuccessfulFetch([{ ...mockRecipe, likeCount: 3, viewer: null }]);

    renderWithProviders(<RecipeFeed />);

    await waitFor(() => {
      expect(screen.getByTestId('viewer-liked-1')).toHaveTextContent('signed-out');
    });
  });

  it('should show snackbar with message', async () => {
    setupSuccessfulFetch();

    renderWithProviders(<RecipeFeed />);

    await waitFor(() => {
      expect(screen.getByText('Test Recipe 1')).toBeInTheDocument();
    });

    // Trigger snackbar by liking without token
    const likeButton = screen.getByRole('button', { name: /like/i });
    fireEvent.click(likeButton);

    await waitFor(() => {
      expect(screen.getByText(/please log in to like recipes/i)).toBeInTheDocument();
    });
  });

  // Branch Coverage Tests
  describe('Branch Coverage - Missing Lines', () => {
    it('should append recipes when loading more (lines 159-160) - branch coverage', async () => {
      // Mock initial fetch with 12 recipes (triggers hasMore = true)
      const initialRecipes = Array.from({ length: 12 }, (_, i) => ({
        ...mockRecipe,
        id: `${i + 1}`,
        title: `Recipe ${i + 1}`,
        likeCount: 0,
        commentCount: 0,
      }));

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ recipes: initialRecipes }),
      });

      renderWithProviders(<RecipeFeed />);

      await waitFor(() => {
        expect(screen.getByText('Recipe 1')).toBeInTheDocument();
      });

      // Mock second page fetch (will append, not reset)
      const moreRecipes = Array.from({ length: 12 }, (_, i) => ({
        ...mockRecipe,
        id: `${i + 13}`,
        title: `Recipe ${i + 13}`,
        likeCount: 0,
        commentCount: 0,
      }));

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ recipes: moreRecipes }),
      });

      // Trigger infinite scroll via IntersectionObserver
      act(() => {
        intersectionCallback(
          [{ isIntersecting: true }] as IntersectionObserverEntry[],
          {} as IntersectionObserver
        );
      });

      await waitFor(() => {
        expect(screen.getByText('Recipe 13')).toBeInTheDocument();
      });

      // Both initial and new recipes should be visible (append mode)
      expect(screen.getByText('Recipe 1')).toBeInTheDocument();
      expect(screen.getByText('Recipe 13')).toBeInTheDocument();

      // Wait for all skeleton loaders to disappear (indicates async operations completed)
      await waitFor(
        () => {
          const skeletons = screen.queryAllByTestId('recipe-skeleton');
          expect(skeletons.length).toBe(0);
        },
        { timeout: 3000 }
      );

      // Flush all pending promises to prevent act() warnings
      await act(async () => {});
    });

    it('should not load more when hasMore is false (IntersectionObserver) - branch coverage', async () => {
      // Test with no more recipes to load (hasMore = false)
      setupSuccessfulFetch();

      renderWithProviders(<RecipeFeed />);

      await waitFor(() => {
        expect(screen.getByText('Test Recipe 1')).toBeInTheDocument();
      });

      // Triggering IntersectionObserver should not load more since hasMore = false
      act(() => {
        intersectionCallback(
          [{ isIntersecting: true }] as IntersectionObserverEntry[],
          {} as IntersectionObserver
        );
      });

      // Should have end of feed message since hasMore = false
      await waitFor(() => {
        expect(screen.getByText(/you've reached the end/i)).toBeInTheDocument();
      });
    });

    it('should close snackbar when close handler is called (line 270) - branch coverage', async () => {
      setupSuccessfulFetch();

      renderWithProviders(<RecipeFeed />);

      await waitFor(() => {
        expect(screen.getByText('Test Recipe 1')).toBeInTheDocument();
      });

      // Trigger snackbar
      const likeButton = screen.getByRole('button', { name: /like/i });
      fireEvent.click(likeButton);

      await waitFor(() => {
        expect(screen.getByText(/please log in to like recipes/i)).toBeInTheDocument();
      });

      // Find and click the close button on the snackbar
      const closeButton = screen.getByRole('button', { name: /close/i });
      fireEvent.click(closeButton);

      await waitFor(() => {
        expect(screen.queryByText(/please log in to like recipes/i)).not.toBeInTheDocument();
      });
    });

    it('should successfully toggle like when logged in (lines 291-293) - branch coverage', async () => {
      mockUseAuth.mockReturnValue({ token: null, user: { id: 'user1' } });
      setupSuccessfulFetch();

      renderWithProviders(<RecipeFeed />);

      await waitFor(() => {
        expect(screen.getByText('Test Recipe 1')).toBeInTheDocument();
      });

      // Mock successful like API call
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ liked: true, likesCount: 1 }),
      });

      const likeButton = screen.getByRole('button', { name: /like/i });
      fireEvent.click(likeButton);

      // Verify the like API was called
      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith(
          '/api/recipes/1/like',
          expect.objectContaining({
            method: 'POST',
          })
        );
      });
    });

    it('paints the heart at once and puts it back when the server refuses', async () => {
      // Two changes to this test, and the first is the embarrassing one: it was called
      // "should revert like state" and only ever asserted the message — it never checked
      // that anything reverted. It does now, on both sides of the request.
      //
      // The second: the server sent `{ error: 'Like failed' }`, and the layer shows the
      // server's own sentence when there is no error code it recognises, which is the
      // documented contract. The old handler ignored the body and always printed its own
      // generic line, so this asserted that generic line.
      mockUseAuth.mockReturnValue({ token: null, user: { id: 'user1' } });
      // A real viewer, not the default `null`: a signed-in reader always has one, and
      // `null` renders as "signed-out" rather than as an unliked heart.
      setupSuccessfulFetch([
        {
          ...mockRecipe,
          viewer: {
            liked: false,
            saved: false,
            timesCooked: 0,
            lastCookedAt: null,
            myRating: null,
          },
        },
      ]);

      renderWithProviders(<RecipeFeed />);

      await waitFor(() => {
        expect(screen.getByText('Test Recipe 1')).toBeInTheDocument();
      });
      expect(screen.getByTestId('viewer-liked-1')).toHaveTextContent('false');

      let release: (value: unknown) => void = () => {};
      mockFetch.mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            release = () => resolve({ ok: false, json: async () => ({ error: 'Like failed' }) });
          })
      );

      fireEvent.click(screen.getByRole('button', { name: /like/i }));

      // Painted before the request is anywhere near finished: the whole point of the layer.
      await waitFor(() => {
        expect(screen.getByTestId('viewer-liked-1')).toHaveTextContent('true');
      });

      await act(async () => {
        release(null);
        await new Promise((resolve) => setTimeout(resolve, 0));
      });

      await waitFor(() => {
        expect(screen.getByTestId('viewer-liked-1')).toHaveTextContent('false');
      });
      expect(screen.getByText('Like failed')).toBeInTheDocument();
    });

    it('should prevent concurrent loadRecipes calls - line 133', async () => {
      // Mock a slow API response to keep loading state true
      mockFetch.mockImplementation(
        () =>
          new Promise((resolve) => {
            setTimeout(() => {
              resolve({
                ok: true,
                json: async () => ({ recipes: [mockRecipe] }),
              });
            }, 1000);
          })
      );

      renderWithProviders(<RecipeFeed />);

      // Wait a bit to ensure loadRecipes is called and loading is true
      await act(async () => {});

      // Mock fetch should only be called once (initial load)
      // Even if filters change while loading, it shouldn't trigger another fetch
      const initialCallCount = mockFetch.mock.calls.length;

      // The loading guard should prevent multiple concurrent calls
      expect(initialCallCount).toBeGreaterThanOrEqual(1);
    });

    it('says the feed could not be read, rather than that there is nothing in it', async () => {
      // This asserted `console.error('Error loading recipes:', …)`, which React Query does
      // not do — and a console line was never what the reader needed anyway. The feed used
      // to render "no recipes yet" with an invitation to create the first one, which is the
      // same lie the pantry and the search were telling. I reintroduced it here while
      // moving the read, and only noticed because this test stopped passing.
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

      mockFetch.mockResolvedValueOnce({
        ok: false,
        json: async () => ({ error: 'Server error' }),
      });

      renderWithProviders(<RecipeFeed />);

      await waitFor(() => {
        expect(screen.getByText(/could not load the recipes/i)).toBeInTheDocument();
      });
      expect(screen.queryByText(/no recipes yet/i)).not.toBeInTheDocument();

      consoleErrorSpy.mockRestore();
    });

    it('should return early from handleDeleteConfirm when no token - line 211', async () => {
      mockUseAuth.mockReturnValue({ token: null, user: null });
      setupSuccessfulFetch();

      renderWithProviders(<RecipeFeed />);

      await waitFor(() => {
        expect(screen.getByText('Test Recipe 1')).toBeInTheDocument();
      });

      const deleteButton = screen.getByRole('button', { name: /delete/i });
      fireEvent.click(deleteButton);

      await waitFor(() => {
        expect(screen.getByText('Delete selected recipe?')).toBeInTheDocument();
      });

      const initialFetchCallCount = mockFetch.mock.calls.length;

      const confirmButton = screen.getByRole('button', { name: /^delete$/i });
      fireEvent.click(confirmButton);

      // Should not make delete API call without token
      await act(async () => {});

      // No new fetch calls should have been made
      expect(mockFetch.mock.calls.length).toBe(initialFetchCallCount);
    });

    it('should throw error with custom message when delete fails - lines 224-225', async () => {
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
      mockUseAuth.mockReturnValue({ token: null, user: { id: 'user1' } });
      setupSuccessfulFetch();

      renderWithProviders(<RecipeFeed />);

      await waitFor(() => {
        expect(screen.getByText('Test Recipe 1')).toBeInTheDocument();
      });

      const deleteButton = screen.getByRole('button', { name: /delete/i });
      fireEvent.click(deleteButton);

      await waitFor(() => {
        expect(screen.getByText('Delete selected recipe?')).toBeInTheDocument();
      });

      // Mock delete API failure with custom error message
      mockFetch.mockResolvedValueOnce({
        ok: false,
        json: async () => ({ error: 'Recipe not found' }),
      });

      const confirmButton = screen.getByRole('button', { name: /^delete$/i });
      fireEvent.click(confirmButton);

      // Should show custom error message
      await waitFor(() => {
        expect(screen.getByText('Recipe not found')).toBeInTheDocument();
      });

      expect(consoleErrorSpy).toHaveBeenCalledWith('Error deleting recipe:', expect.any(Error));

      consoleErrorSpy.mockRestore();
    });

    it('should remove recipe and show success message on successful delete - lines 228-234', async () => {
      mockUseAuth.mockReturnValue({ token: null, user: { id: 'user1' } });
      const recipe1 = { ...mockRecipe, id: '1', title: 'Recipe 1' };
      const recipe2 = { ...mockRecipe, id: '2', title: 'Recipe 2' };

      setupSuccessfulFetch([recipe1, recipe2]);

      renderWithProviders(<RecipeFeed />);

      await waitFor(() => {
        expect(screen.getByText('Recipe 1')).toBeInTheDocument();
        expect(screen.getByText('Recipe 2')).toBeInTheDocument();
      });

      const deleteButtons = screen.getAllByRole('button', { name: /delete/i });
      fireEvent.click(deleteButtons[0]);

      await waitFor(() => {
        expect(screen.getByText('Delete selected recipe?')).toBeInTheDocument();
      });

      // Mock successful delete
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({}),
      });

      const confirmButton = screen.getByRole('button', { name: /^delete$/i });
      fireEvent.click(confirmButton);

      // Should remove recipe and show success
      await waitFor(() => {
        expect(screen.getByText('Recipe deleted successfully')).toBeInTheDocument();
      });

      // Recipe 1 should be removed from list
      await waitFor(() => {
        expect(screen.queryByText('Recipe 1')).not.toBeInTheDocument();
      });

      // Recipe 2 should still be visible
      expect(screen.getByText('Recipe 2')).toBeInTheDocument();
    });

    it('should show non-Error exception fallback message - lines 237-241', async () => {
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
      mockUseAuth.mockReturnValue({ token: null, user: { id: 'user1' } });
      setupSuccessfulFetch();

      renderWithProviders(<RecipeFeed />);

      await waitFor(() => {
        expect(screen.getByText('Test Recipe 1')).toBeInTheDocument();
      });

      const deleteButton = screen.getByRole('button', { name: /delete/i });
      fireEvent.click(deleteButton);

      await waitFor(() => {
        expect(screen.getByText('Delete selected recipe?')).toBeInTheDocument();
      });

      // Mock delete API throwing non-Error exception
      mockFetch.mockRejectedValueOnce('String error');

      const confirmButton = screen.getByRole('button', { name: /^delete$/i });
      fireEvent.click(confirmButton);

      // Should show fallback error message
      await waitFor(() => {
        expect(screen.getByText('Failed to delete recipe')).toBeInTheDocument();
      });

      consoleErrorSpy.mockRestore();
    });

    it('should update recipe in list and show success on edit - lines 259-270', async () => {
      setupSuccessfulFetch();

      renderWithProviders(<RecipeFeed />);

      await waitFor(() => {
        expect(screen.getByText('Test Recipe 1')).toBeInTheDocument();
      });

      const editButton = screen.getByRole('button', { name: /edit/i });
      fireEvent.click(editButton);

      await waitFor(() => {
        expect(screen.getByTestId('edit-recipe-modal')).toBeInTheDocument();
      });

      // Click save to trigger handleEditSuccess
      const saveButton = screen.getByRole('button', { name: /save/i });
      fireEvent.click(saveButton);

      // Should update recipe and show success message
      await waitFor(() => {
        expect(screen.getByText('Recipe updated successfully')).toBeInTheDocument();
      });

      // Recipe should be updated in the list
      await waitFor(() => {
        expect(screen.getByText('Updated Recipe')).toBeInTheDocument();
      });
    });

    it('asks to unlike a recipe the reader already liked, not to like it again', async () => {
      mockUseAuth.mockReturnValue({ token: null, user: { id: 'user1' } });

      // The whole point of the package: the API says this reader already liked it.
      setupSuccessfulFetch([
        {
          ...mockRecipe,
          likeCount: 1,
          viewer: { liked: true, saved: false, cooked: false, myRating: null },
        },
      ]);

      renderWithProviders(<RecipeFeed />);

      await waitFor(() => {
        expect(screen.getByTestId('viewer-liked-1')).toHaveTextContent('true');
      });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ liked: false, likeCount: 0 }),
      });

      fireEvent.click(screen.getByRole('button', { name: /like/i }));

      // Before this, the feed believed nobody had liked anything, so this click sent
      // `liked: true` — asking the server to like a recipe that was already liked, which
      // the old toggle endpoint carried out by removing the like.
      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith(
          '/api/recipes/1/like',
          expect.objectContaining({
            method: 'POST',
            body: JSON.stringify({ liked: false }),
          })
        );
      });

      await waitFor(() => {
        expect(screen.getByTestId('viewer-liked-1')).toHaveTextContent('false');
        expect(screen.getByTestId('like-count-1')).toHaveTextContent('0');
      });
    });

    it('should render fullWidth button on mobile when creating recipe - line 369', async () => {
      // Mock mobile viewport
      Object.defineProperty(window, 'matchMedia', {
        writable: true,
        value: jest.fn().mockImplementation((query) => ({
          matches: query.includes('max-width: 600px'),
          media: query,
          onchange: null,
          addListener: jest.fn(),
          removeListener: jest.fn(),
          addEventListener: jest.fn(),
          removeEventListener: jest.fn(),
          dispatchEvent: jest.fn(),
        })),
      });

      setupSuccessfulFetch();
      const mockOnCreateRecipe = jest.fn();

      const { container } = renderWithProviders(<RecipeFeed onCreateRecipe={mockOnCreateRecipe} />);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /^new recipe$/i })).toBeInTheDocument();
      });

      // Button should render (fullWidth prop is applied based on isMobile)
      const createButton = screen.getByRole('button', { name: /^new recipe$/i });
      expect(createButton).toBeInTheDocument();

      await waitForLoadingComplete(container);
    });

    it('should render large button on mobile in empty state - line 492', async () => {
      // Mock mobile viewport
      Object.defineProperty(window, 'matchMedia', {
        writable: true,
        value: jest.fn().mockImplementation((query) => ({
          matches: query.includes('max-width: 600px'),
          media: query,
          onchange: null,
          addListener: jest.fn(),
          removeListener: jest.fn(),
          addEventListener: jest.fn(),
          removeEventListener: jest.fn(),
          dispatchEvent: jest.fn(),
        })),
      });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ recipes: [] }),
      });

      const mockOnCreateRecipe = jest.fn();
      renderWithProviders(<RecipeFeed onCreateRecipe={mockOnCreateRecipe} />);

      await waitFor(() => {
        expect(screen.getByText('No recipes found')).toBeInTheDocument();
      });

      // Should show large button in empty state on mobile
      const createButton = screen.getByRole('button', { name: /publish your first recipe/i });
      expect(createButton).toBeInTheDocument();
    });
  });

  // ==================== TIME FILTER COVERAGE TESTS (lines 150, 152) ====================
  describe('Time Filter Coverage', () => {
    it('should filter by under60 time - line 150', async () => {
      setupSuccessfulFetch();

      renderWithProviders(<RecipeFeed />);

      await waitFor(() => {
        expect(screen.getByText('Test Recipe 1')).toBeInTheDocument();
      });

      setupSuccessfulFetch([mockRecipe]);

      const maxTimeSelect = screen.getAllByRole('combobox')[1]; // Duration is second
      fireEvent.mouseDown(maxTimeSelect);

      const under60Option = await screen.findByText('Under 1 hour');
      fireEvent.click(under60Option);

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith(
          expect.stringContaining('maxTime=60'),
          expect.anything()
        );
      });

      await act(async () => {});
    });

    it('should filter by over60 time - line 152', async () => {
      setupSuccessfulFetch();

      renderWithProviders(<RecipeFeed />);

      await waitFor(() => {
        expect(screen.getByText('Test Recipe 1')).toBeInTheDocument();
      });

      setupSuccessfulFetch([mockRecipe]);

      const maxTimeSelect = screen.getAllByRole('combobox')[1]; // Duration is second
      fireEvent.mouseDown(maxTimeSelect);

      const over60Option = await screen.findByText('Over 1 hour');
      fireEvent.click(over60Option);

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith(
          expect.stringContaining('minTime=60'),
          expect.anything()
        );
      });

      await act(async () => {});
    });
  });

  // ==================== SORT ORDER COVERAGE TESTS (lines 155, 457) ====================
  describe('Sort Order Coverage', () => {
    it('should sort by highest rated - lines 155, 457', async () => {
      setupSuccessfulFetch();

      renderWithProviders(<RecipeFeed />);

      await waitFor(() => {
        expect(screen.getByText('Test Recipe 1')).toBeInTheDocument();
      });

      setupSuccessfulFetch([mockRecipe]);

      const sortSelect = screen.getAllByRole('combobox')[2]; // Sort By is third
      fireEvent.mouseDown(sortSelect);

      const highestRatedOption = await screen.findByText('Highest Rated');
      fireEvent.click(highestRatedOption);

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith(
          expect.stringContaining('sort=rating_desc'),
          expect.anything()
        );
      });

      await act(async () => {});
    });

    it('should sort by most reviewed - line 155', async () => {
      setupSuccessfulFetch();

      renderWithProviders(<RecipeFeed />);

      await waitFor(() => {
        expect(screen.getByText('Test Recipe 1')).toBeInTheDocument();
      });

      setupSuccessfulFetch([mockRecipe]);

      const sortSelect = screen.getAllByRole('combobox')[2]; // Sort By is third
      fireEvent.mouseDown(sortSelect);

      const mostReviewedOption = await screen.findByText('Most Reviewed');
      fireEvent.click(mostReviewedOption);

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith(
          expect.stringContaining('sort=most_reviewed'),
          expect.anything()
        );
      });

      await act(async () => {});
    });
  });

  // ==================== DELETE ERROR FALLBACK (line 234) ====================
  describe('Delete Error Fallback - line 234', () => {
    it('should show fallback error message when server returns no error field - line 234', async () => {
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
      mockUseAuth.mockReturnValue({ token: null, user: { id: 'user1' } });
      setupSuccessfulFetch();

      renderWithProviders(<RecipeFeed />);

      await waitFor(() => {
        expect(screen.getByText('Test Recipe 1')).toBeInTheDocument();
      });

      const deleteButton = screen.getByRole('button', { name: /delete/i });
      fireEvent.click(deleteButton);

      await waitFor(() => {
        expect(screen.getByText('Delete selected recipe?')).toBeInTheDocument();
      });

      // Mock delete API failure without error field
      mockFetch.mockResolvedValueOnce({
        ok: false,
        json: async () => ({}), // No error field
      });

      const confirmButton = screen.getByRole('button', { name: /^delete$/i });
      fireEvent.click(confirmButton);

      await waitFor(() => {
        expect(screen.getByText(/failed to delete recipe/i)).toBeInTheDocument();
      });

      consoleErrorSpy.mockRestore();
    });
  });

  // ==================== MOBILE VIEWPORT TESTS (line 379) ====================
  describe('Mobile Viewport - line 379', () => {
    let originalMatchMedia: typeof window.matchMedia;

    beforeEach(() => {
      originalMatchMedia = window.matchMedia;
      window.matchMedia = jest.fn().mockImplementation((query) => ({
        matches: query.includes('max-width') || query.includes('(max-width:599.95px)'),
        media: query,
        onchange: null,
        addListener: jest.fn(),
        removeListener: jest.fn(),
        addEventListener: jest.fn(),
        removeEventListener: jest.fn(),
        dispatchEvent: jest.fn(),
      }));
    });

    afterEach(() => {
      window.matchMedia = originalMatchMedia;
    });

    it('should render mobile-sized New recipe button - line 379', async () => {
      setupSuccessfulFetch();
      const mockOnCreateRecipe = jest.fn();

      renderWithProviders(<RecipeFeed onCreateRecipe={mockOnCreateRecipe} />);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /^new recipe$/i })).toBeInTheDocument();
      });
    });
  });

  // ==================== LOADING GUARD (line 133) ====================
  describe('Loading Guard - line 133', () => {
    it('should not load recipes twice when already loading - line 133', async () => {
      const localMockOnCreateRecipe = jest.fn();
      // Set up a delayed fetch to simulate loading state
      mockFetch.mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            setTimeout(
              () =>
                resolve({
                  ok: true,
                  json: async () => ({ recipes: [mockRecipe], total: 1 }),
                }),
              500
            );
          })
      );

      renderWithProviders(<RecipeFeed onCreateRecipe={localMockOnCreateRecipe} />);

      // The component should be loading now, additional loadRecipes calls should return early (line 133)
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });
  });
});
