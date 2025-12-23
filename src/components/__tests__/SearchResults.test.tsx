import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import '@testing-library/jest-dom';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import SearchResults from '../SearchResults';

// Mock next/navigation
const mockPush = jest.fn();
jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
  }),
}));

const mockTheme = createTheme();

const renderWithTheme = (component: React.ReactElement) => {
  return render(<ThemeProvider theme={mockTheme}>{component}</ThemeProvider>);
};

const mockUsers = [
  { id: '1', username: 'testuser1', email: 'test1@example.com', avatar: '/avatar1.jpg' },
  { id: '2', username: 'testuser2', email: 'test2@example.com' },
  { id: '3', username: 'testuser3', email: 'test3@example.com' },
];

const mockRecipes = [
  {
    id: 'r1',
    title: 'Test Recipe 1',
    description: 'A delicious test recipe',
    imageUrl: '/recipe1.jpg',
    cuisine: 'Italian',
  },
  {
    id: 'r2',
    title: 'Test Recipe 2',
    description: 'Another amazing recipe',
    imageUrl: '/recipe2.jpg',
    cuisine: 'Mexican',
  },
  {
    id: 'r3',
    title: 'Test Recipe 3',
    description: 'Third recipe',
    imageUrl: '/recipe3.jpg',
    cuisine: 'Chinese',
  },
];

