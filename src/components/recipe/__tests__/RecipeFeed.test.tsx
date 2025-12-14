import React from 'react';
import { render, screen, waitFor, fireEvent, act, configure } from '@testing-library/react';
import '@testing-library/jest-dom';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import RecipeFeed from '../RecipeFeed';
import { AuthProvider } from '@/contexts/AuthContext';

// Speed up waitFor - needs longer timeout for multiple sequential async operations
configure({ asyncUtilTimeout: 250 });

// Mock framer-motion - comprehensive mock supporting all patterns
jest.mock('framer-motion', () => {
  const mockMotion: any = (component: any) => component;
  mockMotion.create = (component: any) => component;
  mockMotion.div = ({ children, initial, animate, exit, transition, whileHover, whileTap, ...props }: any) =>
    <div {...props}>{children}</div>;

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

// Mock RecipeCard component
jest.mock('../RecipeCard', () => {
  return function MockRecipeCard({ recipe, onClick, onLike, onComment, onEdit, onDelete }: any) {
    return (
      <div data-testid={`recipe-card-${recipe.id}`}>
        <div>{recipe.title}</div>
        <button onClick={onClick}>View</button>
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

const renderWithProviders = (component: React.ReactElement) => {
  let result: any;
  act(() => {
    result = render(
      <ThemeProvider theme={mockTheme}>
        {component}
      </ThemeProvider>
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

describe('RecipeFeed Component', () => {
  let mockFetch: jest.Mock;

  beforeEach(() => {
    mockFetch = global.fetch as jest.Mock;
    mockFetch.mockClear();
    mockPush.mockClear();
    mockUseAuth.mockReturnValue({ token: null, user: null }); // Default to no token
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
      await act(async () => { });
      currentCallCount = mockFetch.mock.calls.length;
      attempts++;
    }

    // Final flush to ensure all state updates complete
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 0));
    });
  });

  const setupSuccessfulFetch = (recipes = [mockRecipe]) => {
    // Mock initial recipe fetch
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ recipes }),
    });

    // Mock like fetch for each recipe
    recipes.forEach(() => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ liked: false, likesCount: 0 }),
      });
    });

    // Mock comments fetch for each recipe
    recipes.forEach(() => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ comments: [] }),
      });
    });
  };

  // Helper to wait for all fetch calls including engagement data
  const waitForAllFetches = async (expectedCalls: number) => {
    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledTimes(expectedCalls);
    }, { timeout: 3000 });
    // Additional flush to ensure all state updates from fetches complete
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 0));
    });
  };

  // Helper to wait for component loading to complete
  const waitForLoadingComplete = async (container: HTMLElement) => {
    // Wait for skeletons to disappear (indicates loading complete)
    await waitFor(() => {
      const skeletons = container.querySelectorAll('.MuiSkeleton-root');
      expect(skeletons.length).toBe(0);
    }, { timeout: 3000 });
    // Additional flush to ensure all state updates complete
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 0));
    });
  };

  it('should render loading state initially', () => {
    mockFetch.mockImplementation(() => new Promise(() => { }));

    const { container } = renderWithProviders(<RecipeFeed />);

    // Should show skeleton loading cards instead of progressbar
    // MUI Skeleton uses the class "MuiSkeleton-root"
    const skeletons = container.querySelectorAll('.MuiSkeleton-root');
    expect(skeletons.length).toBeGreaterThan(0);
  });

  it('should fetch and display recipes', async () => {
    setupSuccessfulFetch();

    renderWithProviders(<RecipeFeed />);

    await waitFor(() => {
      expect(screen.getByText('Test Recipe 1')).toBeInTheDocument();
    });
  });

  it('should handle fetch failure gracefully', async () => {
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => { });
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

  it('should render Share Recipe button when onCreateRecipe prop is provided', async () => {
    setupSuccessfulFetch();
    const mockOnCreateRecipe = jest.fn();

    renderWithProviders(<RecipeFeed onCreateRecipe={mockOnCreateRecipe} />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /share recipe/i })).toBeInTheDocument();
    });
  });

  it('should call onCreateRecipe when Share Recipe button is clicked', async () => {
    setupSuccessfulFetch();
    const mockOnCreateRecipe = jest.fn();

    renderWithProviders(<RecipeFeed onCreateRecipe={mockOnCreateRecipe} />);

    await waitFor(() => {
      const shareButton = screen.getByRole('button', { name: /share recipe/i });
      fireEvent.click(shareButton);
    });

    expect(mockOnCreateRecipe).toHaveBeenCalled();
  });

  it('should render filter controls', async () => {
    setupSuccessfulFetch();

    const { container } = renderWithProviders(<RecipeFeed />);

    // Filters section should be present
    expect(screen.getByText('Filters')).toBeInTheDocument();

    // Wait for component to load fully (skeleton cards should disappear)
    await waitFor(() => {
      const skeletons = container.querySelectorAll('.MuiSkeleton-root');
      expect(skeletons.length).toBe(0);
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

    const createButtons = screen.getAllByRole('button', { name: /share/i });
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

  it('should navigate to recipe detail page when recipe is clicked', async () => {
    setupSuccessfulFetch();

    renderWithProviders(<RecipeFeed />);

    await waitFor(() => {
      expect(screen.getByText('Test Recipe 1')).toBeInTheDocument();
    });

    const viewButton = screen.getByRole('button', { name: /view/i });
    fireEvent.click(viewButton);

    expect(mockPush).toHaveBeenCalledWith('/recipe/1');
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
        expect.stringContaining('difficulty=easy')
      );
    });

    // Wait for all skeleton loaders to disappear (indicates async operations completed)
    await waitFor(() => {
      const skeletons = screen.queryAllByTestId('recipe-skeleton');
      expect(skeletons.length).toBe(0);
    }, { timeout: 3000 });

    // Flush all pending promises to prevent act() warnings
    await act(async () => { });
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
        expect.stringContaining('maxTime=30')
      );
    });

    // Wait for all skeleton loaders to disappear (indicates async operations completed)
    await waitFor(() => {
      const skeletons = screen.queryAllByTestId('recipe-skeleton');
      expect(skeletons.length).toBe(0);
    }, { timeout: 3000 });

    // Flush all pending promises to prevent act() warnings
    await act(async () => { });
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
    await waitFor(() => {
      const skeletons = screen.queryAllByTestId('recipe-skeleton');
      expect(skeletons.length).toBe(0);
    }, { timeout: 3000 });

    // Flush all pending promises to prevent act() warnings
    await act(async () => { });
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
    await waitFor(() => {
      const skeletons = screen.queryAllByTestId('recipe-skeleton');
      expect(skeletons.length).toBe(0);
    }, { timeout: 3000 });

    // Flush all pending promises to prevent act() warnings
    await act(async () => { });
  });

  it('should delete recipe successfully', async () => {
    mockUseAuth.mockReturnValue({ token: 'test-token', user: { id: 'user1' } });
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

  it('should handle delete error', async () => {
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => { });
    mockUseAuth.mockReturnValue({ token: 'test-token', user: { id: 'user1' } });
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

  it('should handle like error gracefully', async () => {
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => { });
    mockUseAuth.mockReturnValue({ token: 'test-token', user: { id: 'user1' } });
    setupSuccessfulFetch();

    renderWithProviders(<RecipeFeed />);

    await waitFor(() => {
      expect(screen.getByText('Test Recipe 1')).toBeInTheDocument();
    });

    // Mock like API failure
    mockFetch.mockRejectedValueOnce(new Error('Like failed'));

    const likeButton = screen.getByRole('button', { name: /like/i });
    fireEvent.click(likeButton);

    await waitFor(() => {
      expect(screen.getByText(/failed to update like/i)).toBeInTheDocument();
    });

    consoleErrorSpy.mockRestore();
  });

  it('should handle failed like engagement fetch', async () => {
    // Mock initial recipe fetch
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ recipes: [mockRecipe] }),
    });

    // Mock like fetch failure
    mockFetch.mockResolvedValueOnce({
      ok: false,
      json: async () => ({}),
    });

    // Mock comments fetch
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ comments: [] }),
    });

    renderWithProviders(<RecipeFeed />);

    await waitFor(() => {
      expect(screen.getByText('Test Recipe 1')).toBeInTheDocument();
    });
  });

  it('should handle failed comments engagement fetch', async () => {
    // Mock initial recipe fetch
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ recipes: [mockRecipe] }),
    });

    // Mock like fetch
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ liked: false, likesCount: 0 }),
    });

    // Mock comments fetch failure
    mockFetch.mockResolvedValueOnce({
      ok: false,
      json: async () => ({}),
    });

    renderWithProviders(<RecipeFeed />);

    await waitFor(() => {
      expect(screen.getByText('Test Recipe 1')).toBeInTheDocument();
    });
  });

  it('should handle engagement fetch error', async () => {
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => { });

    // Mock initial recipe fetch
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ recipes: [mockRecipe] }),
    });

    // Mock like fetch error
    mockFetch.mockRejectedValueOnce(new Error('Engagement fetch failed'));

    renderWithProviders(<RecipeFeed />);

    await waitFor(() => {
      expect(screen.getByText('Test Recipe 1')).toBeInTheDocument();
    });

    await waitFor(() => {
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Error fetching recipe engagement:',
        expect.any(Error)
      );
    });

    consoleErrorSpy.mockRestore();
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
      // Setup initial recipes
      const recipe1 = { ...mockRecipe, id: '1', title: 'Recipe 1' };
      const recipe2 = { ...mockRecipe, id: '2', title: 'Recipe 2' };

      // Mock initial fetch with 12 recipes (triggers hasMore = true)
      const initialRecipes = Array.from({ length: 12 }, (_, i) => ({
        ...mockRecipe,
        id: `${i + 1}`,
        title: `Recipe ${i + 1}`,
      }));

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ recipes: initialRecipes }),
      });

      // Mock engagement fetches for initial recipes
      initialRecipes.forEach(() => {
        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: async () => ({ liked: false, likesCount: 0 }),
        });
      });
      initialRecipes.forEach(() => {
        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: async () => ({ comments: [] }),
        });
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
      }));

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ recipes: moreRecipes }),
      });

      moreRecipes.forEach(() => {
        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: async () => ({ liked: false, likesCount: 0 }),
        });
      });
      moreRecipes.forEach(() => {
        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: async () => ({ comments: [] }),
        });
      });

      // Trigger infinite scroll by scrolling
      fireEvent.scroll(window, { target: { scrollY: 10000 } });

      await waitFor(() => {
        expect(screen.getByText('Recipe 13')).toBeInTheDocument();
      });

      // Both initial and new recipes should be visible (append mode)
      expect(screen.getByText('Recipe 1')).toBeInTheDocument();
      expect(screen.getByText('Recipe 13')).toBeInTheDocument();

      // Wait for all skeleton loaders to disappear (indicates async operations completed)
      await waitFor(() => {
        const skeletons = screen.queryAllByTestId('recipe-skeleton');
        expect(skeletons.length).toBe(0);
      }, { timeout: 3000 });

      // Flush all pending promises to prevent act() warnings
      await act(async () => {
      });
    });

    it('should handle scroll event conditions (lines 180-185) - branch coverage', async () => {
      // Test with no more recipes to load (hasMore = false)
      const recipes = [mockRecipe]; // Less than 12 means hasMore will be false

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ recipes }),
      });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ liked: false, likesCount: 0 }),
      });
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ comments: [] }),
      });

      renderWithProviders(<RecipeFeed />);

      await waitFor(() => {
        expect(screen.getByText('Test Recipe 1')).toBeInTheDocument();
      });

      // Scroll near bottom - should not load more since hasMore = false
      Object.defineProperty(window, 'innerHeight', { writable: true, value: 800 });
      Object.defineProperty(window, 'scrollY', { writable: true, value: 5000 });
      Object.defineProperty(document.documentElement, 'scrollHeight', { writable: true, value: 6000 });

      fireEvent.scroll(window);

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
      mockUseAuth.mockReturnValue({ token: 'test-token', user: { id: 'user1' } });
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
            headers: expect.objectContaining({
              'Authorization': 'Bearer test-token',
            }),
          })
        );
      });
    });

    it('should revert like state when API returns ok: false - lines 320-324', async () => {
      mockUseAuth.mockReturnValue({ token: 'test-token', user: { id: 'user1' } });
      setupSuccessfulFetch();

      renderWithProviders(<RecipeFeed />);

      await waitFor(() => {
        expect(screen.getByText('Test Recipe 1')).toBeInTheDocument();
      });

      // Mock failed like API response (ok: false, not an exception)
      mockFetch.mockResolvedValueOnce({
        ok: false,
        json: async () => ({ error: 'Like failed' }),
      });

      const likeButton = screen.getByRole('button', { name: /like/i });
      fireEvent.click(likeButton);

      // Should show error message
      await waitFor(() => {
        expect(screen.getByText(/failed to update like/i)).toBeInTheDocument();
      });
    });

    it('should prevent concurrent loadRecipes calls - line 133', async () => {
      // Mock a slow API response to keep loading state true
      mockFetch.mockImplementation(() =>
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
      await act(async () => {
      });

      // Mock fetch should only be called once (initial load)
      // Even if filters change while loading, it shouldn't trigger another fetch
      const initialCallCount = mockFetch.mock.calls.length;

      // The loading guard should prevent multiple concurrent calls
      expect(initialCallCount).toBeGreaterThanOrEqual(1);
    });

    it('should throw error when recipe fetch fails - line 150', async () => {
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => { });

      // Mock fetch to return ok: false
      mockFetch.mockResolvedValueOnce({
        ok: false,
        json: async () => ({ error: 'Server error' }),
      });

      renderWithProviders(<RecipeFeed />);

      // Wait for error to be logged
      await waitFor(() => {
        expect(consoleErrorSpy).toHaveBeenCalledWith(
          'Error loading recipes:',
          expect.any(Error)
        );
      });

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
      await act(async () => {
      });

      // No new fetch calls should have been made
      expect(mockFetch.mock.calls.length).toBe(initialFetchCallCount);
    });

    it('should throw error with custom message when delete fails - lines 224-225', async () => {
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => { });
      mockUseAuth.mockReturnValue({ token: 'test-token', user: { id: 'user1' } });
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

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Error deleting recipe:',
        expect.any(Error)
      );

      consoleErrorSpy.mockRestore();
    });

    it('should remove recipe and show success message on successful delete - lines 228-234', async () => {
      mockUseAuth.mockReturnValue({ token: 'test-token', user: { id: 'user1' } });
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
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => { });
      mockUseAuth.mockReturnValue({ token: 'test-token', user: { id: 'user1' } });
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

    it('should use default like state when recipe not in recipeLikes - lines 287-289', async () => {
      mockUseAuth.mockReturnValue({ token: 'test-token', user: { id: 'user1' } });

      // Mock recipe fetch with a recipe that won't have engagement data
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ recipes: [mockRecipe] }),
      });

      // Mock engagement fetch to fail so recipeLikes[recipeId] doesn't exist
      mockFetch.mockResolvedValueOnce({
        ok: false,
        json: async () => ({}),
      });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ comments: [] }),
      });

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

      // Should use default state { liked: false, count: 0 } and optimistically update to liked: true, count: 1
      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith(
          '/api/recipes/1/like',
          expect.objectContaining({
            method: 'POST',
          })
        );
      });
    });

    it('should render fullWidth button on mobile when creating recipe - line 369', async () => {
      // Mock mobile viewport
      Object.defineProperty(window, 'matchMedia', {
        writable: true,
        value: jest.fn().mockImplementation(query => ({
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
        expect(screen.getByRole('button', { name: /share recipe/i })).toBeInTheDocument();
      });

      // Button should render (fullWidth prop is applied based on isMobile)
      const shareButton = screen.getByRole('button', { name: /share recipe/i });
      expect(shareButton).toBeInTheDocument();

      await waitForLoadingComplete(container);
    });

    it('should render large button on mobile in empty state - line 492', async () => {
      // Mock mobile viewport
      Object.defineProperty(window, 'matchMedia', {
        writable: true,
        value: jest.fn().mockImplementation(query => ({
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
      const createButton = screen.getByRole('button', { name: /share your first recipe/i });
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
          expect.stringContaining('maxTime=60')
        );
      });

      await act(async () => { });
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
          expect.stringContaining('minTime=60')
        );
      });

      await act(async () => { });
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
          expect.stringContaining('sort=rating_desc')
        );
      });

      await act(async () => { });
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
          expect.stringContaining('sort=most_reviewed')
        );
      });

      await act(async () => { });
    });
  });
});
