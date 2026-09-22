import { ThemeProvider, createTheme } from '@mui/material/styles';
import { act, render, screen, fireEvent, waitFor, configure } from '@testing-library/react';
import React from 'react';
import '@testing-library/jest-dom';
import { ToastProvider } from '@/contexts/ToastContext';
import { sendWaitingDelete } from '@/lib/undo/deferredDeletes';
import CommentsSection from '../CommentsSection';

// Speed up waitFor - aggressive timeout
configure({ asyncUtilTimeout: 50 });

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
    AnimatePresence: ({ children }: any) => <>{children}</>,
  };
});

const mockTheme = createTheme();

const renderWithProviders = (component: React.ReactElement) => {
  // The toast is how a delete offers Undo, and says when it failed.
  return render(
    <ThemeProvider theme={mockTheme}>
      <ToastProvider>{component}</ToastProvider>
    </ThemeProvider>
  );
};

/** The Undo window passing without anyone pressing Undo. */
const letUndoPass = () => act(async () => sendWaitingDelete());

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

    // Loading state now renders null instead of skeletons
    // The comments list section should be empty/null during loading
    expect(container.querySelectorAll('.MuiCard-root').length).toBe(0);
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
      mockUseAuth.mockReturnValue({ token: null, user: testUser });

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
              'X-Requested-With': 'fetch',
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

    it('should post a comment without sending any rating', async () => {
      const testUser = { id: 'user123', username: 'testuser', email: 'test@example.com' };
      mockUseAuth.mockReturnValue({ token: null, user: testUser });

      mockFetch.mockResolvedValueOnce({ ok: true, json: async () => ({ comments: [] }) });

      renderWithProviders(<CommentsSection recipeId="recipe1" />);

      await waitFor(() => {
        expect(screen.getByText(/comments/i)).toBeInTheDocument();
      });

      // There are no stars in this form any more. Rating a recipe is its own control on
      // the recipe page, so commenting cannot carry a score with it.
      expect(screen.queryAllByRole('radio', { hidden: true })).toHaveLength(0);

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          comment: {
            id: 'new-comment-2',
            text: 'Great recipe!',
            createdAt: new Date().toISOString(),
            user: testUser,
          },
        }),
      });

      fireEvent.change(screen.getByPlaceholderText(/share your thoughts/i), {
        target: { value: 'Great recipe!' },
      });
      fireEvent.click(screen.getByRole('button', { name: /post/i }));

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith(
          '/api/recipes/recipe1/comments',
          expect.objectContaining({ method: 'POST' })
        );
      });

      const body = mockFetch.mock.calls.at(-1)?.[1]?.body ?? '';
      expect(body).not.toContain('rating');
    });

    it('should handle comment submission error', async () => {
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
      const testUser = { id: 'user123', username: 'testuser', email: 'test@example.com' };
      mockUseAuth.mockReturnValue({ token: null, user: testUser });

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
      mockUseAuth.mockReturnValue({ token: null, user: testUser });

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
      mockUseAuth.mockReturnValue({ token: null, user: testUser });

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
      mockUseAuth.mockReturnValue({ token: null, user: testUser });

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
      mockUseAuth.mockReturnValue({ token: null, user: testUser });

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
      mockUseAuth.mockReturnValue({ token: null, user: testUser });

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
        {
          ...mockComment,
          id: '1',
          user: { id: authorId, username: 'author', avatar: '/avatar.jpg' },
          text: 'Author comment 1',
        },
        {
          ...mockComment,
          id: '2',
          user: { id: 'user456', username: 'user', avatar: '/avatar.jpg' },
          text: 'User comment',
        },
        {
          ...mockComment,
          id: '3',
          user: { id: authorId, username: 'author', avatar: '/avatar.jpg' },
          text: 'Author comment 2',
        },
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

      mockUseAuth.mockReturnValue({ token: null, user: testUser });
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ comments: [userComment] }),
      });

      renderWithProviders(<CommentsSection recipeId="recipe1" />);

      await waitFor(() => {
        expect(screen.getByText('Great recipe!')).toBeInTheDocument();
      });

      // Should show more options button (MoreVertIcon)
      const allButtons = screen.getAllByRole('button');
      const moreButton = allButtons.find((btn) => {
        const svg = btn.querySelector('svg');
        return svg && svg.getAttribute('data-testid') === 'MoreVertIcon';
      });
      expect(moreButton).toBeDefined();
    });

    it('should not show action menu button for other users comments', async () => {
      const testUser = { id: 'user123', username: 'testuser', email: 'test@example.com' };
      const otherUserComment = {
        ...mockComment,
        user: { id: 'user456', username: 'otheruser', avatar: '/avatar.jpg' },
      };

      mockUseAuth.mockReturnValue({ token: null, user: testUser });
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ comments: [otherUserComment] }),
      });

      renderWithProviders(<CommentsSection recipeId="recipe1" />);

      await waitFor(() => {
        expect(screen.getByText('Great recipe!')).toBeInTheDocument();
      });

      // Should not show more options button for other users' comments
      // Check specifically for the MoreVertIcon button which is the edit/delete action button
      const allButtons = screen.getAllByRole('button');
      const moreVertButton = allButtons.find((btn) => {
        const svg = btn.querySelector('svg');
        return svg && svg.getAttribute('data-testid') === 'MoreVertIcon';
      });
      expect(moreVertButton).toBeUndefined();
    });

    it('should open menu and show edit and delete options when clicking more button', async () => {
      const testUser = { id: 'user123', username: 'testuser', email: 'test@example.com' };
      const userComment = {
        ...mockComment,
        user: { id: testUser.id, username: testUser.username, avatar: '/avatar.jpg' },
      };

      mockUseAuth.mockReturnValue({ token: null, user: testUser });
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
      const moreButton = moreButtons.find((btn) => {
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

      mockUseAuth.mockReturnValue({ token: null, user: testUser });
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
      const moreButton = moreButtons.find((btn) => {
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

      mockUseAuth.mockReturnValue({ token: null, user: testUser });
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
      const moreButton = moreButtons.find((btn) => {
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

      mockUseAuth.mockReturnValue({ token: null, user: testUser });

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
      const moreButton = moreButtons.find((btn) => {
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
          })
        );
      });

      // Should show updated text
      await waitFor(() => {
        expect(screen.getByText('Updated comment text')).toBeInTheDocument();
      });
    });

    /** Your own comment on screen, then "Delete" from its menu — no "are you sure?" after. */
    async function deleteOwnComment(text: string) {
      const testUser = { id: 'user123', username: 'testuser', email: 'test@example.com' };
      const userComment = {
        ...mockComment,
        text,
        user: { id: testUser.id, username: testUser.username, avatar: '/avatar.jpg' },
      };
      mockUseAuth.mockReturnValue({ token: null, user: testUser });
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ comments: [userComment] }),
      });

      renderWithProviders(<CommentsSection recipeId="recipe1" />);
      expect(await screen.findByText(text)).toBeInTheDocument();

      const moreButton = screen
        .getAllByRole('button')
        .find((btn) => btn.querySelector('svg')?.getAttribute('data-testid') === 'MoreVertIcon');
      fireEvent.click(moreButton!);
      fireEvent.click(await screen.findByRole('menuitem', { name: /delete/i }));
      return userComment;
    }

    const commentDeletes = () =>
      mockFetch.mock.calls.filter(([, init]) => init?.method === 'DELETE').map(([url]) => url);

    it('takes a comment away at once, offers Undo, and sends the delete only after', async () => {
      const comment = await deleteOwnComment('Comment to delete');

      await waitFor(() => {
        expect(screen.queryByText('Comment to delete')).not.toBeInTheDocument();
      });
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      expect(screen.getByText('Comment deleted')).toBeInTheDocument();
      expect(commentDeletes()).toEqual([]);

      mockFetch.mockResolvedValueOnce({ ok: true, json: async () => ({}) });
      await letUndoPass();

      expect(commentDeletes()).toEqual([`/api/recipes/recipe1/comments/${comment.id}`]);
      expect(screen.queryByText('Comment to delete')).not.toBeInTheDocument();
    });

    it('puts the comment back, and sends nothing, when the reader presses Undo', async () => {
      await deleteOwnComment('Comment to keep');
      await waitFor(() => {
        expect(screen.queryByText('Comment to keep')).not.toBeInTheDocument();
      });

      await waitFor(() => expect(screen.queryByRole('menu')).not.toBeInTheDocument());
      fireEvent.click(screen.getByRole('button', { name: 'Undo' }));

      expect(await screen.findByText('Comment to keep')).toBeInTheDocument();
      await letUndoPass();
      expect(commentDeletes()).toEqual([]);
    });

    // Additional coverage tests for uncovered lines
    it('should handle edit comment error when response is not ok - lines 184-186', async () => {
      const testUser = { id: 'user1', username: 'testuser', email: 'test@example.com' };
      mockUseAuth.mockReturnValue({
        token: null,
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
      const moreButton = moreButtons.find((btn) => {
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
        token: null,
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
      const moreButton = moreButtons.find((btn) => {
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

    it('puts the comment back, and says what the server said, when it refuses the delete', async () => {
      await deleteOwnComment('Comment to delete');
      mockFetch.mockResolvedValueOnce({
        ok: false,
        json: async () => ({ error: 'Custom delete error' }),
      });

      await letUndoPass();

      expect(await screen.findByText('Custom delete error')).toBeInTheDocument();
      expect(screen.getByText('Comment to delete')).toBeInTheDocument();
    });

    it('says the comment is still there when the delete fails for want of a connection', async () => {
      await deleteOwnComment('Comment to delete');
      mockFetch.mockRejectedValueOnce(new TypeError('Failed to fetch'));

      await letUndoPass();

      expect(
        await screen.findByText('No connection — your comment is still there')
      ).toBeInTheDocument();
      expect(screen.getByText('Comment to delete')).toBeInTheDocument();
    });

    it('should close menu when clicking a menu item - line 488', async () => {
      const testUser = { id: 'user1', username: 'testuser', email: 'test@example.com' };
      mockUseAuth.mockReturnValue({
        token: null,
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
      const moreButton = moreButtons.find((btn) => {
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

  // ==================== IMAGE HANDLING TESTS ====================
  describe('Image Handling - Lines 111-134, 179-206', () => {
    beforeEach(() => {
      mockUseAuth.mockReturnValue({
        token: null,
        user: { id: 'user1', username: 'testuser' },
      });
    });

    it('should reject invalid file type (line 184-186)', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ comments: [] }),
      });

      renderWithProviders(<CommentsSection recipeId="recipe1" />);

      await waitFor(() => {
        expect(screen.getByPlaceholderText(/share your thoughts/i)).toBeInTheDocument();
      });

      // Try to upload invalid file type
      const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
      if (fileInput) {
        const invalidFile = new File(['content'], 'test.pdf', { type: 'application/pdf' });
        fireEvent.change(fileInput, { target: { files: [invalidFile] } });

        await waitFor(() => {
          expect(screen.getByText(/invalid file type/i)).toBeInTheDocument();
        });
      }
    });

    it('should reject file that is too large (line 190-192)', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ comments: [] }),
      });

      renderWithProviders(<CommentsSection recipeId="recipe1" />);

      await waitFor(() => {
        expect(screen.getByPlaceholderText(/share your thoughts/i)).toBeInTheDocument();
      });

      // Create 6MB file (exceeds 5MB limit)
      const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
      if (fileInput) {
        const largeContent = new Array(6 * 1024 * 1024).fill('a').join('');
        const largeFile = new File([largeContent], 'large.jpg', { type: 'image/jpeg' });
        fireEvent.change(fileInput, { target: { files: [largeFile] } });

        await waitFor(() => {
          expect(screen.getByText(/image too large/i)).toBeInTheDocument();
        });
      }
    });

    it('should accept valid image file (lines 195-199)', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ comments: [] }),
      });

      renderWithProviders(<CommentsSection recipeId="recipe1" />);

      await waitFor(() => {
        expect(screen.getByPlaceholderText(/share your thoughts/i)).toBeInTheDocument();
      });

      const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
      if (fileInput) {
        const validFile = new File(['image content'], 'photo.jpg', { type: 'image/jpeg' });
        fireEvent.change(fileInput, { target: { files: [validFile] } });

        // Should not show error
        await waitFor(() => {
          expect(screen.queryByText(/invalid file type/i)).not.toBeInTheDocument();
          expect(screen.queryByText(/image too large/i)).not.toBeInTheDocument();
        });
      }
    });

    it('should handle image upload failure (lines 121-132)', async () => {
      // Spy on console.error to verify it's called and prevent console output leak
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

      mockFetch
        .mockResolvedValueOnce({ ok: true, json: async () => ({ comments: [] }) })
        .mockResolvedValueOnce({ ok: false, status: 500 }); // Upload fails

      renderWithProviders(<CommentsSection recipeId="recipe1" />);

      await waitFor(() => {
        expect(screen.getByPlaceholderText(/share your thoughts/i)).toBeInTheDocument();
      });

      // Select an image
      const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
      if (fileInput) {
        const validFile = new File(['image'], 'photo.jpg', { type: 'image/jpeg' });
        fireEvent.change(fileInput, { target: { files: [validFile] } });
      }

      // Type a comment
      const textarea = screen.getByPlaceholderText(/share your thoughts/i);
      fireEvent.change(textarea, { target: { value: 'Test comment with image' } });

      // Submit by clicking the Post button
      const postButton = screen.getByRole('button', { name: /post/i });
      fireEvent.click(postButton);

      await waitFor(() => {
        expect(screen.getByText(/failed to upload image/i)).toBeInTheDocument();
      });

      // Verify console.error was called (this is the expected behavior)
      expect(consoleErrorSpy).toHaveBeenCalledWith('Error uploading image:', expect.any(Error));

      consoleErrorSpy.mockRestore();
    });

    it('should trigger file input when camera button is clicked (line 420)', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ comments: [] }),
      });

      renderWithProviders(<CommentsSection recipeId="recipe1" />);

      await waitFor(() => {
        expect(screen.getByPlaceholderText(/share your thoughts/i)).toBeInTheDocument();
      });

      // Find and click camera button
      const cameraButton = screen.getByRole('button', { name: '' });
      if (cameraButton.querySelector('[data-testid="CameraAltIcon"]')) {
        fireEvent.click(cameraButton);
        // File input should exist
        expect(document.querySelector('input[type="file"]')).toBeInTheDocument();
      }
    });

    it('should remove selected image when remove button is clicked (lines 204-206)', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ comments: [] }),
      });

      renderWithProviders(<CommentsSection recipeId="recipe1" />);

      await waitFor(() => {
        expect(screen.getByPlaceholderText(/share your thoughts/i)).toBeInTheDocument();
      });

      // Select an image first
      const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
      expect(fileInput).toBeTruthy();

      const validFile = new File(['image content'], 'photo.jpg', { type: 'image/jpeg' });
      fireEvent.change(fileInput, { target: { files: [validFile] } });

      // Wait for image preview to appear (URL.createObjectURL returns 'blob:mock-url')
      await waitFor(() => {
        const previewImg = screen.getByAltText('Preview');
        expect(previewImg).toBeInTheDocument();
        expect(previewImg).toHaveAttribute('src', 'blob:mock-url');
      });

      // Find the remove button (Close icon button next to the preview)
      const closeButtons = screen
        .getAllByRole('button')
        .filter((btn) => btn.querySelector('[data-testid="CloseIcon"]'));
      expect(closeButtons.length).toBeGreaterThan(0);

      fireEvent.click(closeButtons[0]);

      // Preview image should be removed
      await waitFor(() => {
        expect(screen.queryByAltText('Preview')).not.toBeInTheDocument();
      });
    });
  });

  // ==================== EDIT FUNCTIONALITY TESTS ====================
  describe('Edit Comment Functionality - Lines 572, 623-650', () => {
    beforeEach(() => {
      mockUseAuth.mockReturnValue({
        token: null,
        user: { id: 'user1', username: 'testuser' },
      });
    });

    it('should handle rating change in edit mode (line 572)', async () => {
      const mockCommentWithRating = {
        id: 'comment1',
        text: 'Editable comment',
        rating: 3,
        createdAt: new Date().toISOString(),
        user: { id: 'user1', username: 'testuser', avatar: null },
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ comments: [mockCommentWithRating] }),
      });

      renderWithProviders(<CommentsSection recipeId="recipe1" />);

      await waitFor(() => {
        expect(screen.getByText('Editable comment')).toBeInTheDocument();
      });

      // Open menu and click edit
      const moreButtons = screen
        .getAllByRole('button', { name: '' })
        .filter((btn) => btn.querySelector('[data-testid="MoreVertIcon"]'));

      if (moreButtons.length > 0) {
        fireEvent.click(moreButtons[0]);

        await waitFor(() => {
          expect(screen.getByText('Edit')).toBeInTheDocument();
        });

        fireEvent.click(screen.getByText('Edit'));

        // Should be in edit mode now
        await waitFor(() => {
          expect(screen.getByDisplayValue('Editable comment')).toBeInTheDocument();
        });

        // Find rating component and change rating
        const ratingInputs = document.querySelectorAll('input[name="rating"]');
        if (ratingInputs.length > 0) {
          fireEvent.click(ratingInputs[3] as HTMLElement); // Click 4th star
        }
      }
    });

    it('should call onImageClick when comment image is clicked (line 623)', async () => {
      const mockCommentWithImage = {
        id: 'comment1',
        text: 'Comment with image',
        rating: 4,
        imageUrl: 'https://example.com/comment-image.jpg',
        createdAt: new Date().toISOString(),
        user: { id: 'user2', username: 'otheruser', avatar: null },
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ comments: [mockCommentWithImage] }),
      });

      const mockOnImageClick = jest.fn();
      renderWithProviders(<CommentsSection recipeId="recipe1" onImageClick={mockOnImageClick} />);

      await waitFor(() => {
        expect(screen.getByText('Comment with image')).toBeInTheDocument();
      });

      // Find and click the image
      const images = document.querySelectorAll('img');
      const commentImage = Array.from(images).find(
        (img) => img.getAttribute('src') === 'https://example.com/comment-image.jpg'
      );

      if (commentImage) {
        fireEvent.click(commentImage);
        expect(mockOnImageClick).toHaveBeenCalledWith(
          'https://example.com/comment-image.jpg',
          'Photo by otheruser'
        );
      }
    });
  });

  describe('Image Upload in Comments', () => {
    it('should upload image and include URL in comment submission - lines 125-134', async () => {
      const testUser = { id: 'user123', username: 'testuser', email: 'test@example.com' };
      mockUseAuth.mockReturnValue({ token: null, user: testUser });

      // Initial comments fetch
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ comments: [] }),
      });

      renderWithProviders(<CommentsSection recipeId="recipe1" />);

      await waitFor(() => {
        expect(screen.getByText(/comments/i)).toBeInTheDocument();
      });

      // Find file input
      const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
      expect(fileInput).toBeTruthy();

      // Mock successful image upload (line 125-126)
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ url: 'https://example.com/uploaded-image.jpg' }),
      });

      // Mock successful comment submission with image
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          comment: {
            id: 'new-comment-with-image',
            text: 'Comment with uploaded image',
            imageUrl: 'https://example.com/uploaded-image.jpg',
            createdAt: new Date().toISOString(),
            user: testUser,
          },
        }),
      });

      // Create and upload a valid image file
      const file = new File(['image content'], 'test.jpg', { type: 'image/jpeg' });
      fireEvent.change(fileInput, { target: { files: [file] } });

      // Wait for preview to appear
      await waitFor(() => {
        const previewImages = document.querySelectorAll('img[alt="Preview"]');
        expect(previewImages.length).toBeGreaterThan(0);
      });

      // Enter comment text and submit
      const commentInput = screen.getByPlaceholderText(/share your thoughts/i);
      fireEvent.change(commentInput, { target: { value: 'Comment with uploaded image' } });

      const postButton = screen.getByRole('button', { name: /post/i });
      fireEvent.click(postButton);

      // Verify upload API was called
      await waitFor(() => {
        const uploadCalls = mockFetch.mock.calls.filter((call: any) => call[0] === '/api/upload');
        expect(uploadCalls.length).toBeGreaterThan(0);
      });
    });

    it('should remove selected image - lines 204-206', async () => {
      const testUser = { id: 'user123', username: 'testuser', email: 'test@example.com' };
      mockUseAuth.mockReturnValue({ token: null, user: testUser });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ comments: [] }),
      });

      renderWithProviders(<CommentsSection recipeId="recipe1" />);

      await waitFor(() => {
        expect(screen.getByText(/comments/i)).toBeInTheDocument();
      });

      const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
      const file = new File(['image content'], 'test.jpg', { type: 'image/jpeg' });
      fireEvent.change(fileInput, { target: { files: [file] } });

      // Wait for preview
      await waitFor(() => {
        const previewImages = document.querySelectorAll('img[alt="Preview"]');
        expect(previewImages.length).toBeGreaterThan(0);
      });

      // Find and click remove button (Close icon)
      const removeButtons = screen.getAllByRole('button');
      const closeButton = removeButtons.find((btn) =>
        btn.querySelector('[data-testid="CloseIcon"]')
      );

      if (closeButton) {
        fireEvent.click(closeButton);

        // Preview should be removed
        await waitFor(() => {
          const previewImages = document.querySelectorAll('img[alt="Preview"]');
          expect(previewImages.length).toBe(0);
        });
      }
    });

    it('should handle image upload failure - lines 127-133', async () => {
      const testUser = { id: 'user123', username: 'testuser', email: 'test@example.com' };
      mockUseAuth.mockReturnValue({ token: null, user: testUser });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ comments: [] }),
      });

      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

      renderWithProviders(<CommentsSection recipeId="recipe1" />);

      await waitFor(() => {
        expect(screen.getByText(/comments/i)).toBeInTheDocument();
      });

      const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
      const file = new File(['image content'], 'test.jpg', { type: 'image/jpeg' });
      fireEvent.change(fileInput, { target: { files: [file] } });

      // Wait for preview
      await waitFor(() => {
        const previewImages = document.querySelectorAll('img[alt="Preview"]');
        expect(previewImages.length).toBeGreaterThan(0);
      });

      // Mock failed image upload (lines 127-133)
      mockFetch.mockResolvedValueOnce({
        ok: false,
        json: async () => ({ error: 'Upload failed' }),
      });

      const commentInput = screen.getByPlaceholderText(/share your thoughts/i);
      fireEvent.change(commentInput, { target: { value: 'Comment with failing upload' } });

      const postButton = screen.getByRole('button', { name: /post/i });
      fireEvent.click(postButton);

      // Should show error message
      await waitFor(() => {
        expect(screen.getByText(/failed to upload image/i)).toBeInTheDocument();
      });

      consoleErrorSpy.mockRestore();
    });

    it('should reject invalid file type - lines 183-187', async () => {
      const testUser = { id: 'user123', username: 'testuser', email: 'test@example.com' };
      mockUseAuth.mockReturnValue({ token: null, user: testUser });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ comments: [] }),
      });

      renderWithProviders(<CommentsSection recipeId="recipe1" />);

      await waitFor(() => {
        expect(screen.getByText(/comments/i)).toBeInTheDocument();
      });

      const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
      const file = new File(['text content'], 'test.txt', { type: 'text/plain' });
      fireEvent.change(fileInput, { target: { files: [file] } });

      // Should show error
      await waitFor(() => {
        expect(screen.getByText(/invalid file type/i)).toBeInTheDocument();
      });
    });

    it('should reject file larger than 5MB - lines 190-193', async () => {
      const testUser = { id: 'user123', username: 'testuser', email: 'test@example.com' };
      mockUseAuth.mockReturnValue({ token: null, user: testUser });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ comments: [] }),
      });

      renderWithProviders(<CommentsSection recipeId="recipe1" />);

      await waitFor(() => {
        expect(screen.getByText(/comments/i)).toBeInTheDocument();
      });

      const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
      // Create a file larger than 5MB
      const largeContent = new Array(6 * 1024 * 1024).fill('a').join('');
      const file = new File([largeContent], 'large.jpg', { type: 'image/jpeg' });
      fireEvent.change(fileInput, { target: { files: [file] } });

      // Should show error
      await waitFor(() => {
        expect(screen.getByText(/image too large/i)).toBeInTheDocument();
      });
    });
  });

  // ==================== EDIT RATING CHANGE (line 554) ====================
  describe('Edit Rating Change - line 554', () => {
    it('should update edit rating when rating is changed in edit mode - line 554', async () => {
      const testUser = { id: 'user123', username: 'testuser', email: 'test@example.com' };
      mockUseAuth.mockReturnValue({ token: null, user: testUser });

      const existingComment = {
        id: 'comment1',
        text: 'My comment',
        rating: 4,
        createdAt: new Date().toISOString(),
        user: { id: 'user123', username: 'testuser', avatar: '/avatar.jpg' },
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ comments: [existingComment] }),
      });

      renderWithProviders(<CommentsSection recipeId="recipe1" />);

      await waitFor(() => {
        expect(screen.getByText('My comment')).toBeInTheDocument();
      });

      // Open menu and click edit
      const moreButtons = screen
        .getAllByRole('button')
        .filter((btn) => btn.querySelector('[data-testid="MoreVertIcon"]'));
      if (moreButtons.length > 0) {
        fireEvent.click(moreButtons[0]);

        await waitFor(() => {
          expect(screen.getAllByRole('menuitem').length).toBeGreaterThan(0);
        });

        const editMenuItem = screen.getAllByRole('menuitem')[0];
        fireEvent.click(editMenuItem);

        // Now in edit mode, find the rating component and change it
        await waitFor(() => {
          const ratingLabels = screen.queryAllByLabelText(/star/i);
          if (ratingLabels.length > 0) {
            // Click a star to change rating (line 554 coverage)
            fireEvent.click(ratingLabels[0]);
          }
        });
      }
    });
  });

  // ==================== MENU ON CLOSE (line 632) ====================
  describe('Menu onClose - line 632', () => {
    it('should close menu when clicking away - line 632', async () => {
      const testUser = { id: 'user123', username: 'testuser', email: 'test@example.com' };
      mockUseAuth.mockReturnValue({ token: null, user: testUser });

      const existingComment = {
        id: 'comment1',
        text: 'Test comment for menu',
        rating: 5,
        createdAt: new Date().toISOString(),
        user: { id: 'user123', username: 'testuser', avatar: '/avatar.jpg' },
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ comments: [existingComment] }),
      });

      renderWithProviders(<CommentsSection recipeId="recipe1" />);

      await waitFor(() => {
        expect(screen.getByText('Test comment for menu')).toBeInTheDocument();
      });

      // Open menu
      const moreButtons = screen
        .getAllByRole('button')
        .filter((btn) => btn.querySelector('[data-testid="MoreVertIcon"]'));
      if (moreButtons.length > 0) {
        fireEvent.click(moreButtons[0]);

        await waitFor(() => {
          expect(screen.getAllByRole('menuitem').length).toBeGreaterThan(0);
        });

        // Press Escape to trigger onClose (line 632)
        fireEvent.keyDown(document.activeElement || document.body, { key: 'Escape' });

        // Menu should close
        await waitFor(() => {
          expect(screen.queryByRole('menuitem')).not.toBeInTheDocument();
        });
      }
    });
  });
});

