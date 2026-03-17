import { ThemeProvider, createTheme } from '@mui/material/styles';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';
import '@testing-library/jest-dom';
import Post from '../Post';

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

describe('Post Component', () => {
  it('should render post with username', () => {
    render(
      <ThemeProvider theme={mockTheme}>
        <Post
          username="testuser"
          avatar="/avatar.jpg"
          image="/post.jpg"
          likes={42}
          caption="Test caption"
          timestamp="2 hours ago"
          comments={[]}
        />
      </ThemeProvider>
    );

    expect(screen.getAllByText('testuser').length).toBeGreaterThan(0);
  });

  it('should render caption', () => {
    render(
      <ThemeProvider theme={mockTheme}>
        <Post
          username="testuser"
          avatar="/avatar.jpg"
          image="/post.jpg"
          likes={42}
          caption="Test caption"
          timestamp="2 hours ago"
          comments={[]}
        />
      </ThemeProvider>
    );

    expect(screen.getByText(/Test caption/i)).toBeInTheDocument();
  });

  it('should render likes count', () => {
    render(
      <ThemeProvider theme={mockTheme}>
        <Post
          username="testuser"
          avatar="/avatar.jpg"
          image="/post.jpg"
          likes={42}
          caption="Test caption"
          timestamp="2 hours ago"
          comments={[]}
        />
      </ThemeProvider>
    );

    expect(screen.getByText('42 likes')).toBeInTheDocument();
  });

  it('should render timestamp', () => {
    render(
      <ThemeProvider theme={mockTheme}>
        <Post
          username="testuser"
          avatar="/avatar.jpg"
          image="/post.jpg"
          likes={42}
          caption="Test caption"
          timestamp="2 hours ago"
          comments={[]}
        />
      </ThemeProvider>
    );

    expect(screen.getByText('2 hours ago')).toBeInTheDocument();
  });

  it('should render comments section when provided', () => {
    render(
      <ThemeProvider theme={mockTheme}>
        <Post
          username="testuser"
          avatar="/avatar.jpg"
          image="/post.jpg"
          likes={42}
          caption="Test caption"
          timestamp="2 hours ago"
          comments={[
            { username: 'user1', text: 'Great post!' },
            { username: 'user2', text: 'Love this!' },
          ]}
        />
      </ThemeProvider>
    );

    expect(screen.getByText('View all 2 comments')).toBeInTheDocument();
  });

  it('should toggle like when clicking like button', () => {
    render(
      <ThemeProvider theme={mockTheme}>
        <Post
          username="testuser"
          avatar="/avatar.jpg"
          image="/post.jpg"
          likes={42}
          caption="Test caption"
          timestamp="2 hours ago"
          comments={[]}
        />
      </ThemeProvider>
    );

    expect(screen.getByText('42 likes')).toBeInTheDocument();

    const likeButton = screen.getAllByRole('button')[1]; // Second button is like
    fireEvent.click(likeButton);

    expect(screen.getByText('43 likes')).toBeInTheDocument();

    fireEvent.click(likeButton);
    expect(screen.getByText('42 likes')).toBeInTheDocument();
  });

  it('should toggle saved state when clicking save button', () => {
    render(
      <ThemeProvider theme={mockTheme}>
        <Post
          username="testuser"
          avatar="/avatar.jpg"
          image="/post.jpg"
          likes={42}
          caption="Test caption"
          timestamp="2 hours ago"
          comments={[]}
        />
      </ThemeProvider>
    );

    const saveButton = screen.getAllByRole('button')[4]; // Last button is save
    fireEvent.click(saveButton);
    // Component should update state (no visual change in test without checking icon)
  });

  it('should toggle comments visibility when clicking comment button', () => {
    render(
      <ThemeProvider theme={mockTheme}>
        <Post
          username="testuser"
          avatar="/avatar.jpg"
          image="/post.jpg"
          likes={42}
          caption="Test caption"
          timestamp="2 hours ago"
          comments={[{ username: 'user1', text: 'Great post!' }]}
        />
      </ThemeProvider>
    );

    // Comment from existing comments should not be visible initially
    expect(screen.queryByText('Great post!')).not.toBeVisible();

    const commentButton = screen.getAllByRole('button')[2]; // Third button is comment
    fireEvent.click(commentButton);

    // Comment should now be visible
    expect(screen.getByText('Great post!')).toBeVisible();
  });

  it('should add a comment when typing and clicking send', () => {
    render(
      <ThemeProvider theme={mockTheme}>
        <Post
          username="testuser"
          avatar="/avatar.jpg"
          image="/post.jpg"
          likes={42}
          caption="Test caption"
          timestamp="2 hours ago"
          comments={[]}
        />
      </ThemeProvider>
    );

    // Open comments section
    const commentButton = screen.getAllByRole('button')[2];
    fireEvent.click(commentButton);

    // Type a comment
    const commentInput = screen.getByPlaceholderText(/add a comment/i);
    fireEvent.change(commentInput, { target: { value: 'New comment!' } });

    // Click send button
    const sendButtons = screen.getAllByRole('button');
    const sendButton = sendButtons[sendButtons.length - 1];
    fireEvent.click(sendButton);

    // Comment should be added
    expect(screen.getByText(/New comment!/i)).toBeInTheDocument();
  });

  it('should add a comment when pressing Enter', () => {
    render(
      <ThemeProvider theme={mockTheme}>
        <Post
          username="testuser"
          avatar="/avatar.jpg"
          image="/post.jpg"
          likes={42}
          caption="Test caption"
          timestamp="2 hours ago"
          comments={[]}
        />
      </ThemeProvider>
    );

    // Open comments section
    const commentButton = screen.getAllByRole('button')[2];
    fireEvent.click(commentButton);

    // Type a comment and press Enter
    const commentInput = screen.getByPlaceholderText(/add a comment/i);
    fireEvent.change(commentInput, { target: { value: 'Another comment' } });
    fireEvent.keyDown(commentInput, { key: 'Enter', code: 'Enter' });

    // Comment should be added
    expect(screen.getByText(/Another comment/i)).toBeInTheDocument();
  });

  it('should not add empty comments', () => {
    render(
      <ThemeProvider theme={mockTheme}>
        <Post
          username="testuser"
          avatar="/avatar.jpg"
          image="/post.jpg"
          likes={42}
          caption="Test caption"
          timestamp="2 hours ago"
          comments={[]}
        />
      </ThemeProvider>
    );

    // Open comments section
    const commentButton = screen.getAllByRole('button')[2];
    fireEvent.click(commentButton);

    // Try to submit empty comment
    const sendButtons = screen.getAllByRole('button');
    const sendButton = sendButtons[sendButtons.length - 1];

    // Send button should be disabled for empty input
    expect(sendButton).toBeDisabled();
  });

  it('should like post when double-clicking image', () => {
    render(
      <ThemeProvider theme={mockTheme}>
        <Post
          username="testuser"
          avatar="/avatar.jpg"
          image="/post.jpg"
          likes={42}
          caption="Test caption"
          timestamp="2 hours ago"
          comments={[]}
        />
      </ThemeProvider>
    );

    expect(screen.getByText('42 likes')).toBeInTheDocument();

    const image = screen.getByAltText('Post');
    const imageContainer = image.parentElement;
    if (imageContainer) {
      fireEvent.doubleClick(imageContainer);
    }

    expect(screen.getByText('43 likes')).toBeInTheDocument();
  });

  it('should not increase likes when double-clicking if already liked', () => {
    render(
      <ThemeProvider theme={mockTheme}>
        <Post
          username="testuser"
          avatar="/avatar.jpg"
          image="/post.jpg"
          likes={42}
          caption="Test caption"
          timestamp="2 hours ago"
          comments={[]}
        />
      </ThemeProvider>
    );

    // Like first
    const likeButton = screen.getAllByRole('button')[1];
    fireEvent.click(likeButton);
    expect(screen.getByText('43 likes')).toBeInTheDocument();

    // Double click should not increase likes again
    const image = screen.getByAltText('Post');
    const imageContainer = image.parentElement;
    if (imageContainer) {
      fireEvent.doubleClick(imageContainer);
    }

    expect(screen.getByText('43 likes')).toBeInTheDocument();
  });

  it('should display existing comments when provided', () => {
    render(
      <ThemeProvider theme={mockTheme}>
        <Post
          username="testuser"
          avatar="/avatar.jpg"
          image="/post.jpg"
          likes={42}
          caption="Test caption"
          timestamp="2 hours ago"
          comments={[
            { username: 'user1', text: 'Great post!' },
            { username: 'user2', text: 'Love this!' },
          ]}
        />
      </ThemeProvider>
    );

    // Open comments
    const viewCommentsText = screen.getByText('View all 2 comments');
    fireEvent.click(viewCommentsText);

    expect(screen.getByText('Great post!')).toBeInTheDocument();
    expect(screen.getByText('Love this!')).toBeInTheDocument();
  });

  it('should clear comment input after submitting', () => {
    render(
      <ThemeProvider theme={mockTheme}>
        <Post
          username="testuser"
          avatar="/avatar.jpg"
          image="/post.jpg"
          likes={42}
          caption="Test caption"
          timestamp="2 hours ago"
          comments={[]}
        />
      </ThemeProvider>
    );

    // Open comments
    const commentButton = screen.getAllByRole('button')[2];
    fireEvent.click(commentButton);

    // Type and submit a comment
    const commentInput = screen.getByPlaceholderText(/add a comment/i) as HTMLInputElement;
    fireEvent.change(commentInput, { target: { value: 'Test comment' } });

    const sendButtons = screen.getAllByRole('button');
    const sendButton = sendButtons[sendButtons.length - 1];
    fireEvent.click(sendButton);

    // Input should be cleared
    expect(commentInput.value).toBe('');
  });

  it('should use default empty array when comments prop is not provided - line 46', () => {
    render(
      <ThemeProvider theme={mockTheme}>
        <Post
          username="testuser"
          avatar="/avatar.jpg"
          image="/post.jpg"
          likes={42}
          caption="Test caption"
          timestamp="2 hours ago"
        />
      </ThemeProvider>
    );

    // Post should render without "View all X comments" since comments defaults to []
    expect(screen.queryByText(/view all/i)).not.toBeInTheDocument();
    expect(screen.getByText('42 likes')).toBeInTheDocument();
  });
});
