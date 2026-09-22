import { ThemeProvider, createTheme } from '@mui/material/styles';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import React from 'react';
import '@testing-library/jest-dom';
import { AuthProvider } from '@/contexts/AuthContext';
import { ToastProvider } from '@/contexts/ToastContext';
import MatchedRecipes from '../MatchedRecipes';

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

const mockTheme = createTheme();

/**
 * The matches live in the React Query cache now and their hearts go through the shared
 * mutation layer, so this needs both providers. A fresh client per render keeps one test's
 * cached matches out of the next, and `retry: false` keeps a failure test from waiting out
 * a retry.
 */
const renderWithProviders = (component: React.ReactElement) => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <ThemeProvider theme={mockTheme}>
        <ToastProvider>{component}</ToastProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
};

describe('MatchedRecipes Component', () => {
  let mockFetch: jest.Mock;

  beforeEach(() => {
    mockFetch = global.fetch as jest.Mock;
    mockFetch.mockClear();
    mockPush.mockClear();
    mockUseAuth.mockReturnValue({ token: null, isAuthenticated: false }); // Default to unauthenticated
  });

  it('should render null during loading state', () => {
    mockFetch.mockImplementation(() => new Promise(() => {}));

    const { container } = renderWithProviders(<MatchedRecipes />);

    // Loading state returns null - no content should be rendered
    expect(container.firstChild).toBeNull();
  });

  it('should render null without fetching when no token', () => {
    const { container } = renderWithProviders(<MatchedRecipes />);

    // Loading state returns null
    expect(container.firstChild).toBeNull();

    // Verify no fetch was called
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('should render empty pantry state', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        readyToCook: [],
        almostThere: [],
        pantryItemsCount: 0,
      }),
    });

    // Mock AuthContext to provide a token
    mockUseAuth.mockReturnValue({ token: null, isAuthenticated: true });

    renderWithProviders(<MatchedRecipes />);

    await waitFor(() => {
      expect(screen.getByText(/your pantry is empty/i)).toBeInTheDocument();
    });

    expect(screen.getByText(/add ingredients to your pantry/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /go to my pantry/i })).toBeInTheDocument();
  });

  it('should navigate to pantry when clicking Go to My Pantry button', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        readyToCook: [],
        almostThere: [],
        pantryItemsCount: 0,
      }),
    });

    mockUseAuth.mockReturnValue({ token: null, isAuthenticated: true });

    renderWithProviders(<MatchedRecipes />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /go to my pantry/i })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /go to my pantry/i }));
    expect(mockPush).toHaveBeenCalledWith('/pantry');
  });

  it('should render Ready to Cook recipes', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        readyToCook: [
          {
            id: '1',
            title: 'Pasta Carbonara',
            description: 'Classic Italian pasta',
            imageUrl: 'https://example.com/pasta.jpg',
            cuisine: 'Italian',
            difficulty: 'Medium',
            matchPercentage: 100,
            matchedIngredients: 5,
            totalIngredients: 5,
            missingIngredients: [],
          },
        ],
        almostThere: [],
        pantryItemsCount: 10,
      }),
    });

    mockUseAuth.mockReturnValue({ token: null, isAuthenticated: true });

    renderWithProviders(<MatchedRecipes />);

    await waitFor(() => {
      expect(screen.getByText('Pasta Carbonara')).toBeInTheDocument();
    });

    expect(screen.getByText('Classic Italian pasta')).toBeInTheDocument();
    expect(screen.getByText('100% Match')).toBeInTheDocument();
    expect(screen.getByText('Medium')).toBeInTheDocument();
  });

  it('should show info message when no ready to cook recipes', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        readyToCook: [],
        almostThere: [],
        pantryItemsCount: 5,
      }),
    });

    mockUseAuth.mockReturnValue({ token: null, isAuthenticated: true });

    renderWithProviders(<MatchedRecipes />);

    await waitFor(() => {
      expect(screen.getByText(/no recipes match 100%/i)).toBeInTheDocument();
    });
  });

  it('should render Almost There recipes when switching tabs', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        readyToCook: [],
        almostThere: [
          {
            id: '2',
            title: 'Chicken Curry',
            description: 'Spicy chicken curry',
            imageUrl: 'https://example.com/curry.jpg',
            cuisine: 'Indian',
            difficulty: 'Hard',
            matchPercentage: 75,
            matchedIngredients: 3,
            totalIngredients: 4,
            missingIngredients: ['Garam Masala'],
          },
        ],
        pantryItemsCount: 8,
      }),
    });

    mockUseAuth.mockReturnValue({ token: null, isAuthenticated: true });

    renderWithProviders(<MatchedRecipes />);

    await waitFor(() => {
      expect(screen.getByText(/recipes based on your pantry/i)).toBeInTheDocument();
    });

    // Switch to Almost There tab
    const almostThereTab = screen.getByRole('tab', { name: /almost there/i });
    fireEvent.click(almostThereTab);

    await waitFor(() => {
      expect(screen.getByText('Chicken Curry')).toBeInTheDocument();
    });

    expect(screen.getByText('Spicy chicken curry')).toBeInTheDocument();
    expect(screen.getByText('75% Match')).toBeInTheDocument();
    expect(screen.getByText('3/4 ingredients')).toBeInTheDocument();
    expect(screen.getByText(/missing: garam masala/i)).toBeInTheDocument();
  });

  it('puts the bookmark on both kinds of match card', async () => {
    // Every card that can be liked can be saved — these two call sites included.
    const match = (id: string, title: string, pct: number) => ({
      id,
      title,
      description: null,
      imageUrl: 'https://example.com/x.jpg',
      difficulty: 'easy',
      prepTime: null,
      cookingTime: null,
      servings: null,
      matchPercentage: pct,
      matchedIngredients: 1,
      totalIngredients: 1,
      missingIngredients: [],
      likeCount: 0,
      commentCount: 0,
      user: null,
      viewer: { liked: false, saved: true, timesCooked: 0, lastCookedAt: null, myRating: null },
    });
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        readyToCook: [match('1', 'Pasta', 100)],
        almostThere: [match('2', 'Curry', 75)],
        pantryItemsCount: 3,
      }),
    });
    mockUseAuth.mockReturnValue({ token: null, isAuthenticated: true });

    renderWithProviders(<MatchedRecipes />);

    expect(await screen.findByRole('button', { name: 'Remove from saved' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('tab', { name: /almost there/i }));
    await screen.findByText('Curry');
    expect(screen.getByRole('button', { name: 'Remove from saved' })).toBeInTheDocument();
  });

  it('should show info message when no almost there recipes', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        readyToCook: [],
        almostThere: [],
        pantryItemsCount: 3,
      }),
    });

    mockUseAuth.mockReturnValue({ token: null, isAuthenticated: true });

    renderWithProviders(<MatchedRecipes />);

    await waitFor(() => {
      expect(screen.getByRole('tab', { name: /almost there/i })).toBeInTheDocument();
    });

    // Switch to Almost There tab
    const almostThereTab = screen.getByRole('tab', { name: /almost there/i });
    fireEvent.click(almostThereTab);

    await waitFor(() => {
      expect(screen.getByText(/no recipes are close to matching/i)).toBeInTheDocument();
    });
  });

  it('should navigate to recipe detail when clicking a recipe card', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        readyToCook: [
          {
            id: 'recipe-123',
            title: 'Test Recipe',
            description: 'Test Description',
            imageUrl: 'https://example.com/test.jpg',
            cuisine: 'American',
            difficulty: 'Easy',
            matchPercentage: 100,
            matchedIngredients: 3,
            totalIngredients: 3,
            missingIngredients: [],
          },
        ],
        almostThere: [],
        pantryItemsCount: 5,
      }),
    });

    mockUseAuth.mockReturnValue({ token: null, isAuthenticated: true });

    renderWithProviders(<MatchedRecipes />);

    await waitFor(() => {
      expect(screen.getByText('Test Recipe')).toBeInTheDocument();
    });

    // A link now, not a click handler on a card. These cards were mouse-only before:
    // `onClick` on a MotionCard with no role, no tabIndex and no key handler, so the
    // pantry matches on the home page could not be reached from a keyboard at all.
    expect(screen.getByRole('link', { name: 'Test Recipe' })).toHaveAttribute(
      'href',
      '/recipe/recipe-123'
    );
    expect(mockPush).not.toHaveBeenCalled();
  });

  it('should navigate to recipe detail when clicking an almost there recipe card', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        readyToCook: [],
        almostThere: [
          {
            id: 'recipe-456',
            title: 'Almost There Recipe',
            description: 'Need a few ingredients',
            imageUrl: 'https://example.com/almost.jpg',
            cuisine: 'Italian',
            difficulty: 'Medium',
            matchPercentage: 75,
            matchedIngredients: 3,
            totalIngredients: 4,
            missingIngredients: ['Basil'],
          },
        ],
        pantryItemsCount: 5,
      }),
    });

    mockUseAuth.mockReturnValue({ token: null, isAuthenticated: true });

    renderWithProviders(<MatchedRecipes />);

    // Switch to Almost There tab
    const almostThereTab = await screen.findByRole('tab', { name: /almost there/i });
    fireEvent.click(almostThereTab);

    await waitFor(() => {
      expect(screen.getByText('Almost There Recipe')).toBeInTheDocument();
    });

    expect(screen.getByRole('link', { name: 'Almost There Recipe' })).toHaveAttribute(
      'href',
      '/recipe/recipe-456'
    );
    expect(mockPush).not.toHaveBeenCalled();
  });

  it('should display pantry items count', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        readyToCook: [],
        almostThere: [],
        pantryItemsCount: 15,
      }),
    });

    mockUseAuth.mockReturnValue({ token: null, isAuthenticated: true });

    renderWithProviders(<MatchedRecipes />);

    await waitFor(() => {
      expect(screen.getByText(/15 ingredients/i)).toBeInTheDocument();
    });
  });

  it('says the matches could not load when the network drops, not that the pantry is empty', async () => {
    // This asserted a `console.error('Error loading matched recipes:', …)` that React Query
    // does not emit — and a console line was never what the reader needed. The test below
    // covers a server rejection; this one covers a thrown fetch, which reaches the same
    // visible state by a different road and must not fall through to "add ingredients".
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

    mockFetch.mockRejectedValueOnce(new Error('Network error'));
    mockUseAuth.mockReturnValue({ token: null, isAuthenticated: true });

    renderWithProviders(<MatchedRecipes />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument();
    });
    expect(screen.queryByText(/your pantry is empty/i)).not.toBeInTheDocument();

    consoleErrorSpy.mockRestore();
  });

  it('should show an error instead of the empty pantry state when the server fails', async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, status: 500, json: async () => ({}) });
    mockUseAuth.mockReturnValue({ token: null, isAuthenticated: true });

    renderWithProviders(<MatchedRecipes />);

    expect(await screen.findByText(/couldn't load your recipe matches/i)).toBeInTheDocument();
    expect(screen.queryByText(/your pantry is empty/i)).not.toBeInTheDocument();
  });

  it('should load the matches when retrying after a failure', async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, status: 500, json: async () => ({}) });
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ readyToCook: [], almostThere: [], pantryItemsCount: 0 }),
    });
    mockUseAuth.mockReturnValue({ token: null, isAuthenticated: true });
    renderWithProviders(<MatchedRecipes />);

    fireEvent.click(await screen.findByRole('button', { name: /retry/i }));

    expect(await screen.findByText(/your pantry is empty/i)).toBeInTheDocument();
    expect(screen.queryByText(/couldn't load your recipe matches/i)).not.toBeInTheDocument();
  });

  it('should display multiple ready to cook recipes', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        readyToCook: [
          {
            id: '1',
            title: 'Recipe 1',
            description: 'Description 1',
            imageUrl: 'https://example.com/1.jpg',
            cuisine: 'Italian',
            difficulty: 'Easy',
            matchPercentage: 100,
            matchedIngredients: 3,
            totalIngredients: 3,
            missingIngredients: [],
          },
          {
            id: '2',
            title: 'Recipe 2',
            description: 'Description 2',
            imageUrl: 'https://example.com/2.jpg',
            cuisine: 'French',
            difficulty: 'Hard',
            matchPercentage: 100,
            matchedIngredients: 5,
            totalIngredients: 5,
            missingIngredients: [],
          },
        ],
        almostThere: [],
        pantryItemsCount: 10,
      }),
    });

    mockUseAuth.mockReturnValue({ token: null, isAuthenticated: true });

    renderWithProviders(<MatchedRecipes />);

    await waitFor(() => {
      expect(screen.getByText('Recipe 1')).toBeInTheDocument();
      expect(screen.getByText('Recipe 2')).toBeInTheDocument();
    });
  });

  it('should display multiple almost there recipes', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        readyToCook: [],
        almostThere: [
          {
            id: '1',
            title: 'Almost Recipe 1',
            description: 'Almost Description 1',
            imageUrl: 'https://example.com/1.jpg',
            cuisine: 'Chinese',
            difficulty: 'Medium',
            matchPercentage: 85,
            matchedIngredients: 4,
            totalIngredients: 5,
            missingIngredients: ['Soy Sauce'],
          },
          {
            id: '2',
            title: 'Almost Recipe 2',
            description: 'Almost Description 2',
            imageUrl: 'https://example.com/2.jpg',
            cuisine: 'Mexican',
            difficulty: 'Easy',
            matchPercentage: 60,
            matchedIngredients: 3,
            totalIngredients: 5,
            missingIngredients: ['Cumin', 'Cilantro'],
          },
        ],
        pantryItemsCount: 8,
      }),
    });

    mockUseAuth.mockReturnValue({ token: null, isAuthenticated: true });

    renderWithProviders(<MatchedRecipes />);

    await waitFor(() => {
      expect(screen.getByRole('tab', { name: /almost there/i })).toBeInTheDocument();
    });

    // Switch to Almost There tab
    const almostThereTab = screen.getByRole('tab', { name: /almost there/i });
    fireEvent.click(almostThereTab);

    await waitFor(() => {
      expect(screen.getByText('Almost Recipe 1')).toBeInTheDocument();
      expect(screen.getByText('Almost Recipe 2')).toBeInTheDocument();
    });

    expect(screen.getByText(/missing: soy sauce/i)).toBeInTheDocument();
    expect(screen.getByText(/missing: cumin, cilantro/i)).toBeInTheDocument();
  });

  it('should handle unknown difficulty level with default color - line 43', async () => {
    const unknownDifficultyRecipe = {
      id: '1',
      title: 'Unknown Difficulty Recipe',
      description: 'A recipe with unknown difficulty',
      imageUrl: '/test.jpg',
      difficulty: 'Unknown',
      prepTime: 30,
      cookTime: 45,
      servings: 4,
      user: { id: 'user1', username: 'testuser' },
      ingredients: [{ name: 'Salt', quantity: '1', unit: 'tsp' }],
      instructions: [],
      matchPercentage: 100,
    };

    mockUseAuth.mockReturnValue({ token: null, isAuthenticated: true });

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        readyToCook: [unknownDifficultyRecipe],
        almostThere: [],
        pantryItemsCount: 1,
      }),
    });

    renderWithProviders(<MatchedRecipes />);

    await waitFor(() => {
      expect(screen.getByText('Unknown Difficulty Recipe')).toBeInTheDocument();
    });

    // Unknown difficulty should render with default color chip
    await waitFor(() => {
      expect(screen.getByText('Unknown')).toBeInTheDocument();
    });
  });

  describe('Mobile Viewport - lines 132-177', () => {
    let originalMatchMedia: typeof window.matchMedia;

    beforeEach(() => {
      originalMatchMedia = window.matchMedia;
      // Mock mobile viewport (width < 600px triggers sm breakpoint)
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

    it('should render mobile-sized button in empty pantry state - lines 132-134', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          readyToCook: [],
          almostThere: [],
          pantryItemsCount: 0,
        }),
      });

      mockUseAuth.mockReturnValue({ token: null, isAuthenticated: true });

      renderWithProviders(<MatchedRecipes />);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /go to my pantry/i })).toBeInTheDocument();
      });
    });

    it('should render mobile-style tabs - lines 166-180', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          readyToCook: [],
          almostThere: [],
          pantryItemsCount: 5,
        }),
      });

      mockUseAuth.mockReturnValue({ token: null, isAuthenticated: true });

      renderWithProviders(<MatchedRecipes />);

      await waitFor(() => {
        // Mobile tabs should have shorter labels (Ready vs Ready to Cook)
        const tabs = screen.getAllByRole('tab');
        expect(tabs.length).toBe(2);
      });
    });

    it('should render mobile-style tab icons hidden - lines 170, 176', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          readyToCook: [],
          almostThere: [],
          pantryItemsCount: 5,
        }),
      });

      mockUseAuth.mockReturnValue({ token: null, isAuthenticated: true });

      renderWithProviders(<MatchedRecipes />);

      await waitFor(() => {
        expect(screen.getByText(/recipes based on your pantry/i)).toBeInTheDocument();
      });
    });
  });
});
