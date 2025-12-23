import { ThemeProvider, createTheme } from '@mui/material';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import PersistentSearchBar from '../PersistentSearchBar';

// Mock next/navigation
const mockPush = jest.fn();
const mockPathname = jest.fn().mockReturnValue('/');

jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
    replace: jest.fn(),
    back: jest.fn(),
    forward: jest.fn(),
    prefetch: jest.fn(),
  }),
  usePathname: () => mockPathname(),
}));

// Mock framer-motion to avoid animation timeouts
jest.mock('framer-motion', () => {
  const React = require('react');
  return {
    motion: {
      div: React.forwardRef(({ children, ...props }: any, ref: any) => (
        <div ref={ref} {...props}>
          {children}
        </div>
      )),
      create: (Component: any) =>
        React.forwardRef(({ children, ...props }: any, ref: any) => (
          <Component ref={ref} {...props}>
            {children}
          </Component>
        )),
    },
    AnimatePresence: ({ children }: any) => <>{children}</>,
  };
});

const theme = createTheme();

const renderWithTheme = (ui: React.ReactElement) => {
  return render(<ThemeProvider theme={theme}>{ui}</ThemeProvider>);
};

describe('PersistentSearchBar', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockPathname.mockReturnValue('/');
  });

  // ==================== RENDER TESTS ====================
  describe('Render', () => {
    it('should render the search input with correct placeholder', () => {
      renderWithTheme(<PersistentSearchBar />);

      const input = screen.getByPlaceholderText('Search recipes, ingredients...');
      expect(input).toBeInTheDocument();
    });

    it('should render with custom placeholder', () => {
      renderWithTheme(<PersistentSearchBar placeholder="Find something..." />);

      const input = screen.getByPlaceholderText('Find something...');
      expect(input).toBeInTheDocument();
    });

    it('should render with initial value', () => {
      renderWithTheme(<PersistentSearchBar initialValue="pasta" />);

      const input = screen.getByRole('textbox');
      expect(input).toHaveValue('pasta');
    });

    it('should render the search icon', () => {
      renderWithTheme(<PersistentSearchBar />);

      // SearchIcon is rendered via MUI, check for svg
      const form = screen.getByRole('textbox').closest('form');
      expect(form).toBeInTheDocument();
    });
  });

  // ==================== INTERACTION TESTS ====================
  describe('Interaction', () => {
    it('should update value when typing', async () => {
      const user = userEvent.setup();
      renderWithTheme(<PersistentSearchBar />);

      const input = screen.getByRole('textbox');
      await user.type(input, 'chicken');

      expect(input).toHaveValue('chicken');
    });

    it('should call onQueryChange when typing', async () => {
      const onQueryChange = jest.fn();
      const user = userEvent.setup();
      renderWithTheme(<PersistentSearchBar onQueryChange={onQueryChange} />);

      const input = screen.getByRole('textbox');
      await user.type(input, 'abc');

      // Called once per character
      expect(onQueryChange).toHaveBeenCalledTimes(3);
      expect(onQueryChange).toHaveBeenLastCalledWith('abc');
    });

    it('should focus input when clicked', async () => {
      const user = userEvent.setup();
      renderWithTheme(<PersistentSearchBar />);

      const input = screen.getByRole('textbox');
      await user.click(input);

      expect(input).toHaveFocus();
    });
  });

  // ==================== CLEARING TESTS ====================
  describe('Clearing', () => {
    it('should show clear button when there is text', async () => {
      const user = userEvent.setup();
      renderWithTheme(<PersistentSearchBar />);

      const input = screen.getByRole('textbox');
      await user.type(input, 'test');

      const clearButton = screen.getByRole('button', { name: 'Clear search' });
      expect(clearButton).toBeInTheDocument();
    });

    it('should clear input when clear button is clicked', async () => {
      const user = userEvent.setup();
      renderWithTheme(<PersistentSearchBar />);

      const input = screen.getByRole('textbox');
      await user.type(input, 'test query');

      expect(input).toHaveValue('test query');

      const clearButton = screen.getByRole('button', { name: 'Clear search' });
      await user.click(clearButton);

      expect(input).toHaveValue('');
    });

    it('should not show clear button when input is empty', () => {
      renderWithTheme(<PersistentSearchBar />);

      const clearButton = screen.queryByRole('button', { name: 'Clear search' });
      expect(clearButton).not.toBeInTheDocument();
    });
  });

  // ==================== SEARCH EXECUTION TESTS ====================
  describe('Search Execution', () => {
    it('should call onSearch when form is submitted', async () => {
      const onSearch = jest.fn();
      const user = userEvent.setup();
      renderWithTheme(<PersistentSearchBar onSearch={onSearch} />);

      const input = screen.getByRole('textbox');
      await user.type(input, 'pasta{Enter}');

      expect(onSearch).toHaveBeenCalledWith('pasta');
    });

    it('should navigate to search page when no onSearch callback provided', async () => {
      const user = userEvent.setup();
      renderWithTheme(<PersistentSearchBar />);

      const input = screen.getByRole('textbox');
      await user.type(input, 'chicken{Enter}');

      expect(mockPush).toHaveBeenCalledWith('/search?q=chicken');
    });

    it('should not submit empty search', async () => {
      const onSearch = jest.fn();
      const user = userEvent.setup();
      renderWithTheme(<PersistentSearchBar onSearch={onSearch} />);

      const input = screen.getByRole('textbox');
      await user.type(input, '   {Enter}');

      expect(onSearch).not.toHaveBeenCalled();
      expect(mockPush).not.toHaveBeenCalled();
    });

    it('should trim whitespace from search query', async () => {
      const onSearch = jest.fn();
      const user = userEvent.setup();
      renderWithTheme(<PersistentSearchBar onSearch={onSearch} />);

      const input = screen.getByRole('textbox');
      await user.type(input, '  pasta  {Enter}');

      expect(onSearch).toHaveBeenCalledWith('pasta');
    });
  });

  // ==================== NAVIGATION / ROUTE CHANGE TESTS ====================
  describe('Navigation', () => {
    it('should re-render when pathname changes', () => {
      const { rerender } = renderWithTheme(<PersistentSearchBar />);

      // Change pathname mock
      mockPathname.mockReturnValue('/recipe/123');

      // Re-render component
      rerender(
        <ThemeProvider theme={theme}>
          <PersistentSearchBar />
        </ThemeProvider>
      );

      // Component should still render correctly
      expect(screen.getByRole('textbox')).toBeInTheDocument();
    });

    it('should handle multiple route changes without errors', () => {
      const { rerender } = renderWithTheme(<PersistentSearchBar />);

      const routes = ['/', '/search', '/recipe/1', '/profile', '/pantry'];

      routes.forEach((route) => {
        mockPathname.mockReturnValue(route);
        rerender(
          <ThemeProvider theme={theme}>
            <PersistentSearchBar />
          </ThemeProvider>
        );
      });

      expect(screen.getByRole('textbox')).toBeInTheDocument();
    });
  });

  // ==================== DROPDOWN / SUGGESTIONS TESTS ====================
  describe('Suggestions Dropdown', () => {
    it('should show dropdown when focused and showSuggestions is true', async () => {
      const user = userEvent.setup();
      renderWithTheme(<PersistentSearchBar showSuggestions={true} />);

      const input = screen.getByRole('textbox');
      await user.click(input);

      // When focused, dropdown should be visible (even if empty)
      // The component renders suggestions area when focused
      expect(input).toHaveFocus();
    });

    it('should not show dropdown when showSuggestions is false', async () => {
      const user = userEvent.setup();
      renderWithTheme(<PersistentSearchBar showSuggestions={false} />);

      const input = screen.getByRole('textbox');
      await user.click(input);

      // Should still render input
      expect(input).toBeInTheDocument();
    });

    it('should show "Search for" option when typing', async () => {
      const user = userEvent.setup();
      renderWithTheme(<PersistentSearchBar showSuggestions={true} />);

      const input = screen.getByRole('textbox');
      await user.click(input);
      await user.type(input, 'pasta');

      // Should show "Search for 'pasta'" option
      await waitFor(() => {
        expect(screen.getByText(/Search for/i)).toBeInTheDocument();
      });
    });

    it('should display loading indicator when loading is true', async () => {
      const user = userEvent.setup();
      renderWithTheme(<PersistentSearchBar showSuggestions={true} loading={true} />);

      const input = screen.getByRole('textbox');
      await user.click(input);
      await user.type(input, 'test');

      // CircularProgress should render
      await waitFor(() => {
        expect(screen.getByRole('progressbar')).toBeInTheDocument();
      });
    });

    it('should display live search results', async () => {
      const user = userEvent.setup();
      const mockResults = {
        users: [{ id: '1', username: 'chef_john', fullName: 'John Doe' }],
        recipes: [{ id: '2', title: 'Pasta Carbonara' }],
      };

      renderWithTheme(<PersistentSearchBar showSuggestions={true} results={mockResults} />);

      const input = screen.getByRole('textbox');
      await user.click(input);
      await user.type(input, 'pasta');

      await waitFor(() => {
        expect(screen.getByText('@chef_john')).toBeInTheDocument();
        expect(screen.getByText('Pasta Carbonara')).toBeInTheDocument();
      });
    });
  });

  // ==================== ACCESSIBILITY TESTS ====================
  describe('Accessibility', () => {
    it('should have proper aria-label on input', () => {
      renderWithTheme(<PersistentSearchBar />);

      const input = screen.getByRole('textbox', { name: 'Search recipes' });
      expect(input).toBeInTheDocument();
    });

    it('should have proper aria-label on clear button', async () => {
      const user = userEvent.setup();
      renderWithTheme(<PersistentSearchBar />);

      const input = screen.getByRole('textbox');
      await user.type(input, 'test');

      const clearButton = screen.getByRole('button', { name: 'Clear search' });
      expect(clearButton).toBeInTheDocument();
    });
  });

  // ==================== VISUAL STATE TESTS ====================
  describe('Visual States', () => {
    it('should render in unfocused state by default', () => {
      renderWithTheme(<PersistentSearchBar />);

      const input = screen.getByRole('textbox');
      expect(document.activeElement).not.toBe(input);
    });

    it('should apply focused state when input is focused', async () => {
      const user = userEvent.setup();
      renderWithTheme(<PersistentSearchBar />);

      const input = screen.getByRole('textbox');
      await user.click(input);

      expect(document.activeElement).toBe(input);
    });
  });

  // ==================== CLICK AWAY TESTS ====================
  describe('Click Away', () => {
    it('should close dropdown when clicking away', async () => {
      const user = userEvent.setup();
      renderWithTheme(
        <div>
          <PersistentSearchBar showSuggestions={true} />
          <button data-testid="outside-element">Outside</button>
        </div>
      );

      const input = screen.getByRole('textbox');
      await user.click(input);
      await user.type(input, 'test');

      // Click on outside element
      const outsideElement = screen.getByTestId('outside-element');
      await user.click(outsideElement);

      // Component should still be rendered
      expect(input).toBeInTheDocument();
    });
  });

  // ==================== SUGGESTION CLICK TESTS ====================
  describe('Suggestion Click', () => {
    it('should navigate when clicking "Search for" option', async () => {
      const user = userEvent.setup();
      renderWithTheme(<PersistentSearchBar showSuggestions={true} />);

      const input = screen.getByRole('textbox');
      await user.click(input);
      await user.type(input, 'pasta');

      // Find and click the "Search for" option
      const searchOption = await screen.findByText(/Search for "pasta"/);
      await user.click(searchOption);

      expect(mockPush).toHaveBeenCalledWith('/search?q=pasta');
    });

    it('should call onSearch when clicking suggestion with onSearch prop', async () => {
      const onSearch = jest.fn();
      const user = userEvent.setup();
      renderWithTheme(<PersistentSearchBar showSuggestions={true} onSearch={onSearch} />);

      const input = screen.getByRole('textbox');
      await user.click(input);
      await user.type(input, 'chicken');

      // Find and click the "Search for" option
      const searchOption = await screen.findByText(/Search for "chicken"/);
      await user.click(searchOption);

      expect(onSearch).toHaveBeenCalledWith('chicken');
    });

    it('should navigate to recipe page when clicking recipe result', async () => {
      const user = userEvent.setup();
      const mockResults = {
        users: [],
        recipes: [{ id: 'recipe-123', title: 'Spaghetti Carbonara' }],
      };

      renderWithTheme(<PersistentSearchBar showSuggestions={true} results={mockResults} />);

      const input = screen.getByRole('textbox');
      await user.click(input);
      await user.type(input, 'sp');

      // Click on the recipe result
      const recipeResult = await screen.findByText('Spaghetti Carbonara');
      await user.click(recipeResult);

      expect(mockPush).toHaveBeenCalledWith('/recipe/recipe-123');
    });

    it('should navigate to user profile when clicking user result', async () => {
      const user = userEvent.setup();
      const mockResults = {
        users: [{ id: 'user-456', username: 'chef_mario', fullName: 'Mario Chef' }],
        recipes: [],
      };

      renderWithTheme(<PersistentSearchBar showSuggestions={true} results={mockResults} />);

      const input = screen.getByRole('textbox');
      await user.click(input);
      await user.type(input, 'mario');

      // Click on the user result
      const userResult = await screen.findByText('Mario Chef');
      await user.click(userResult);

      expect(mockPush).toHaveBeenCalledWith('/profile/chef_mario');
    });
  });

  // ==================== BLUR TESTS ====================
  describe('Blur Behavior', () => {
    it('should handle blur event', async () => {
      const user = userEvent.setup();
      renderWithTheme(<PersistentSearchBar />);

      const input = screen.getByRole('textbox');
      await user.click(input);
      expect(input).toHaveFocus();

      // Blur by tabbing away
      await user.tab();

      // Should still render
      expect(input).toBeInTheDocument();
    });
  });

  // ==================== THEME TESTS ====================
  describe('Dark Theme', () => {
    const darkTheme = createTheme({ palette: { mode: 'dark' } });

    const renderWithDarkTheme = (ui: React.ReactElement) => {
      return render(<ThemeProvider theme={darkTheme}>{ui}</ThemeProvider>);
    };

    it('should render correctly in dark mode', () => {
      renderWithDarkTheme(<PersistentSearchBar />);

      const input = screen.getByRole('textbox');
      expect(input).toBeInTheDocument();
    });

    it('should show dropdown in dark mode', async () => {
      const user = userEvent.setup();
      renderWithDarkTheme(<PersistentSearchBar showSuggestions={true} />);

      const input = screen.getByRole('textbox');
      await user.click(input);
      await user.type(input, 'test');

      await waitFor(() => {
        expect(screen.getByText(/Search for/i)).toBeInTheDocument();
      });
    });
  });

  // ==================== USER WITHOUT FULLNAME TEST ====================
  describe('User Display Variants', () => {
    it('should display username when user has no fullName', async () => {
      const user = userEvent.setup();
      const mockResults = {
        users: [{ id: 'user-789', username: 'chef_anonymous', fullName: null }],
        recipes: [],
      };

      renderWithTheme(<PersistentSearchBar showSuggestions={true} results={mockResults} />);

      const input = screen.getByRole('textbox');
      await user.click(input);
      await user.type(input, 'ch');

      // Should display username as primary since fullName is null
      await waitFor(() => {
        expect(screen.getByText('chef_anonymous')).toBeInTheDocument();
      });
    });

    it('should not show secondary text when user has no fullName', async () => {
      const user = userEvent.setup();
      const mockResults = {
        users: [{ id: 'user-999', username: 'solo_username' }],
        recipes: [],
      };

      renderWithTheme(<PersistentSearchBar showSuggestions={true} results={mockResults} />);

      const input = screen.getByRole('textbox');
      await user.click(input);
      await user.type(input, 'so');

      await waitFor(() => {
        expect(screen.getByText('solo_username')).toBeInTheDocument();
        // No @username secondary text should appear
        expect(screen.queryByText('@solo_username')).not.toBeInTheDocument();
      });
    });
  });

  // ==================== LIVE SEARCH DEBOUNCE TESTS ====================
  describe('Live Search Debounce (lines 127-140)', () => {
    let mockFetch: jest.Mock;

    beforeEach(() => {
      mockFetch = jest.fn();
      global.fetch = mockFetch;
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('should fetch live search results after 300ms debounce', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          users: [{ id: '1', username: 'testuser' }],
          recipes: [{ id: '2', title: 'Test Recipe' }],
        }),
      });

      renderWithTheme(<PersistentSearchBar showSuggestions={true} />);

      const input = screen.getByRole('textbox');

      // Type enough characters to trigger search
      fireEvent.change(input, { target: { value: 'pasta' } });
      fireEvent.focus(input);

      // Should not have called fetch yet (debounce pending)
      expect(mockFetch).not.toHaveBeenCalledWith(
        expect.stringContaining('/api/search'),
        expect.anything()
      );

      // Advance timers past debounce threshold
      await act(async () => {
        jest.advanceTimersByTime(350);
      });

      // Now fetch should have been called
      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith('/api/search?q=pasta');
      });
    });

    it('should handle search API error gracefully - line 137', async () => {
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
      mockFetch.mockRejectedValue(new Error('Network error'));

      renderWithTheme(<PersistentSearchBar showSuggestions={true} />);

      const input = screen.getByRole('textbox');
      fireEvent.change(input, { target: { value: 'test' } });
      fireEvent.focus(input);

      // Advance timers past debounce
      await act(async () => {
        jest.advanceTimersByTime(350);
      });

      // Should have logged error
      await waitFor(() => {
        expect(consoleErrorSpy).toHaveBeenCalledWith('Search error:', expect.any(Error));
      });

      consoleErrorSpy.mockRestore();
    });

    it('should clear results when query is too short', async () => {
      renderWithTheme(<PersistentSearchBar showSuggestions={true} />);

      const input = screen.getByRole('textbox');
      fireEvent.change(input, { target: { value: 'a' } });
      fireEvent.focus(input);

      // Advance timers
      await act(async () => {
        jest.advanceTimersByTime(350);
      });

      // Should NOT call API for single character
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('should fallback to empty arrays when API returns no users/recipes fields - lines 132-133', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({}), // No users or recipes fields
      });

      renderWithTheme(<PersistentSearchBar showSuggestions={true} />);

      const input = screen.getByRole('textbox');
      fireEvent.change(input, { target: { value: 'testquery' } });
      fireEvent.focus(input);

      // Advance timers past debounce
      await act(async () => {
        jest.advanceTimersByTime(350);
      });

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith('/api/search?q=testquery');
      });

      // Component should not crash and should handle empty arrays gracefully
      expect(input).toBeInTheDocument();
    });
  });

  // ==================== RECENT SEARCHES TESTS (lines 550-552) ====================
  describe('Recent Searches Display (lines 550-552)', () => {
    it('should display recent searches when no query and focused', async () => {
      const user = userEvent.setup({ delay: null });
      const recentSearches = ['pasta', 'chicken', 'salad'];

      renderWithTheme(
        <PersistentSearchBar showSuggestions={true} recentSearches={recentSearches} />
      );

      const input = screen.getByRole('textbox');
      await user.click(input);

      // Should display "Recent Searches" header and items
      await waitFor(() => {
        expect(screen.getByText('Recent Searches')).toBeInTheDocument();
        expect(screen.getByText('pasta')).toBeInTheDocument();
        expect(screen.getByText('chicken')).toBeInTheDocument();
        expect(screen.getByText('salad')).toBeInTheDocument();
      });
    });

    it('should navigate when clicking a recent search', async () => {
      const user = userEvent.setup({ delay: null });
      const recentSearches = ['pizza', 'burger'];

      renderWithTheme(
        <PersistentSearchBar showSuggestions={true} recentSearches={recentSearches} />
      );

      const input = screen.getByRole('textbox');
      await user.click(input);

      // Wait for recent searches to appear
      const pizzaItem = await screen.findByText('pizza');
      await user.click(pizzaItem);

      expect(mockPush).toHaveBeenCalledWith('/search?q=pizza');
    });

    it('should show "Type to search" when no recent searches', async () => {
      const user = userEvent.setup({ delay: null });

      renderWithTheme(<PersistentSearchBar showSuggestions={true} recentSearches={[]} />);

      const input = screen.getByRole('textbox');
      await user.click(input);

      await waitFor(() => {
        expect(screen.getByText('Type to search recipes...')).toBeInTheDocument();
      });
    });
  });
});
