import { render, screen } from '@testing-library/react';
import React from 'react';
import Home from '../page';

/**
 * The home page and the session check.
 *
 * It used to render nothing until /api/auth/me answered, so on every app open and every
 * reload the public feed waited one extra round trip (from Spain, a trip to Washington)
 * before it even asked for recipes.
 */

const mockUseAuth = jest.fn();
jest.mock('@/contexts/AuthContext', () => ({
  useAuth: () => mockUseAuth(),
}));

jest.mock('@/contexts/CreateRecipeContext', () => ({
  useCreateRecipeDialog: () => ({ openCreate: jest.fn() }),
}));

// What each block does on its own is covered by its own suite; here only whether the page
// lets it render at all.
jest.mock('@/components/recipe/RecipeFeed', () => ({
  __esModule: true,
  default: () => <div data-testid="feed" />,
}));
jest.mock('@/components/recipe/MatchedRecipes', () => ({
  __esModule: true,
  default: () => <div data-testid="matches" />,
}));

describe('Home', () => {
  it('shows the feed while the session is still being checked', () => {
    mockUseAuth.mockReturnValue({ isLoading: true, isAuthenticated: false, user: null });

    render(<Home />);

    expect(screen.getByTestId('feed')).toBeInTheDocument();
    // The matches block is there to decide for itself whether to keep a place.
    expect(screen.getByTestId('matches')).toBeInTheDocument();
  });

  it('shows the feed once the session is known, signed in or not', () => {
    mockUseAuth.mockReturnValue({ isLoading: false, isAuthenticated: false, user: null });

    render(<Home />);

    expect(screen.getByTestId('feed')).toBeInTheDocument();
  });
});