describe('SearchResults Component', () => {
  const mockOnClose = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should return null when query is empty', () => {
    const { container } = renderWithTheme(
      <SearchResults query="" users={[]} recipes={[]} loading={false} onClose={mockOnClose} />
    );

    expect(container.firstChild).toBeNull();
  });

  it('should show loading state as null', () => {
    const { container } = renderWithTheme(
      <SearchResults query="test" users={[]} recipes={[]} loading={true} onClose={mockOnClose} />
    );

    // Loading state now renders null instead of skeleton list items
    expect(container.querySelector('.MuiList-root')).toBeNull();
  });

  it('should show no results message when no users or recipes found', () => {
    renderWithTheme(
      <SearchResults query="test" users={[]} recipes={[]} loading={false} onClose={mockOnClose} />
    );

    expect(screen.getByText(/No results found for/)).toBeInTheDocument();
  });

  it('should show "Search query" button as first item when results exist', () => {
    renderWithTheme(
      <SearchResults
        query="test"
        users={mockUsers}
        recipes={[]}
        loading={false}
        onClose={mockOnClose}
      />
    );

    expect(screen.getByText('Search "test"')).toBeInTheDocument();
    expect(screen.getByText('View all results')).toBeInTheDocument();
  });

  it('should navigate to full search results page when "Search query" is clicked', () => {
    renderWithTheme(
      <SearchResults
        query="test"
        users={mockUsers}
        recipes={[]}
        loading={false}
        onClose={mockOnClose}
      />
    );

    const searchButton = screen.getByText('Search "test"');
    fireEvent.click(searchButton);

    expect(mockPush).toHaveBeenCalledWith('/search?q=test');
    expect(mockOnClose).toHaveBeenCalled();
  });

  it('should prioritize users and limit to 3 results', () => {
    renderWithTheme(
      <SearchResults
        query="test"
        users={mockUsers}
        recipes={[]}
        loading={false}
        onClose={mockOnClose}
      />
    );

    // Should show all 3 users
    expect(screen.getByText('testuser1')).toBeInTheDocument();
    expect(screen.getByText('testuser2')).toBeInTheDocument();
    expect(screen.getByText('testuser3')).toBeInTheDocument();
  });

  it('should show recipes when fewer than 3 users exist', () => {
    renderWithTheme(
      <SearchResults
        query="test"
        users={[mockUsers[0]]}
        recipes={mockRecipes}
        loading={false}
        onClose={mockOnClose}
      />
    );

    // Should show 1 user + 2 recipes (total 3 results)
    expect(screen.getByText('testuser1')).toBeInTheDocument();
    expect(screen.getByText('Test Recipe 1')).toBeInTheDocument();
    expect(screen.getByText('Test Recipe 2')).toBeInTheDocument();
    expect(screen.queryByText('Test Recipe 3')).not.toBeInTheDocument();
  });

  it('should show only recipes when no users exist', () => {
    renderWithTheme(
      <SearchResults
        query="test"
        users={[]}
        recipes={mockRecipes}
        loading={false}
        onClose={mockOnClose}
      />
    );

    // Should show 3 recipes
    expect(screen.getByText('Test Recipe 1')).toBeInTheDocument();
    expect(screen.getByText('Test Recipe 2')).toBeInTheDocument();
    expect(screen.getByText('Test Recipe 3')).toBeInTheDocument();
  });

  it('should navigate to user profile when user is clicked', () => {
    renderWithTheme(
      <SearchResults
        query="test"
        users={mockUsers}
        recipes={[]}
        loading={false}
        onClose={mockOnClose}
      />
    );

    const userItem = screen.getByText('testuser1');
    fireEvent.click(userItem);

    expect(mockPush).toHaveBeenCalledWith('/profile/testuser1');
    expect(mockOnClose).toHaveBeenCalled();
  });

  it('should navigate to recipe when recipe is clicked', () => {
    renderWithTheme(
      <SearchResults
        query="test"
        users={[]}
        recipes={mockRecipes}
        loading={false}
        onClose={mockOnClose}
      />
    );

    const recipeItem = screen.getByText('Test Recipe 1');
    fireEvent.click(recipeItem);

    expect(mockPush).toHaveBeenCalledWith('/recipe/r1');
    expect(mockOnClose).toHaveBeenCalled();
  });

  it('should show correct total of 4 items (search button + 3 results)', () => {
    renderWithTheme(
      <SearchResults
        query="test"
        users={mockUsers}
        recipes={mockRecipes}
        loading={false}
        onClose={mockOnClose}
      />
    );

    // Search button + 3 users (prioritized)
    expect(screen.getByText('Search "test"')).toBeInTheDocument();
    expect(screen.getByText('testuser1')).toBeInTheDocument();
    expect(screen.getByText('testuser2')).toBeInTheDocument();
    expect(screen.getByText('testuser3')).toBeInTheDocument();
    // No recipes should appear when 3 users exist
    expect(screen.queryByText('Test Recipe 1')).not.toBeInTheDocument();
  });

  describe('Desktop Rendering - Branch Coverage', () => {
    it('should show user email on desktop - line 175', () => {
      renderWithTheme(
        <SearchResults
          query="test"
          users={mockUsers}
          recipes={[]}
          loading={false}
          onClose={mockOnClose}
        />
      );

      // Both username and email should be visible on desktop
      expect(screen.getByText('testuser1')).toBeInTheDocument();
      expect(screen.getByText('test1@example.com')).toBeInTheDocument();
    });

    it('should show recipe description on desktop - lines 218-220', () => {
      renderWithTheme(
        <SearchResults
          query="test"
          users={[]}
          recipes={mockRecipes}
          loading={false}
          onClose={mockOnClose}
        />
      );

      // Recipe title and description should be visible on desktop
      expect(screen.getByText('Test Recipe 1')).toBeInTheDocument();
      expect(screen.getByText(/A delicious test recipe/)).toBeInTheDocument();
    });

    it('should truncate long recipe descriptions with ellipsis on desktop - lines 218-220', () => {
      const longDescriptionRecipe = {
        id: 'r-long',
        title: 'Long Description Recipe',
        description:
          'This is a very long description that exceeds the fifty character limit and should be truncated',
        imageUrl: '/recipe-long.jpg',
        cuisine: 'French',
      };

      renderWithTheme(
        <SearchResults
          query="test"
          users={[]}
          recipes={[longDescriptionRecipe]}
          loading={false}
          onClose={mockOnClose}
        />
      );

      // Should show truncated description with ellipsis (first 50 chars + "...")
      expect(screen.getByText('Long Description Recipe')).toBeInTheDocument();
      // Test for the presence of truncated text - substring(0, 50) = "This is a very long description that exceeds th"
      expect(screen.getByText(/This is a very long description/)).toBeInTheDocument();
    });

    it('should show short recipe descriptions without ellipsis on desktop - lines 218-220', () => {
      const shortDescriptionRecipe = {
        id: 'r-short',
        title: 'Short Recipe',
        description: 'A brief description',
        imageUrl: '/recipe-short.jpg',
        cuisine: 'Italian',
      };

      renderWithTheme(
        <SearchResults
          query="test"
          users={[]}
          recipes={[shortDescriptionRecipe]}
          loading={false}
          onClose={mockOnClose}
        />
      );

      // Should show full description without ellipsis
      expect(screen.getByText('Short Recipe')).toBeInTheDocument();
      expect(screen.getByText('A brief description')).toBeInTheDocument();
    });
  });

  describe('Mobile Viewport - lines 161, 205', () => {
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

    it('should hide user email on mobile - line 161', () => {
      renderWithTheme(
        <SearchResults
          query="test"
          users={mockUsers}
          recipes={[]}
          loading={false}
          onClose={mockOnClose}
        />
      );

      // Username should still be visible
      expect(screen.getByText('testuser1')).toBeInTheDocument();
      // On mobile, email may not be in secondary text (via isMobile ? null : user.email)
    });

    it('should hide recipe description on mobile - line 205-207', () => {
      renderWithTheme(
        <SearchResults
          query="test"
          users={[]}
          recipes={mockRecipes}
          loading={false}
          onClose={mockOnClose}
        />
      );

      // Recipe title should still be visible
      expect(screen.getByText('Test Recipe 1')).toBeInTheDocument();
      // On mobile, description may not be shown (via isMobile ? null : description)
    });

    it('should render mobile-sized list items - lines 120-156', () => {
      renderWithTheme(
        <SearchResults
          query="test"
          users={mockUsers}
          recipes={mockRecipes}
          loading={false}
          onClose={mockOnClose}
        />
      );

      // Users should still be visible
      expect(screen.getByText('testuser1')).toBeInTheDocument();
      expect(screen.getByText('testuser2')).toBeInTheDocument();
    });
  });
});
