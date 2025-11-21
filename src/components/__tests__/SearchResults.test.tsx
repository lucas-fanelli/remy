import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
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
  return render(
    <ThemeProvider theme={mockTheme}>
      {component}
    </ThemeProvider>
  );
};

const mockUsers = [
  { id: '1', username: 'testuser1', email: 'test1@example.com', avatar: '/avatar1.jpg' },
  { id: '2', username: 'testuser2', email: 'test2@example.com' },
  { id: '3', username: 'testuser3', email: 'test3@example.com' },
];

const mockRecipes = [
  { id: 'r1', title: 'Test Recipe 1', description: 'A delicious test recipe', imageUrl: '/recipe1.jpg', cuisine: 'Italian' },
  { id: 'r2', title: 'Test Recipe 2', description: 'Another amazing recipe', imageUrl: '/recipe2.jpg', cuisine: 'Mexican' },
  { id: 'r3', title: 'Test Recipe 3', description: 'Third recipe', imageUrl: '/recipe3.jpg', cuisine: 'Chinese' },
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

  it('should show loading state', () => {
    renderWithTheme(
      <SearchResults query="test" users={[]} recipes={[]} loading={true} onClose={mockOnClose} />
    );

    expect(screen.getByRole('progressbar')).toBeInTheDocument();
  });

  it('should show no results message when no users or recipes found', () => {
    renderWithTheme(
      <SearchResults query="test" users={[]} recipes={[]} loading={false} onClose={mockOnClose} />
    );

    expect(screen.getByText(/No results found for/)).toBeInTheDocument();
  });

  it('should show "Search query" button as first item when results exist', () => {
    renderWithTheme(
      <SearchResults query="test" users={mockUsers} recipes={[]} loading={false} onClose={mockOnClose} />
    );

    expect(screen.getByText('Search "test"')).toBeInTheDocument();
    expect(screen.getByText('View all results')).toBeInTheDocument();
  });

  it('should navigate to full search results page when "Search query" is clicked', () => {
    renderWithTheme(
      <SearchResults query="test" users={mockUsers} recipes={[]} loading={false} onClose={mockOnClose} />
    );

    const searchButton = screen.getByText('Search "test"');
    fireEvent.click(searchButton);

    expect(mockPush).toHaveBeenCalledWith('/search?q=test');
    expect(mockOnClose).toHaveBeenCalled();
  });

  it('should prioritize users and limit to 3 results', () => {
    renderWithTheme(
      <SearchResults query="test" users={mockUsers} recipes={[]} loading={false} onClose={mockOnClose} />
    );

    // Should show all 3 users
    expect(screen.getByText('testuser1')).toBeInTheDocument();
    expect(screen.getByText('testuser2')).toBeInTheDocument();
    expect(screen.getByText('testuser3')).toBeInTheDocument();
  });

  it('should show recipes when fewer than 3 users exist', () => {
    renderWithTheme(
      <SearchResults query="test" users={[mockUsers[0]]} recipes={mockRecipes} loading={false} onClose={mockOnClose} />
    );

    // Should show 1 user + 2 recipes (total 3 results)
    expect(screen.getByText('testuser1')).toBeInTheDocument();
    expect(screen.getByText('Test Recipe 1')).toBeInTheDocument();
    expect(screen.getByText('Test Recipe 2')).toBeInTheDocument();
    expect(screen.queryByText('Test Recipe 3')).not.toBeInTheDocument();
  });

  it('should show only recipes when no users exist', () => {
    renderWithTheme(
      <SearchResults query="test" users={[]} recipes={mockRecipes} loading={false} onClose={mockOnClose} />
    );

    // Should show 3 recipes
    expect(screen.getByText('Test Recipe 1')).toBeInTheDocument();
    expect(screen.getByText('Test Recipe 2')).toBeInTheDocument();
    expect(screen.getByText('Test Recipe 3')).toBeInTheDocument();
  });

  it('should navigate to user profile when user is clicked', () => {
    renderWithTheme(
      <SearchResults query="test" users={mockUsers} recipes={[]} loading={false} onClose={mockOnClose} />
    );

    const userItem = screen.getByText('testuser1');
    fireEvent.click(userItem);

    expect(mockPush).toHaveBeenCalledWith('/profile/testuser1');
    expect(mockOnClose).toHaveBeenCalled();
  });

  it('should navigate to recipe when recipe is clicked', () => {
    renderWithTheme(
      <SearchResults query="test" users={[]} recipes={mockRecipes} loading={false} onClose={mockOnClose} />
    );

    const recipeItem = screen.getByText('Test Recipe 1');
    fireEvent.click(recipeItem);

    expect(mockPush).toHaveBeenCalledWith('/recipe/r1');
    expect(mockOnClose).toHaveBeenCalled();
  });

  it('should show correct total of 4 items (search button + 3 results)', () => {
    renderWithTheme(
      <SearchResults query="test" users={mockUsers} recipes={mockRecipes} loading={false} onClose={mockOnClose} />
    );

    // Search button + 3 users (prioritized)
    expect(screen.getByText('Search "test"')).toBeInTheDocument();
    expect(screen.getByText('testuser1')).toBeInTheDocument();
    expect(screen.getByText('testuser2')).toBeInTheDocument();
    expect(screen.getByText('testuser3')).toBeInTheDocument();
    // No recipes should appear when 3 users exist
    expect(screen.queryByText('Test Recipe 1')).not.toBeInTheDocument();
  });
});