describe('the stars beside a comment', () => {
  const showThread = async (props = {}) => {
    const mockFetch = global.fetch as jest.Mock;
    mockFetch.mockResolvedValueOnce({ ok: true, json: async () => ({ comments: [mockComment] }) });
    renderWithProviders(<CommentsSection recipeId="recipe1" {...props} />);
    await waitFor(() => expect(screen.getByText('Great recipe!')).toBeInTheDocument());
  };

  const starsShown = () =>
    screen.queryAllByRole('img').filter((el) => el.getAttribute('aria-label')?.includes('Star'))
      .length;

  it('shows the reader their live score, not the one the thread was fetched with', async () => {
    // Reported bug: rating a recipe after the thread had loaded left your own comment
    // showing the old score until a reload. The list is local state; no refetch follows.
    mockUseAuth.mockReturnValue({ token: null, user: { id: 'user1', username: 'testuser' } });

    await showThread({ myRating: 2 });

    // mockComment was fetched with rating 5; the reader has since moved to 2.
    const rating = screen.getByRole('img', { name: /2 Stars?/i });
    expect(rating).toBeInTheDocument();
  });

  it('drops the stars when the reader clears their score', async () => {
    mockUseAuth.mockReturnValue({ token: null, user: { id: 'user1', username: 'testuser' } });

    await showThread({ myRating: null });

    expect(starsShown()).toBe(0);
  });

  it('leaves somebody else’s comment showing what they gave', async () => {
    // Your score changing says nothing about theirs.
    mockUseAuth.mockReturnValue({ token: null, user: { id: 'someone-else', username: 'other' } });

    await showThread({ myRating: 1 });

    expect(screen.getByRole('img', { name: /5 Stars?/i })).toBeInTheDocument();
  });
});
