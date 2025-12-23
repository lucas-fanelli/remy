import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import RecipeCard from '../RecipeCard';
import { Recipe } from '@/domain/types/recipe';

// Mock framer-motion - properly filter out animation props
jest.mock('framer-motion', () => {
  const React = require('react');

  // Create a wrapper that filters out Framer Motion props
  const createMotionComponent = (Component: any) => {
    return React.forwardRef(
      (
        {
          initial,
          animate,
          exit,
          transition,
          whileHover,
          whileTap,
          whileFocus,
          whileDrag,
          whileInView,
          layout,
          layoutId,
          variants,
          ...props
        }: any,
        ref: any
      ) => React.createElement(Component, { ...props, ref })
    );
  };

  const mockMotion: any = createMotionComponent;
  mockMotion.create = createMotionComponent;
  mockMotion.div = createMotionComponent('div');

  return {
    motion: mockMotion,
    AnimatePresence: ({ children }: any) => children,
  };
});

// Mock MotionContext
const mockSetSource = jest.fn();
jest.mock('@/contexts/MotionContext', () => ({
  useMotionContext: () => ({
    sourceType: null,
    recipeId: null,
    layoutId: null,
    setSource: mockSetSource,
    clearSource: jest.fn(),
  }),
}));

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

const mockRecipe: Recipe = {
  id: 'recipe-1',
  userId: 'user-1',
  title: 'Test Recipe',
  description: 'A delicious test recipe description',
  imageUrl: 'https://example.com/recipe.jpg',
  prepTime: 15,
  cookingTime: 30,
  servings: 4,
  difficulty: 'easy',
  ingredients: [
    { name: 'ingredient1', amount: '2', unit: 'cups' },
    { name: 'ingredient2', amount: '1', unit: 'tbsp' },
  ],
  instructions: [
    { step: 1, description: 'step1' },
    { step: 2, description: 'step2' },
  ],
  createdAt: new Date(),
  updatedAt: new Date(),
};

const mockRecipeWithAuthor: Recipe = {
  ...mockRecipe,
  author: {
    username: 'johndoe',
    fullName: 'John Doe',
    avatar: 'https://example.com/avatar.jpg',
  },
};

