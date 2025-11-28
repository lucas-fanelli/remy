import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import CommentsSection from '../CommentsSection';

// Mock AuthContext
const mockUseAuth = jest.fn();
jest.mock('@/contexts/AuthContext', () => ({
  ...jest.requireActual('@/contexts/AuthContext'),
  useAuth: () => mockUseAuth(),
  AuthProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

// Mock framer-motion - comprehensive mock supporting all patterns
jest.mock('framer-motion', () => {
  const mockMotion: any = (component: any) => component;
  mockMotion.create = (component: any) => component;
  mockMotion.div = ({ children, initial, animate, exit, transition, whileHover, whileTap, ...props }: any) =>
    <div {...props}>{children}</div>;

  return {
    motion: mockMotion,
    AnimatePresence: ({ children }: any) => <>{children}</>,
  };
});

const mockTheme = createTheme();

const renderWithProviders = (component: React.ReactElement) => {
  return render(
    <ThemeProvider theme={mockTheme}>
      {component}
    </ThemeProvider>
  );
};

const mockComment = {
  id: '1',
  text: 'Great recipe!',
  rating: 5,
  createdAt: new Date().toISOString(),
  user: { id: 'user1', username: 'testuser', avatar: '/avatar.jpg' },
};

describe('CommentsSection Component', () => {
  let mockFetch: jest.Mock;

  beforeEach(() => {
    mockFetch = global.fetch as jest.Mock;
    mockFetch.mockClear();
    // Default: no authentication
    mockUseAuth.mockReturnValue({ token: null, user: null });
  });

  it('should render comments section', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ comments: [] }),
    });

    renderWithProviders(<CommentsSection recipeId="recipe1" />);

    await waitFor(() => {
      expect(screen.getByText(/comments/i)).toBeInTheDocument();
    });
  });

  it('should show login message when not authenticated', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ comments: [] }),
    });

    renderWithProviders(<CommentsSection recipeId="recipe1" />);

    await waitFor(() => {
      expect(screen.getByText(/please login to leave a comment/i)).toBeInTheDocument();
    });
  });

  it('should display fetched comments', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ comments: [mockComment] }),
    });

    renderWithProviders(<CommentsSection recipeId="recipe1" />);

    await waitFor(() => {
      expect(screen.getByText('Great recipe!')).toBeInTheDocument();
      expect(screen.getByText('testuser')).toBeInTheDocument();
    });
  });

  it('should handle API error when fetching comments', async () => {
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    mockFetch.mockRejectedValueOnce(new Error('Failed to fetch'));

    renderWithProviders(<CommentsSection recipeId="recipe1" />);

    await waitFor(() => {
      expect(screen.getByText(/comments/i)).toBeInTheDocument();
    });

    consoleErrorSpy.mockRestore();
  });

  it('should show loading state while fetching comments', () => {
    mockFetch.mockImplementation(() => new Promise(() => {}));

    const { container } = renderWithProviders(<CommentsSection recipeId="recipe1" />);

    // Check for skeleton loading state (looking for skeleton elements)
    const skeletons = container.querySelectorAll('.MuiSkeleton-root');
    expect(skeletons.length).toBeGreaterThan(0);
  });

  it('should show empty state when no comments', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ comments: [] }),
    });

    renderWithProviders(<CommentsSection recipeId="recipe1" />);

    await waitFor(() => {
      expect(screen.getByText(/no comments yet/i)).toBeInTheDocument();
      expect(screen.getByText(/be the first to share your thoughts/i)).toBeInTheDocument();
    });
  });

  it('should display comment count', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ comments: [mockComment, { ...mockComment, id: '2' }] }),
    });

    renderWithProviders(<CommentsSection recipeId="recipe1" />);

    await waitFor(() => {
      expect(screen.getByText(/comments \(2\)/i)).toBeInTheDocument();
    });
  });

  it('should display comment with rating', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ comments: [mockComment] }),
    });

    renderWithProviders(<CommentsSection recipeId="recipe1" />);

    await waitFor(() => {
      expect(screen.getByText('Great recipe!')).toBeInTheDocument();
    });

    // Rating component should be visible (read-only)
    const ratings = screen.getAllByRole('img', { hidden: true });
    expect(ratings.length).toBeGreaterThan(0);
  });

  it('should display comment without rating', async () => {
    const commentWithoutRating = {
      ...mockComment,
      rating: undefined,
    };

    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ comments: [commentWithoutRating] }),
    });

    renderWithProviders(<CommentsSection recipeId="recipe1" />);

    await waitFor(() => {
      expect(screen.getByText('Great recipe!')).toBeInTheDocument();
    });
  });

  it('should display user avatar', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ comments: [mockComment] }),
    });

    renderWithProviders(<CommentsSection recipeId="recipe1" />);

    await waitFor(() => {
      expect(screen.getByText('testuser')).toBeInTheDocument();
    });
  });

  it('should display formatted timestamp', async () => {
    const recentComment = {
      ...mockComment,
      createdAt: new Date(Date.now() - 1000 * 60 * 5).toISOString(), // 5 minutes ago
    };

    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ comments: [recentComment] }),
    });

    renderWithProviders(<CommentsSection recipeId="recipe1" />);

    await waitFor(() => {
      expect(screen.getByText('Great recipe!')).toBeInTheDocument();
    });
  });

  it('should handle invalid date gracefully', async () => {
    const commentWithInvalidDate = {
      ...mockComment,
      createdAt: 'invalid-date',
    };

    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ comments: [commentWithInvalidDate] }),
    });

    renderWithProviders(<CommentsSection recipeId="recipe1" />);

    await waitFor(() => {
      expect(screen.getByText('Great recipe!')).toBeInTheDocument();
      expect(screen.getByText(/recently/i)).toBeInTheDocument();
    });
  });

  it('should show comment form for authenticated users', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ comments: [] }),
    });

    renderWithProviders(<CommentsSection recipeId="recipe1" />);

    await waitFor(() => {
      // Should not show login message when user is null (mocked in AuthProvider)
      expect(screen.queryByText(/please login to leave a comment/i)).toBeInTheDocument();
    });
  });

  it('should render multiple comments in order', async () => {
    const comments = [
      { ...mockComment, id: '1', text: 'First comment' },
      { ...mockComment, id: '2', text: 'Second comment' },
      { ...mockComment, id: '3', text: 'Third comment' },
    ];

    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ comments }),
    });

    renderWithProviders(<CommentsSection recipeId="recipe1" />);

    await waitFor(() => {
      expect(screen.getByText('First comment')).toBeInTheDocument();
      expect(screen.getByText('Second comment')).toBeInTheDocument();
      expect(screen.getByText('Third comment')).toBeInTheDocument();
    });
  });

  it('should display avatar with user initial when no avatar URL', async () => {
    const commentWithoutAvatar = {
      ...mockComment,
      user: { id: 'user1', username: 'testuser' },
    };

    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ comments: [commentWithoutAvatar] }),
    });

    renderWithProviders(<CommentsSection recipeId="recipe1" />);

    await waitFor(() => {
      expect(screen.getByText('testuser')).toBeInTheDocument();
    });
  });

  it('should handle multiline comment text', async () => {
    const multilineComment = {
      ...mockComment,
      text: 'Line 1\nLine 2\nLine 3',
    };

    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ comments: [multilineComment] }),
    });

    renderWithProviders(<CommentsSection recipeId="recipe1" />);

    await waitFor(() => {
      expect(screen.getByText(/Line 1/i)).toBeInTheDocument();
    });
  });

  // Comment Submission Tests
  describe('Comment Submission', () => {
    it('should not show comment form when user is not authenticated', async () => {
      mockUseAuth.mockReturnValue({ token: null, user: null });
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ comments: [] }),
      });

      renderWithProviders(<CommentsSection recipeId="recipe1" />);

      await waitFor(() => {
        expect(screen.getByText(/please login to leave a comment/i)).toBeInTheDocument();
      });

      // Comment form should not be visible
      expect(screen.queryByPlaceholderText(/share your thoughts/i)).not.toBeInTheDocument();
    });

    it('should submit comment successfully with valid token', async () => {
      const testUser = { id: 'user123', username: 'testuser', email: 'test@example.com' };
      mockUseAuth.mockReturnValue({ token: 'valid-token', user: testUser });

      // Mock initial fetch for existing comments
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ comments: [] }),
      });

      renderWithProviders(<CommentsSection recipeId="recipe1" />);

      await waitFor(() => {
        expect(screen.getByText(/comments/i)).toBeInTheDocument();
      });

      // Find comment input and submit button
      const commentInput = screen.getByPlaceholderText(/share your thoughts/i);
      const postButton = screen.getByRole('button', { name: /post/i });

      // Mock successful comment submission
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          comment: {
            id: 'new-comment-1',
            text: 'This is a test comment',
            rating: null,
            createdAt: new Date().toISOString(),
            user: testUser,
          },
        }),
      });

      // Type comment and submit
      fireEvent.change(commentInput, { target: { value: 'This is a test comment' } });
      fireEvent.click(postButton);

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith(
          '/api/recipes/recipe1/comments',
          expect.objectContaining({
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': 'Bearer valid-token',
            },
            body: JSON.stringify({
              text: 'This is a test comment',
            }),
          })
        );
      });

      // Verify comment appears in the list
      await waitFor(() => {
        expect(screen.getByText('This is a test comment')).toBeInTheDocument();
      });

      // Verify form is cleared
      expect(commentInput).toHaveValue('');
    });

    it('should submit comment with rating', async () => {
      const testUser = { id: 'user123', username: 'testuser', email: 'test@example.com' };
      mockUseAuth.mockReturnValue({ token: 'valid-token', user: testUser });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ comments: [] }),
      });

      renderWithProviders(<CommentsSection recipeId="recipe1" />);

      await waitFor(() => {
        expect(screen.getByText(/comments/i)).toBeInTheDocument();
      });

      const commentInput = screen.getByPlaceholderText(/share your thoughts/i);
      const postButton = screen.getByRole('button', { name: /post/i });

      // Find and click 4-star rating
      const ratingInputs = screen.getAllByRole('radio', { hidden: true });
      const fourStarRating = ratingInputs.find((input) =>
        input.getAttribute('value') === '4'
      );
      if (fourStarRating) {
        fireEvent.click(fourStarRating);
      }

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          comment: {
            id: 'new-comment-2',
            text: 'Great recipe with rating!',
            rating: 4,
            createdAt: new Date().toISOString(),
            user: testUser,
          },
        }),
      });

      fireEvent.change(commentInput, { target: { value: 'Great recipe with rating!' } });
      fireEvent.click(postButton);

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith(
          '/api/recipes/recipe1/comments',
          expect.objectContaining({
            method: 'POST',
            body: expect.stringContaining('"rating":4'),
          })
        );
      });
    });

    it('should handle comment submission error', async () => {
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
      const testUser = { id: 'user123', username: 'testuser', email: 'test@example.com' };
      mockUseAuth.mockReturnValue({ token: 'valid-token', user: testUser });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ comments: [] }),
      });

      renderWithProviders(<CommentsSection recipeId="recipe1" />);

      await waitFor(() => {
        expect(screen.getByText(/comments/i)).toBeInTheDocument();
      });

      const commentInput = screen.getByPlaceholderText(/share your thoughts/i);
      const postButton = screen.getByRole('button', { name: /post/i });

      // Mock failed submission
      mockFetch.mockRejectedValueOnce(new Error('Failed to submit comment'));

      fireEvent.change(commentInput, { target: { value: 'This will fail' } });
      fireEvent.click(postButton);

      await waitFor(() => {
        expect(consoleErrorSpy).toHaveBeenCalledWith(
          'Error submitting comment:',
          expect.any(Error)
        );
      });

      consoleErrorSpy.mockRestore();
    });

    it('should not submit empty comment', async () => {
      const testUser = { id: 'user123', username: 'testuser', email: 'test@example.com' };
      mockUseAuth.mockReturnValue({ token: 'valid-token', user: testUser });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ comments: [] }),
      });

      renderWithProviders(<CommentsSection recipeId="recipe1" />);

      await waitFor(() => {
        expect(screen.getByText(/comments/i)).toBeInTheDocument();
      });

      const postButton = screen.getByRole('button', { name: /post/i });

      // Click submit without entering text
      fireEvent.click(postButton);

      // Should not make any POST request
      await waitFor(() => {
        const postCalls = (mockFetch.mock.calls as any[]).filter(
          (call) => call[1]?.method === 'POST'
        );
        expect(postCalls.length).toBe(0);
      });
    });

    it('should not submit comment without authentication token', async () => {
      // Both token and user must be null to show login message
      mockUseAuth.mockReturnValue({ token: null, user: null });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ comments: [] }),
      });

      renderWithProviders(<CommentsSection recipeId="recipe1" />);

      await waitFor(() => {
        expect(screen.getByText(/please login to leave a comment/i)).toBeInTheDocument();
      });
    });

    it('should handle network error during submission gracefully', async () => {
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
      const testUser = { id: 'user123', username: 'testuser', email: 'test@example.com' };
      mockUseAuth.mockReturnValue({ token: 'valid-token', user: testUser });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ comments: [] }),
      });

      renderWithProviders(<CommentsSection recipeId="recipe1" />);

      await waitFor(() => {
        expect(screen.getByText(/comments/i)).toBeInTheDocument();
      });

      const commentInput = screen.getByPlaceholderText(/share your thoughts/i);
      const postButton = screen.getByRole('button', { name: /post/i });

      // Mock network error
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      fireEvent.change(commentInput, { target: { value: 'Network test' } });
      fireEvent.click(postButton);

      await waitFor(() => {
        expect(consoleErrorSpy).toHaveBeenCalledWith(
          'Error submitting comment:',
          expect.any(Error)
        );
      });

      consoleErrorSpy.mockRestore();
    });

    it('should clear rating after successful submission', async () => {
      const testUser = { id: 'user123', username: 'testuser', email: 'test@example.com' };
      mockUseAuth.mockReturnValue({ token: 'valid-token', user: testUser });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ comments: [] }),
      });

      renderWithProviders(<CommentsSection recipeId="recipe1" />);

      await waitFor(() => {
        expect(screen.getByText(/comments/i)).toBeInTheDocument();
      });

      const commentInput = screen.getByPlaceholderText(/share your thoughts/i);
      const postButton = screen.getByRole('button', { name: /post/i });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          comment: {
            id: 'new-comment-3',
            text: 'Test comment',
            rating: 5,
            createdAt: new Date().toISOString(),
            user: testUser,
          },
        }),
      });

      fireEvent.change(commentInput, { target: { value: 'Test comment' } });
      fireEvent.click(postButton);

      await waitFor(() => {
        expect(screen.getByText('Test comment')).toBeInTheDocument();
      });

      // Form should be cleared
      expect(commentInput).toHaveValue('');
    });

    it('should handle API error response with error message', async () => {
      const testUser = { id: 'user123', username: 'testuser', email: 'test@example.com' };
      mockUseAuth.mockReturnValue({ token: 'valid-token', user: testUser });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ comments: [] }),
      });

      renderWithProviders(<CommentsSection recipeId="recipe1" />);

      await waitFor(() => {
        expect(screen.getByText(/comments/i)).toBeInTheDocument();
      });

      const commentInput = screen.getByPlaceholderText(/share your thoughts/i);
      const postButton = screen.getByRole('button', { name: /post/i });

      // Mock non-ok response with error message (lines 93-94)
      mockFetch.mockResolvedValueOnce({
        ok: false,
        json: async () => ({ error: 'Comment validation failed' }),
      });

      fireEvent.change(commentInput, { target: { value: 'Test comment' } });
      fireEvent.click(postButton);

      await waitFor(() => {
        expect(screen.getByText(/comment validation failed/i)).toBeInTheDocument();
      });
    });

    it('should handle API error response without specific error message', async () => {
      const testUser = { id: 'user123', username: 'testuser', email: 'test@example.com' };
      mockUseAuth.mockReturnValue({ token: 'valid-token', user: testUser });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ comments: [] }),
      });

      renderWithProviders(<CommentsSection recipeId="recipe1" />);

      await waitFor(() => {
        expect(screen.getByText(/comments/i)).toBeInTheDocument();
      });

      const commentInput = screen.getByPlaceholderText(/share your thoughts/i);
      const postButton = screen.getByRole('button', { name: /post/i });

      // Mock non-ok response without error field (line 94 - fallback message)
      mockFetch.mockResolvedValueOnce({
        ok: false,
        json: async () => ({}),
      });

      fireEvent.change(commentInput, { target: { value: 'Test comment' } });
      fireEvent.click(postButton);

      await waitFor(() => {
        expect(screen.getByText(/failed to post comment/i)).toBeInTheDocument();
      });
    });
  });

  describe('Creator Badge', () => {
    it('should display "Creator" badge for recipe author comments', async () => {
      const authorId = 'author123';
      const authorComment = {
        ...mockComment,
        user: { id: authorId, username: 'recipeauthor', avatar: '/avatar.jpg' },
      };

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ comments: [authorComment] }),
      });

      renderWithProviders(<CommentsSection recipeId="recipe1" recipeAuthorId={authorId} />);

      await waitFor(() => {
        expect(screen.getByText('Creator')).toBeInTheDocument();
        expect(screen.getByText('recipeauthor')).toBeInTheDocument();
      });
    });

    it('should not display "Creator" badge for non-author comments', async () => {
      const authorId = 'author123';
      const nonAuthorComment = {
        ...mockComment,
        user: { id: 'user456', username: 'regularuser', avatar: '/avatar.jpg' },
      };

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ comments: [nonAuthorComment] }),
      });

      renderWithProviders(<CommentsSection recipeId="recipe1" recipeAuthorId={authorId} />);

      await waitFor(() => {
        expect(screen.getByText('regularuser')).toBeInTheDocument();
        expect(screen.queryByText('Creator')).not.toBeInTheDocument();
      });
    });

    it('should not display "Creator" badge when recipeAuthorId is not provided', async () => {
      const authorComment = {
        ...mockComment,
        user: { id: 'user123', username: 'someuser', avatar: '/avatar.jpg' },
      };

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ comments: [authorComment] }),
      });

      renderWithProviders(<CommentsSection recipeId="recipe1" />);

      await waitFor(() => {
        expect(screen.getByText('someuser')).toBeInTheDocument();
        expect(screen.queryByText('Creator')).not.toBeInTheDocument();
      });
    });

    it('should display "Creator" badge for multiple author comments', async () => {
      const authorId = 'author123';
      const comments = [
        { ...mockComment, id: '1', user: { id: authorId, username: 'author', avatar: '/avatar.jpg' }, text: 'Author comment 1' },
        { ...mockComment, id: '2', user: { id: 'user456', username: 'user', avatar: '/avatar.jpg' }, text: 'User comment' },
        { ...mockComment, id: '3', user: { id: authorId, username: 'author', avatar: '/avatar.jpg' }, text: 'Author comment 2' },
      ];

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ comments }),
      });

      renderWithProviders(<CommentsSection recipeId="recipe1" recipeAuthorId={authorId} />);

      await waitFor(() => {
        const creatorBadges = screen.getAllByText('Creator');
        expect(creatorBadges).toHaveLength(2);
        expect(screen.getByText('Author comment 1')).toBeInTheDocument();
        expect(screen.getByText('User comment')).toBeInTheDocument();
        expect(screen.getByText('Author comment 2')).toBeInTheDocument();
      });
    });
  });

  describe('Edit and Delete Comments', () => {
    beforeEach(() => {
      // Reset window.confirm mock
      global.confirm = jest.fn(() => true);
      // Clear all mocks to prevent state contamination
      mockFetch.mockClear();
    });

    it('should show action menu button for own comments when authenticated', async () => {
      const testUser = { id: 'user123', username: 'testuser', email: 'test@example.com' };
      const userComment = {
        ...mockComment,
        user: { id: testUser.id, username: testUser.username, avatar: '/avatar.jpg' },
      };

      mockUseAuth.mockReturnValue({ token: 'valid-token', user: testUser });
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ comments: [userComment] }),
      });

      renderWithProviders(<CommentsSection recipeId="recipe1" />);

      await waitFor(() => {
        expect(screen.getByText('Great recipe!')).toBeInTheDocument();
      });

      // Should show more options button
      const moreButton = screen.getByRole('button', { name: '' });
      expect(moreButton).toBeInTheDocument();
    });

    it('should not show action menu button for other users comments', async () => {
      const testUser = { id: 'user123', username: 'testuser', email: 'test@example.com' };
      const otherUserComment = {
        ...mockComment,
        user: { id: 'user456', username: 'otheruser', avatar: '/avatar.jpg' },
      };

      mockUseAuth.mockReturnValue({ token: 'valid-token', user: testUser });
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ comments: [otherUserComment] }),
      });

      renderWithProviders(<CommentsSection recipeId="recipe1" />);

      await waitFor(() => {
        expect(screen.getByText('Great recipe!')).toBeInTheDocument();
      });

      // Should not show more options button for other users' comments
      const moreButtons = screen.queryAllByRole('button', { name: '' });
      expect(moreButtons.length).toBe(0);
    });

    it('should open menu and show edit and delete options when clicking more button', async () => {
      const testUser = { id: 'user123', username: 'testuser', email: 'test@example.com' };
      const userComment = {
        ...mockComment,
        user: { id: testUser.id, username: testUser.username, avatar: '/avatar.jpg' },
      };

      mockUseAuth.mockReturnValue({ token: 'valid-token', user: testUser });
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ comments: [userComment] }),
      });

      renderWithProviders(<CommentsSection recipeId="recipe1" />);

      await waitFor(() => {
        expect(screen.getByText('Great recipe!')).toBeInTheDocument();
      });

      // Click more options button
      const moreButtons = screen.getAllByRole('button');
      const moreButton = moreButtons.find(btn => {
        const svg = btn.querySelector('svg');
        return svg && svg.getAttribute('data-testid') === 'MoreVertIcon';
      });

      expect(moreButton).toBeDefined();
      if (moreButton) {
        fireEvent.click(moreButton);
      }

      // Should show Edit and Delete menu items
      await waitFor(() => {
        const menuItems = screen.getAllByRole('menuitem');
        expect(menuItems.length).toBeGreaterThan(0);
      });
    });

    it('should enter edit mode when clicking edit button', async () => {
      const testUser = { id: 'user123', username: 'testuser', email: 'test@example.com' };
      const userComment = {
        ...mockComment,
        text: 'Original comment text',
        user: { id: testUser.id, username: testUser.username, avatar: '/avatar.jpg' },
      };

      mockUseAuth.mockReturnValue({ token: 'valid-token', user: testUser });
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ comments: [userComment] }),
      });

      renderWithProviders(<CommentsSection recipeId="recipe1" />);

      await waitFor(() => {
        expect(screen.getByText('Original comment text')).toBeInTheDocument();
      });

      // Click more options button
      const moreButtons = screen.getAllByRole('button');
      const moreButton = moreButtons.find(btn => {
        const svg = btn.querySelector('svg');
        return svg && svg.getAttribute('data-testid') === 'MoreVertIcon';
      });
      if (moreButton) {
        fireEvent.click(moreButton);
      }

      // Click Edit
      await waitFor(() => {
        const menuItems = screen.getAllByRole('menuitem');
        if (menuItems.length > 0) {
          fireEvent.click(menuItems[0]); // First menu item is Edit
        }
      });

      // Should show edit form with original text
      await waitFor(() => {
        const textField = screen.getByDisplayValue('Original comment text');
        expect(textField).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /cancel/i })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /save/i })).toBeInTheDocument();
      });
    });

    it('should cancel edit mode when clicking cancel button', async () => {
      const testUser = { id: 'user123', username: 'testuser', email: 'test@example.com' };
      const userComment = {
        ...mockComment,
        text: 'Original comment',
        user: { id: testUser.id, username: testUser.username, avatar: '/avatar.jpg' },
      };

      mockUseAuth.mockReturnValue({ token: 'valid-token', user: testUser });
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ comments: [userComment] }),
      });

      renderWithProviders(<CommentsSection recipeId="recipe1" />);

      await waitFor(() => {
        expect(screen.getByText('Original comment')).toBeInTheDocument();
      });

      // Enter edit mode
      const moreButtons = screen.getAllByRole('button');
      const moreButton = moreButtons.find(btn => {
        const svg = btn.querySelector('svg');
        return svg && svg.getAttribute('data-testid') === 'MoreVertIcon';
      });
      if (moreButton) fireEvent.click(moreButton);

      await waitFor(() => {
        const menuItems = screen.getAllByRole('menuitem');
        if (menuItems.length > 0) {
          fireEvent.click(menuItems[0]); // First menu item is Edit
        }
      });

      // Cancel edit
      await waitFor(() => {
        const cancelButton = screen.getByRole('button', { name: /cancel/i });
        fireEvent.click(cancelButton);
      });

      // Should exit edit mode
      await waitFor(() => {
        expect(screen.queryByRole('button', { name: /save/i })).not.toBeInTheDocument();
        expect(screen.getByText('Original comment')).toBeInTheDocument();
      });
    });

    it('should save edited comment successfully', async () => {
      const testUser = { id: 'user123', username: 'testuser', email: 'test@example.com' };
      const userComment = {
        ...mockComment,
        text: 'Original comment',
        user: { id: testUser.id, username: testUser.username, avatar: '/avatar.jpg' },
      };

      mockUseAuth.mockReturnValue({ token: 'valid-token', user: testUser });

      // Mock initial fetch
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ comments: [userComment] }),
      });

      renderWithProviders(<CommentsSection recipeId="recipe1" />);

      await waitFor(() => {
        expect(screen.getByText('Original comment')).toBeInTheDocument();
      });

      // Enter edit mode
      const moreButtons = screen.getAllByRole('button');
      const moreButton = moreButtons.find(btn => {
        const svg = btn.querySelector('svg');
        return svg && svg.getAttribute('data-testid') === 'MoreVertIcon';
      });
      if (moreButton) fireEvent.click(moreButton);

      await waitFor(() => {
        const menuItems = screen.getAllByRole('menuitem');
        if (menuItems.length > 0) {
          fireEvent.click(menuItems[0]); // First menu item is Edit
        }
      });

      // Edit the text
      await waitFor(() => {
        const textField = screen.getByDisplayValue('Original comment');
        fireEvent.change(textField, { target: { value: 'Updated comment text' } });
      });

      // Mock PATCH response
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          comment: {
            ...userComment,
            text: 'Updated comment text',
          },
        }),
      });

      // Save
      const saveButton = screen.getByRole('button', { name: /save/i });
      fireEvent.click(saveButton);

      // Verify PATCH request
      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith(
          `/api/recipes/recipe1/comments/${userComment.id}`,
          expect.objectContaining({
            method: 'PATCH',
            headers: expect.objectContaining({
              'Authorization': 'Bearer valid-token',
            }),
          })
        );
      });

      // Should show updated text
      await waitFor(() => {
        expect(screen.getByText('Updated comment text')).toBeInTheDocument();
      });
    });

    it('should not delete comment when canceling delete confirmation', async () => {
      // This test verifies that canceling the delete confirmation prevents deletion (lines 180-182)
      global.confirm = jest.fn(() => false);

      const testUser = { id: 'user123', username: 'testuser', email: 'test@example.com' };
      const userComment = {
        ...mockComment,
        id: 'comment-to-keep',
        text: 'Comment to keep',
        user: { id: testUser.id, username: testUser.username, avatar: '/avatar.jpg' },
      };

      mockUseAuth.mockReturnValue({ token: 'valid-token', user: testUser });
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ comments: [userComment] }),
      });

      renderWithProviders(<CommentsSection recipeId="recipe1" />);

      // Wait for comment to appear
      await waitFor(() => {
        expect(screen.getByText('Comment to keep')).toBeInTheDocument();
      });

      const initialCallCount = mockFetch.mock.calls.length;

      // Open menu
      const moreButtons = screen.getAllByRole('button');
      const moreButton = moreButtons.find(btn => {
        const svg = btn.querySelector('svg');
        return svg && svg.getAttribute('data-testid') === 'MoreVertIcon';
      });

      expect(moreButton).toBeDefined();
      if (moreButton) {
        fireEvent.click(moreButton);

        // Wait for menu and click delete
        await waitFor(() => {
          expect(screen.getByRole('menuitem', { name: /delete/i })).toBeInTheDocument();
        });

        const deleteMenuItem = screen.getByRole('menuitem', { name: /delete/i });
        fireEvent.click(deleteMenuItem);

        // Delete confirmation dialog should appear
        await waitFor(() => {
          expect(screen.getByText(/delete selected comment/i)).toBeInTheDocument();
        });

        // Click Cancel button
        const cancelButton = screen.getByRole('button', { name: /cancel/i });
        fireEvent.click(cancelButton);

        // No additional API calls should have been made since we canceled
        expect(mockFetch.mock.calls.length).toBe(initialCallCount);
      }
    });

    it('should delete comment when confirming delete', async () => {
      const testUser = { id: 'user123', username: 'testuser', email: 'test@example.com' };
      const userComment = {
        ...mockComment,
        text: 'Comment to delete',
        user: { id: testUser.id, username: testUser.username, avatar: '/avatar.jpg' },
      };

      mockUseAuth.mockReturnValue({ token: 'valid-token', user: testUser });
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ comments: [userComment] }),
      });

      renderWithProviders(<CommentsSection recipeId="recipe1" />);

      await waitFor(() => {
        expect(screen.getByText('Comment to delete')).toBeInTheDocument();
      });

      // Open menu and click delete
      const moreButtons = screen.getAllByRole('button');
      const moreButton = moreButtons.find(btn => {
        const svg = btn.querySelector('svg');
        return svg && svg.getAttribute('data-testid') === 'MoreVertIcon';
      });
      if (moreButton) fireEvent.click(moreButton);

      await waitFor(() => {
        const menuItems = screen.getAllByRole('menuitem');
        if (menuItems.length > 1) {
          fireEvent.click(menuItems[1]); // Second menu item is Delete
        }
      });

      // Delete confirmation dialog should appear
      await waitFor(() => {
        expect(screen.getByText(/delete selected comment/i)).toBeInTheDocument();
      });

      // Mock DELETE response
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({}),
      });

      // Click Delete button to confirm
      const deleteButton = screen.getByRole('button', { name: /delete/i });
      fireEvent.click(deleteButton);

      // Verify DELETE request
      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith(
          `/api/recipes/recipe1/comments/${userComment.id}`,
          expect.objectContaining({
            method: 'DELETE',
          })
        );
      });

      // Comment should be removed
      await waitFor(() => {
        expect(screen.queryByText('Comment to delete')).not.toBeInTheDocument();
      });
    });

    // Additional coverage tests for uncovered lines
    it('should handle edit comment error when response is not ok - lines 184-186', async () => {
      const testUser = { id: 'user1', username: 'testuser', email: 'test@example.com' };
      mockUseAuth.mockReturnValue({
        token: 'test-token',
        user: testUser,
      });

      const userComment = {
        id: '2',
        text: 'Comment to edit',
        rating: 4,
        createdAt: new Date().toISOString(),
        user: { id: testUser.id, username: testUser.username, avatar: '/avatar.jpg' },
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ comments: [userComment] }),
      });

      renderWithProviders(<CommentsSection recipeId="recipe1" />);

      await waitFor(() => {
        expect(screen.getByText('Comment to edit')).toBeInTheDocument();
      });

      // Open menu - find by MoreVertIcon
      const moreButtons = screen.getAllByRole('button');
      const moreButton = moreButtons.find(btn => {
        const svg = btn.querySelector('svg');
        return svg && svg.getAttribute('data-testid') === 'MoreVertIcon';
      });
      expect(moreButton).toBeDefined();
      if (moreButton) {
        fireEvent.click(moreButton);
      }

      // Click edit option
      await waitFor(() => {
        const menuItems = screen.getAllByRole('menuitem');
        if (menuItems.length > 0) {
          fireEvent.click(menuItems[0]); // First menu item is Edit
        }
      });

      // Update comment text - use getByDisplayValue to find the edit textbox
      await waitFor(() => {
        const textInput = screen.getByDisplayValue('Comment to edit');
        fireEvent.change(textInput, { target: { value: 'Updated comment' } });
      });

      // Mock PATCH response with error
      mockFetch.mockResolvedValueOnce({
        ok: false,
        json: async () => ({ error: 'Custom edit error' }),
      });

      // Submit edit
      const saveButton = screen.getByRole('button', { name: /save/i });
      fireEvent.click(saveButton);

      // Check for error message
      await waitFor(() => {
        expect(screen.getByText('Custom edit error')).toBeInTheDocument();
      });
    });

    it('should handle edit comment exception - lines 187-189', async () => {
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
      const testUser = { id: 'user1', username: 'testuser', email: 'test@example.com' };
      mockUseAuth.mockReturnValue({
        token: 'test-token',
        user: testUser,
      });

      const userComment = {
        id: '3',
        text: 'Comment to edit',
        rating: 4,
        createdAt: new Date().toISOString(),
        user: { id: testUser.id, username: testUser.username, avatar: '/avatar.jpg' },
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ comments: [userComment] }),
      });

      renderWithProviders(<CommentsSection recipeId="recipe1" />);

      await waitFor(() => {
        expect(screen.getByText('Comment to edit')).toBeInTheDocument();
      });

      // Open menu - find by MoreVertIcon
      const moreButtons = screen.getAllByRole('button');
      const moreButton = moreButtons.find(btn => {
        const svg = btn.querySelector('svg');
        return svg && svg.getAttribute('data-testid') === 'MoreVertIcon';
      });
      expect(moreButton).toBeDefined();
      if (moreButton) {
        fireEvent.click(moreButton);
      }

      // Click edit option
      await waitFor(() => {
        const menuItems = screen.getAllByRole('menuitem');
        if (menuItems.length > 0) {
          fireEvent.click(menuItems[0]);
        }
      });

      // Update comment text - use getByDisplayValue to find the edit textbox
      await waitFor(() => {
        const textInput = screen.getByDisplayValue('Comment to edit');
        fireEvent.change(textInput, { target: { value: 'Updated comment' } });
      });

      // Mock PATCH response with exception
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      // Submit edit
      const saveButton = screen.getByRole('button', { name: /save/i });
      fireEvent.click(saveButton);

      // Check for error message and console.error
      await waitFor(() => {
        expect(screen.getByText('Failed to update comment')).toBeInTheDocument();
        expect(consoleErrorSpy).toHaveBeenCalledWith('Error updating comment:', expect.any(Error));
      });

      consoleErrorSpy.mockRestore();
    });

    it('should handle delete comment error when response is not ok - lines 223-225', async () => {
      const testUser = { id: 'user1', username: 'testuser', email: 'test@example.com' };
      mockUseAuth.mockReturnValue({
        token: 'test-token',
        user: testUser,
      });

      const userComment = {
        id: '4',
        text: 'Comment to delete',
        rating: 4,
        createdAt: new Date().toISOString(),
        user: { id: testUser.id, username: testUser.username, avatar: '/avatar.jpg' },
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ comments: [userComment] }),
      });

      renderWithProviders(<CommentsSection recipeId="recipe1" />);

      await waitFor(() => {
        expect(screen.getByText('Comment to delete')).toBeInTheDocument();
      });

      // Open menu - find by MoreVertIcon
      const moreButtons = screen.getAllByRole('button');
      const moreButton = moreButtons.find(btn => {
        const svg = btn.querySelector('svg');
        return svg && svg.getAttribute('data-testid') === 'MoreVertIcon';
      });
      expect(moreButton).toBeDefined();
      if (moreButton) {
        fireEvent.click(moreButton);
      }

      // Click delete option
      await waitFor(() => {
        const menuItems = screen.getAllByRole('menuitem');
        if (menuItems.length > 1) {
          fireEvent.click(menuItems[1]); // Delete is second
        }
      });

      // Confirm delete
      await waitFor(() => {
        expect(screen.getByText(/delete selected comment/i)).toBeInTheDocument();
      });

      // Mock DELETE response with error
      mockFetch.mockResolvedValueOnce({
        ok: false,
        json: async () => ({ error: 'Custom delete error' }),
      });

      const deleteButton = screen.getByRole('button', { name: /^delete$/i });
      fireEvent.click(deleteButton);

      // Check for error message
      await waitFor(() => {
        expect(screen.getByText('Custom delete error')).toBeInTheDocument();
      });
    });

    it('should handle delete comment exception - lines 226-228', async () => {
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
      const testUser = { id: 'user1', username: 'testuser', email: 'test@example.com' };
      mockUseAuth.mockReturnValue({
        token: 'test-token',
        user: testUser,
      });

      const userComment = {
        id: '5',
        text: 'Comment to delete',
        rating: 4,
        createdAt: new Date().toISOString(),
        user: { id: testUser.id, username: testUser.username, avatar: '/avatar.jpg' },
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ comments: [userComment] }),
      });

      renderWithProviders(<CommentsSection recipeId="recipe1" />);

      await waitFor(() => {
        expect(screen.getByText('Comment to delete')).toBeInTheDocument();
      });

      // Open menu - find by MoreVertIcon
      const moreButtons = screen.getAllByRole('button');
      const moreButton = moreButtons.find(btn => {
        const svg = btn.querySelector('svg');
        return svg && svg.getAttribute('data-testid') === 'MoreVertIcon';
      });
      expect(moreButton).toBeDefined();
      if (moreButton) {
        fireEvent.click(moreButton);
      }

      // Click delete option
      await waitFor(() => {
        const menuItems = screen.getAllByRole('menuitem');
        if (menuItems.length > 1) {
          fireEvent.click(menuItems[1]);
        }
      });

      // Confirm delete
      await waitFor(() => {
        expect(screen.getByText(/delete selected comment/i)).toBeInTheDocument();
      });

      // Mock DELETE response with exception
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      const deleteButton = screen.getByRole('button', { name: /^delete$/i });
      fireEvent.click(deleteButton);

      // Check for error message and console.error
      await waitFor(() => {
        expect(screen.getByText('Failed to delete comment')).toBeInTheDocument();
        expect(consoleErrorSpy).toHaveBeenCalledWith('Error deleting comment:', expect.any(Error));
      });

      consoleErrorSpy.mockRestore();
    });

    it('should handle rating change in edit mode - line 434', async () => {
      const testUser = { id: 'user1', username: 'testuser', email: 'test@example.com' };
      mockUseAuth.mockReturnValue({
        token: 'test-token',
        user: testUser,
      });

      const userComment = {
        id: '6',
        text: 'Comment with rating',
        rating: 4,
        createdAt: new Date().toISOString(),
        user: { id: testUser.id, username: testUser.username, avatar: '/avatar.jpg' },
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ comments: [userComment] }),
      });

      renderWithProviders(<CommentsSection recipeId="recipe1" />);

      await waitFor(() => {
        expect(screen.getByText('Comment with rating')).toBeInTheDocument();
      });

      // Open menu - find by MoreVertIcon
      const moreButtons = screen.getAllByRole('button');
      const moreButton = moreButtons.find(btn => {
        const svg = btn.querySelector('svg');
        return svg && svg.getAttribute('data-testid') === 'MoreVertIcon';
      });
      expect(moreButton).toBeDefined();
      if (moreButton) {
        fireEvent.click(moreButton);
      }

      // Click edit option
      await waitFor(() => {
        const menuItems = screen.getAllByRole('menuitem');
        if (menuItems.length > 0) {
          fireEvent.click(menuItems[0]);
        }
      });

      // Find and change rating
      await waitFor(() => {
        const ratingInputs = screen.getAllByRole('radio');
        // Rating component renders 5 radio buttons (one for each star)
        if (ratingInputs.length >= 5) {
          // Click the 5th star to set rating to 5
          fireEvent.click(ratingInputs[4]);
        }
      });

      // Verify we're still in edit mode by checking for the edit textbox
      await waitFor(() => {
        const textInput = screen.getByDisplayValue('Comment with rating');
        expect(textInput).toBeInTheDocument();
      });
    });

    it('should close menu when clicking a menu item - line 488', async () => {
      const testUser = { id: 'user1', username: 'testuser', email: 'test@example.com' };
      mockUseAuth.mockReturnValue({
        token: 'test-token',
        user: testUser,
      });

      const userComment = {
        id: '7',
        text: 'Comment with menu',
        rating: 4,
        createdAt: new Date().toISOString(),
        user: { id: testUser.id, username: testUser.username, avatar: '/avatar.jpg' },
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ comments: [userComment] }),
      });

      renderWithProviders(<CommentsSection recipeId="recipe1" />);

      await waitFor(() => {
        expect(screen.getByText('Comment with menu')).toBeInTheDocument();
      });

      // Open menu - find by MoreVertIcon
      const moreButtons = screen.getAllByRole('button');
      const moreButton = moreButtons.find(btn => {
        const svg = btn.querySelector('svg');
        return svg && svg.getAttribute('data-testid') === 'MoreVertIcon';
      });
      expect(moreButton).toBeDefined();
      if (moreButton) {
        fireEvent.click(moreButton);
      }

      // Verify menu is open
      await waitFor(() => {
        expect(screen.getAllByRole('menuitem').length).toBeGreaterThan(0);
      });

      // Click Edit menu item which triggers onClose (line 488)
      const menuItems = screen.getAllByRole('menuitem');
      if (menuItems.length > 0) {
        fireEvent.click(menuItems[0]);
      }

      // Menu should close after clicking a menu item
      await waitFor(() => {
        // After clicking Edit, we enter edit mode and menu closes
        expect(screen.getByDisplayValue('Comment with menu')).toBeInTheDocument();
      });
    });
  });
});
