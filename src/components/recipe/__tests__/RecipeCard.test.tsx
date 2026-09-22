import { ThemeProvider, createTheme } from '@mui/material/styles';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';
import '@testing-library/jest-dom';
import { Recipe, ViewerState } from '@/domain/types/recipe';
import RecipeCard from '../RecipeCard';

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

// `viewer` is required and has no default: a card cannot be rendered without saying
// who is looking at it. `null` is the signed-out reader, which is what most of these
// tests are — they care about the recipe, not about anyone's hearts.
const LIKED_BY_ME: ViewerState = { liked: true, saved: false, cooked: false, myRating: null };
const NOT_LIKED_BY_ME: ViewerState = {
  liked: false,
  saved: false,
  cooked: false,
  myRating: null,
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

describe('the bookmark', () => {
  // Saving existed on one surface — inside a recipe — while four endpoints served
  // `viewer.saved` to cards that never showed it. A broken save had nothing to disagree with.
  const SAVED: ViewerState = { ...NOT_LIKED_BY_ME, saved: true };

  it('shows what the reader saved, filled', () => {
    renderWithTheme(<RecipeCard recipe={mockRecipe} viewer={SAVED} onSave={jest.fn()} />);

    expect(screen.getByRole('button', { name: 'Remove from saved' })).toBeInTheDocument();
    expect(screen.getByTestId('BookmarkIcon')).toBeInTheDocument();
  });

  it('shows what the reader has not saved, empty', () => {
    renderWithTheme(<RecipeCard recipe={mockRecipe} viewer={NOT_LIKED_BY_ME} onSave={jest.fn()} />);

    expect(screen.getByRole('button', { name: 'Save' })).toBeInTheDocument();
    expect(screen.getByTestId('BookmarkBorderIcon')).toBeInTheDocument();
  });

  it('hands the tap to the screen', () => {
    const onSave = jest.fn();
    renderWithTheme(<RecipeCard recipe={mockRecipe} viewer={NOT_LIKED_BY_ME} onSave={onSave} />);

    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    expect(onSave).toHaveBeenCalledTimes(1);
  });

  it('is not drawn at all without a handler — a bookmark nobody can press is noise', () => {
    renderWithTheme(<RecipeCard recipe={mockRecipe} viewer={SAVED} />);

    expect(screen.queryByTestId('BookmarkIcon')).not.toBeInTheDocument();
    expect(screen.queryByTestId('BookmarkBorderIcon')).not.toBeInTheDocument();
  });

  it('sits in the same row as the heart, even when the card has nothing else to count', () => {
    renderWithTheme(
      <RecipeCard recipe={{ id: 'r', title: 'Bare' }} viewer={NOT_LIKED_BY_ME} onSave={jest.fn()} />
    );

    expect(screen.getByRole('button', { name: 'Save' })).toBeInTheDocument();
  });
});

describe('RecipeCard Component', () => {
  it('should render recipe card with basic information', () => {
    renderWithTheme(<RecipeCard viewer={null} recipe={mockRecipe} />);

    expect(screen.getByText('Test Recipe')).toBeInTheDocument();
    expect(screen.getByText('A delicious test recipe description')).toBeInTheDocument();
    expect(screen.getByText('4 servings')).toBeInTheDocument();
    expect(screen.getByText('45 min')).toBeInTheDocument(); // 15 + 30
  });

  it('should display difficulty badge for non-owners', () => {
    renderWithTheme(
      <RecipeCard viewer={null} recipe={mockRecipe} currentUserId="different-user" />
    );

    expect(screen.getByText('easy')).toBeInTheDocument();
  });

  it('should display difficulty badge for all users including owners', () => {
    renderWithTheme(<RecipeCard viewer={null} recipe={mockRecipe} currentUserId="user-1" />);

    // Difficulty badge is now always shown
    expect(screen.getByText('easy')).toBeInTheDocument();
  });

  it('should call onClick when card is clicked', () => {
    const handleClick = jest.fn();
    renderWithTheme(<RecipeCard viewer={null} recipe={mockRecipe} onClick={handleClick} />);

    const title = screen.getByText('Test Recipe');
    fireEvent.click(title);

    expect(handleClick).toHaveBeenCalledTimes(1);
  });

  it('should reach the recipe through a real link, not a click handler', () => {
    // It used to be `router.push` on a Typography. That meant no middle-click, no
    // open-in-new-tab, no href for a crawler and nothing for a screen reader to announce
    // as a link — on the primary navigation of the entire app.
    renderWithTheme(<RecipeCard viewer={null} recipe={mockRecipe} />);

    const link = screen.getByRole('link', { name: 'Test Recipe' });

    expect(link).toHaveAttribute('href', '/recipe/recipe-1');
    expect(mockPush).not.toHaveBeenCalled();
  });

  it('should let a caller point the link somewhere else', () => {
    renderWithTheme(<RecipeCard viewer={null} recipe={mockRecipe} href="/elsewhere" />);

    expect(screen.getByRole('link', { name: 'Test Recipe' })).toHaveAttribute('href', '/elsewhere');
  });

  it('should call onLike when like button is clicked', () => {
    const handleLike = jest.fn();
    renderWithTheme(<RecipeCard viewer={null} recipe={mockRecipe} onLike={handleLike} />);

    const likeButton = screen.getByRole('button', { name: /like/i });
    fireEvent.click(likeButton);

    expect(handleLike).toHaveBeenCalledTimes(1);
  });

  it('should call onComment when comment button is clicked', () => {
    const handleComment = jest.fn();
    renderWithTheme(<RecipeCard viewer={null} recipe={mockRecipe} onComment={handleComment} />);

    const commentButton = screen.getByRole('button', { name: /comments/i });
    fireEvent.click(commentButton);

    expect(handleComment).toHaveBeenCalledTimes(1);
  });

  it('should display like count', () => {
    renderWithTheme(<RecipeCard viewer={null} recipe={{ ...mockRecipe, likeCount: 42 }} />);

    expect(screen.getByText('42')).toBeInTheDocument();
  });

  it('should display comment count', () => {
    renderWithTheme(<RecipeCard viewer={null} recipe={{ ...mockRecipe, commentCount: 15 }} />);

    expect(screen.getByText('15')).toBeInTheDocument();
  });

  it('should show filled heart when liked', () => {
    renderWithTheme(<RecipeCard recipe={mockRecipe} viewer={LIKED_BY_ME} onLike={jest.fn()} />);

    const likeButton = screen.getByRole('button', { name: /unlike/i });
    expect(likeButton).toBeInTheDocument();
  });

  it('should mark a recipe the reader has cooked', () => {
    // The card could not say this before: the count was loaded for every card in every
    // list and read by nothing.
    renderWithTheme(
      <RecipeCard
        recipe={{ ...mockRecipe, likeCount: 0 }}
        viewer={{ ...NOT_LIKED_BY_ME, timesCooked: 3 }}
      />
    );

    expect(screen.getByLabelText('You cooked this 3 times')).toBeInTheDocument();
  });

  it('should say nothing about cooking when the reader never has', () => {
    renderWithTheme(<RecipeCard recipe={mockRecipe} viewer={NOT_LIKED_BY_ME} />);

    expect(screen.queryByLabelText(/You cooked this/)).not.toBeInTheDocument();
  });

  it('should show outlined heart when not liked', () => {
    renderWithTheme(<RecipeCard recipe={mockRecipe} viewer={NOT_LIKED_BY_ME} onLike={jest.fn()} />);

    const likeButton = screen.getByRole('button', { name: /like/i });
    expect(likeButton).toBeInTheDocument();
  });

  it('should report the counts without a handler, as a reading rather than a control', () => {
    // The search page fetched viewer state and both counts and then discarded all of it,
    // because the only switch available also turned on a heart it had no mutation for.
    renderWithTheme(
      <RecipeCard recipe={{ ...mockRecipe, likeCount: 7, commentCount: 2 }} viewer={LIKED_BY_ME} />
    );

    expect(screen.getByText('7')).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /like/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /comments/i })).not.toBeInTheDocument();
  });

  it('should show the menu to an owner who was given something to do with it', () => {
    renderWithTheme(
      <RecipeCard
        viewer={null}
        recipe={mockRecipeWithAuthor}
        currentUserId="user-1"
        onEdit={jest.fn()}
        onDelete={jest.fn()}
      />
    );

    const menuButton = screen.getByRole('button', { name: /recipe options/i });
    expect(menuButton).toBeInTheDocument();
  });

  it('should not show an owner menu that would open onto nothing', () => {
    // `showActions` turned the kebab on for any owner, handlers or not.
    renderWithTheme(
      <RecipeCard viewer={null} recipe={mockRecipeWithAuthor} currentUserId="user-1" />
    );

    expect(screen.queryByRole('button', { name: /recipe options/i })).not.toBeInTheDocument();
  });

  it('should not show menu button for non-owner', () => {
    renderWithTheme(
      <RecipeCard viewer={null} recipe={mockRecipeWithAuthor} currentUserId="different-user" />
    );

    const menuButton = screen.queryByRole('button', { name: /recipe options/i });
    expect(menuButton).not.toBeInTheDocument();
  });

  it('should open menu when menu button is clicked', () => {
    renderWithTheme(
      <RecipeCard
        viewer={null}
        recipe={mockRecipeWithAuthor}
        currentUserId="user-1"
        onEdit={jest.fn()}
        onDelete={jest.fn()}
      />
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
        viewer={null}
        recipe={mockRecipeWithAuthor}
        currentUserId="user-1"
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
        viewer={null}
        recipe={mockRecipeWithAuthor}
        currentUserId="user-1"
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
    renderWithTheme(
      <RecipeCard viewer={null} recipe={mediumRecipe} currentUserId="different-user" />
    );

    expect(screen.getByText('medium')).toBeInTheDocument();
  });

  it('should show hard difficulty with error color', () => {
    const hardRecipe = { ...mockRecipe, difficulty: 'hard' as const };
    renderWithTheme(
      <RecipeCard viewer={null} recipe={hardRecipe} currentUserId="different-user" />
    );

    expect(screen.getByText('hard')).toBeInTheDocument();
  });

  it('should calculate total time correctly', () => {
    const recipe = { ...mockRecipe, prepTime: 20, cookingTime: 40 };
    renderWithTheme(<RecipeCard viewer={null} recipe={recipe} />);

    expect(screen.getByText('60 min')).toBeInTheDocument();
  });

  describe('Author Display', () => {
    it('should display author information when author is provided', () => {
      renderWithTheme(<RecipeCard viewer={null} recipe={mockRecipeWithAuthor} />);

      expect(screen.getByText('John Doe')).toBeInTheDocument();
      expect(screen.getByAltText('johndoe')).toBeInTheDocument();
    });

    it('should not display author section when author is not provided', () => {
      renderWithTheme(<RecipeCard viewer={null} recipe={mockRecipe} />);

      expect(screen.queryByText('John Doe')).not.toBeInTheDocument();
    });

    it('should reach the author through real links, from both the name and the avatar', () => {
      renderWithTheme(<RecipeCard viewer={null} recipe={mockRecipeWithAuthor} />);

      const toProfile = screen
        .getAllByRole('link')
        .filter((a) => a.getAttribute('href') === '/profile/johndoe');

      // The name and the avatar, both anchors rather than two copies of a push handler.
      expect(toProfile).toHaveLength(2);
      expect(mockPush).not.toHaveBeenCalled();
    });

    it('should keep the author link above the card link rather than under it', () => {
      // The title stretches an invisible `::after` over the whole card. If the author row
      // did not sit above it, clicking a name would open the recipe.
      renderWithTheme(<RecipeCard viewer={null} recipe={mockRecipeWithAuthor} />);

      const authorRow = screen.getByText('John Doe').closest('div');

      expect(authorRow).toHaveStyle({ position: 'relative', zIndex: '1' });
    });

    it('should display username when fullName is not provided', () => {
      const recipeWithUsernameOnly = {
        ...mockRecipe,
        author: {
          username: 'johndoe',
        },
      };
      renderWithTheme(<RecipeCard viewer={null} recipe={recipeWithUsernameOnly} />);

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
      renderWithTheme(<RecipeCard viewer={null} recipe={recipeWithoutAvatar} />);

      expect(screen.getByText('John Doe')).toBeInTheDocument();
      // Avatar should still exist (with first letter fallback)
      const avatar = screen.getByText('J');
      expect(avatar).toBeInTheDocument();
    });

    it('should display author avatar when provided', () => {
      renderWithTheme(<RecipeCard viewer={null} recipe={mockRecipeWithAuthor} />);

      const avatar = screen.getByAltText('johndoe');
      expect(avatar).toHaveAttribute('src', 'https://example.com/avatar.jpg');
    });

    it('should handle unknown difficulty level with default color - line 105', () => {
      const recipeWithUnknownDifficulty = {
        ...mockRecipe,
        difficulty: 'unknown' as any,
      };
      renderWithTheme(<RecipeCard viewer={null} recipe={recipeWithUnknownDifficulty} />);

      // Component should render without errors even with unknown difficulty
      expect(screen.getByText(mockRecipe.title)).toBeInTheDocument();
      // Difficulty chip should still be displayed
      expect(screen.getByText('unknown')).toBeInTheDocument();
    });

    it('should open the owner menu without the card link intercepting it', async () => {
      // This used to assert that the menu called `stopPropagation`, which it needed
      // because a click anywhere on the card ran `router.push`. There is no card click
      // any more — the title is an anchor and the buttons sit above its stretched
      // overlay — so the propagation guards went with it. What is worth holding is the
      // behaviour those guards existed to protect: opening the menu, and choosing from
      // it, must not navigate.
      const mockOnEdit = jest.fn();
      const mockOnDelete = jest.fn();

      renderWithTheme(
        <RecipeCard
          viewer={null}
          recipe={mockRecipeWithAuthor}
          currentUserId="user-1"
          onEdit={mockOnEdit}
          onDelete={mockOnDelete}
        />
      );

      fireEvent.click(screen.getByRole('button', { name: /recipe options/i }));

      await waitFor(() => {
        expect(screen.getByRole('menu')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('Edit Recipe'));

      expect(mockOnEdit).toHaveBeenCalledTimes(1);
      expect(mockPush).not.toHaveBeenCalled();
    });
  });
});