describe('RecipeCard Component', () => {
  it('should render recipe card with basic information', () => {
    renderWithTheme(<RecipeCard recipe={mockRecipe} />);

    expect(screen.getByText('Test Recipe')).toBeInTheDocument();
    expect(screen.getByText('A delicious test recipe description')).toBeInTheDocument();
    expect(screen.getByText('4 servings')).toBeInTheDocument();
    expect(screen.getByText('45 min')).toBeInTheDocument(); // 15 + 30
  });

  it('should display difficulty badge for non-owners', () => {
    renderWithTheme(<RecipeCard recipe={mockRecipe} currentUserId="different-user" />);

    expect(screen.getByText('easy')).toBeInTheDocument();
  });

  it('should display difficulty badge for all users including owners', () => {
    renderWithTheme(<RecipeCard recipe={mockRecipe} currentUserId="user-1" showActions={false} />);

    // Difficulty badge is now always shown
    expect(screen.getByText('easy')).toBeInTheDocument();
  });

  it('should call onClick when card is clicked', () => {
    const handleClick = jest.fn();
    renderWithTheme(<RecipeCard recipe={mockRecipe} onClick={handleClick} />);

    const title = screen.getByText('Test Recipe');
    fireEvent.click(title);

    expect(handleClick).toHaveBeenCalledTimes(1);
  });

  it('should navigate to recipe page when clicked without onClick prop - line 72', () => {
    renderWithTheme(<RecipeCard recipe={mockRecipe} />);

    const title = screen.getByText('Test Recipe');
    fireEvent.click(title);

    expect(mockPush).toHaveBeenCalledWith('/recipe/recipe-1');
  });

  it('should call onLike when like button is clicked', () => {
    const handleLike = jest.fn();
    renderWithTheme(<RecipeCard recipe={mockRecipe} onLike={handleLike} showActions={true} />);

    const likeButton = screen.getByRole('button', { name: /like/i });
    fireEvent.click(likeButton);

    expect(handleLike).toHaveBeenCalledTimes(1);
  });

  it('should call onComment when comment button is clicked', () => {
    const handleComment = jest.fn();
    renderWithTheme(
      <RecipeCard recipe={mockRecipe} onComment={handleComment} showActions={true} />
    );

    const commentButton = screen.getByRole('button', { name: /comments/i });
    fireEvent.click(commentButton);

    expect(handleComment).toHaveBeenCalledTimes(1);
  });

  it('should display like count', () => {
    renderWithTheme(<RecipeCard recipe={mockRecipe} likeCount={42} showActions={true} />);

    expect(screen.getByText('42')).toBeInTheDocument();
  });

  it('should display comment count', () => {
    renderWithTheme(<RecipeCard recipe={mockRecipe} commentCount={15} showActions={true} />);

    expect(screen.getByText('15')).toBeInTheDocument();
  });

  it('should show filled heart when liked', () => {
    renderWithTheme(<RecipeCard recipe={mockRecipe} liked={true} showActions={true} />);

    const likeButton = screen.getByRole('button', { name: /unlike/i });
    expect(likeButton).toBeInTheDocument();
  });

  it('should show outlined heart when not liked', () => {
    renderWithTheme(<RecipeCard recipe={mockRecipe} liked={false} showActions={true} />);

    const likeButton = screen.getByRole('button', { name: /like/i });
    expect(likeButton).toBeInTheDocument();
  });

  it('should show menu button for owner when showActions is true', () => {
    renderWithTheme(
      <RecipeCard recipe={mockRecipeWithAuthor} currentUserId="user-1" showActions={true} />
    );

    const menuButton = screen.getByRole('button', { name: /recipe options/i });
    expect(menuButton).toBeInTheDocument();
  });

  it('should not show menu button for non-owner', () => {
    renderWithTheme(
      <RecipeCard recipe={mockRecipeWithAuthor} currentUserId="different-user" showActions={true} />
    );

    const menuButton = screen.queryByRole('button', { name: /recipe options/i });
    expect(menuButton).not.toBeInTheDocument();
  });

  it('should open menu when menu button is clicked', () => {
    renderWithTheme(
      <RecipeCard recipe={mockRecipeWithAuthor} currentUserId="user-1" showActions={true} />
    );

    const menuButton = screen.getByRole('button', { name: /recipe options/i });
    fireEvent.click(menuButton);

    expect(screen.getByText('Edit Recipe')).toBeInTheDocument();
    expect(screen.getByText('Delete Recipe')).toBeInTheDocument();
  });

  it('should call onEdit when edit menu item is clicked', () => {
    const handleEdit = jest.fn();
    renderWithTheme(
      <RecipeCard
        recipe={mockRecipeWithAuthor}
        currentUserId="user-1"
        showActions={true}
        onEdit={handleEdit}
      />
    );

    const menuButton = screen.getByRole('button', { name: /recipe options/i });
    fireEvent.click(menuButton);

    const editMenuItem = screen.getByText('Edit Recipe');
    fireEvent.click(editMenuItem);

    expect(handleEdit).toHaveBeenCalledTimes(1);
  });

  it('should call onDelete when delete menu item is clicked', () => {
    const handleDelete = jest.fn();
    renderWithTheme(
      <RecipeCard
        recipe={mockRecipeWithAuthor}
        currentUserId="user-1"
        showActions={true}
        onDelete={handleDelete}
      />
    );

    const menuButton = screen.getByRole('button', { name: /recipe options/i });
    fireEvent.click(menuButton);

    const deleteMenuItem = screen.getByText('Delete Recipe');
    fireEvent.click(deleteMenuItem);

    expect(handleDelete).toHaveBeenCalledTimes(1);
  });

  it('should show medium difficulty with warning color', () => {
    const mediumRecipe = { ...mockRecipe, difficulty: 'medium' as const };
    renderWithTheme(<RecipeCard recipe={mediumRecipe} currentUserId="different-user" />);

    expect(screen.getByText('medium')).toBeInTheDocument();
  });

  it('should show hard difficulty with error color', () => {
    const hardRecipe = { ...mockRecipe, difficulty: 'hard' as const };
    renderWithTheme(<RecipeCard recipe={hardRecipe} currentUserId="different-user" />);

    expect(screen.getByText('hard')).toBeInTheDocument();
  });

  it('should calculate total time correctly', () => {
    const recipe = { ...mockRecipe, prepTime: 20, cookingTime: 40 };
    renderWithTheme(<RecipeCard recipe={recipe} />);

    expect(screen.getByText('60 min')).toBeInTheDocument();
  });

  describe('Author Display', () => {
    it('should display author information when author is provided', () => {
      renderWithTheme(<RecipeCard recipe={mockRecipeWithAuthor} />);

      expect(screen.getByText('John Doe')).toBeInTheDocument();
      expect(screen.getByAltText('johndoe')).toBeInTheDocument();
    });

    it('should not display author section when author is not provided', () => {
      renderWithTheme(<RecipeCard recipe={mockRecipe} />);

      expect(screen.queryByText('John Doe')).not.toBeInTheDocument();
    });

    it('should navigate to author profile when clicking author name', () => {
      renderWithTheme(<RecipeCard recipe={mockRecipeWithAuthor} />);

      const authorName = screen.getByText('John Doe');
      fireEvent.click(authorName);

      expect(mockPush).toHaveBeenCalledWith('/profile/johndoe');
    });

    it('should navigate to author profile when clicking avatar (lines 194-195)', () => {
      mockPush.mockClear();
      renderWithTheme(<RecipeCard recipe={mockRecipeWithAuthor} />);

      // Find the avatar and click it - it should stop propagation and navigate
      const avatar = screen.getByAltText('johndoe');
      fireEvent.click(avatar);

      expect(mockPush).toHaveBeenCalledWith('/profile/johndoe');
    });

    it('should display username when fullName is not provided', () => {
      const recipeWithUsernameOnly = {
        ...mockRecipe,
        author: {
          username: 'johndoe',
        },
      };
      renderWithTheme(<RecipeCard recipe={recipeWithUsernameOnly} />);

      expect(screen.getByText('johndoe')).toBeInTheDocument();
    });

    it('should display avatar with first letter when avatar URL is not provided', () => {
      const recipeWithoutAvatar = {
        ...mockRecipe,
        author: {
          username: 'johndoe',
          fullName: 'John Doe',
        },
      };
      renderWithTheme(<RecipeCard recipe={recipeWithoutAvatar} />);

      expect(screen.getByText('John Doe')).toBeInTheDocument();
      // Avatar should still exist (with first letter fallback)
      const avatar = screen.getByText('J');
      expect(avatar).toBeInTheDocument();
    });

    it('should display author avatar when provided', () => {
      renderWithTheme(<RecipeCard recipe={mockRecipeWithAuthor} />);

      const avatar = screen.getByAltText('johndoe');
      expect(avatar).toHaveAttribute('src', 'https://example.com/avatar.jpg');
    });

    it('should handle unknown difficulty level with default color - line 105', () => {
      const recipeWithUnknownDifficulty = {
        ...mockRecipe,
        difficulty: 'unknown' as any,
      };
      renderWithTheme(<RecipeCard recipe={recipeWithUnknownDifficulty} />);

      // Component should render without errors even with unknown difficulty
      expect(screen.getByText(mockRecipe.title)).toBeInTheDocument();
      // Difficulty chip should still be displayed
      expect(screen.getByText('unknown')).toBeInTheDocument();
    });

    it('should stop propagation when clicking on menu - line 345', async () => {
      const mockOnEdit = jest.fn();
      const mockOnDelete = jest.fn();

      renderWithTheme(
        <RecipeCard
          recipe={mockRecipeWithAuthor}
          currentUserId="user-1"
          showActions={true}
          onEdit={mockOnEdit}
          onDelete={mockOnDelete}
        />
      );

      // Find and click the more button to open menu
      const moreButtons = screen.getAllByRole('button');
      const moreButton = moreButtons.find((btn) => {
        const svg = btn.querySelector('svg');
        return svg && svg.getAttribute('data-testid') === 'MoreVertIcon';
      });

      expect(moreButton).toBeDefined();
      if (moreButton) {
        fireEvent.click(moreButton);

        // Wait for menu to open
        await waitFor(() => {
          expect(screen.getByRole('menu')).toBeInTheDocument();
        });

        // Click on the menu itself (not a menu item) to test stopPropagation
        const menu = screen.getByRole('menu');
        const clickEvent = new MouseEvent('click', { bubbles: true, cancelable: true });
        const stopPropagationSpy = jest.spyOn(clickEvent, 'stopPropagation');

        fireEvent(menu, clickEvent);

        // stopPropagation should have been called (line 345)
        expect(stopPropagationSpy).toHaveBeenCalled();
      }
    });
  });
});
