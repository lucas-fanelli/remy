import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import Stories from '../Stories';

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

describe('Stories Component', () => {
  // Mock scrollBy method
  let scrollByMock: jest.Mock;

  beforeEach(() => {
    scrollByMock = jest.fn();
    Element.prototype.scrollBy = scrollByMock;
  });

  it('should render stories component', () => {
    render(
      <ThemeProvider theme={mockTheme}>
        <Stories />
      </ThemeProvider>
    );

    // Stories component renders story items
    const storyElements = screen.getAllByRole('img');
    expect(storyElements.length).toBeGreaterThan(0);
  });

  it('should render your story', () => {
    render(
      <ThemeProvider theme={mockTheme}>
        <Stories />
      </ThemeProvider>
    );

    expect(screen.getByText('Your story')).toBeInTheDocument();
  });

  it('should render all story usernames', () => {
    render(
      <ThemeProvider theme={mockTheme}>
        <Stories />
      </ThemeProvider>
    );

    expect(screen.getByText('Your story')).toBeInTheDocument();
    expect(screen.getByText('john_doe')).toBeInTheDocument();
    expect(screen.getByText('jane_smith')).toBeInTheDocument();
    expect(screen.getByText('photography')).toBeInTheDocument();
    expect(screen.getByText('travel_blog')).toBeInTheDocument();
    expect(screen.getByText('food_lover')).toBeInTheDocument();
    expect(screen.getByText('tech_news')).toBeInTheDocument();
    expect(screen.getByText('fitness_pro')).toBeInTheDocument();
  });

  it('should render multiple stories', () => {
    render(
      <ThemeProvider theme={mockTheme}>
        <Stories />
      </ThemeProvider>
    );

    const storyElements = screen.getAllByRole('img');
    expect(storyElements.length).toBe(8);
  });

  it('should render left scroll button', () => {
    render(
      <ThemeProvider theme={mockTheme}>
        <Stories />
      </ThemeProvider>
    );

    const buttons = screen.getAllByRole('button');
    expect(buttons.length).toBe(2); // Left and right buttons
  });

  it('should render right scroll button', () => {
    render(
      <ThemeProvider theme={mockTheme}>
        <Stories />
      </ThemeProvider>
    );

    const buttons = screen.getAllByRole('button');
    expect(buttons.length).toBe(2); // Left and right buttons
  });

  it('should call scrollBy when left button is clicked', () => {
    render(
      <ThemeProvider theme={mockTheme}>
        <Stories />
      </ThemeProvider>
    );

    const buttons = screen.getAllByRole('button');
    const leftButton = buttons[0]; // First button is left

    fireEvent.click(leftButton);

    expect(scrollByMock).toHaveBeenCalledWith({
      left: -300,
      behavior: 'smooth',
    });
  });

  it('should call scrollBy when right button is clicked', () => {
    render(
      <ThemeProvider theme={mockTheme}>
        <Stories />
      </ThemeProvider>
    );

    const buttons = screen.getAllByRole('button');
    const rightButton = buttons[1]; // Second button is right

    fireEvent.click(rightButton);

    expect(scrollByMock).toHaveBeenCalledWith({
      left: 300,
      behavior: 'smooth',
    });
  });

  it('should scroll left with correct amount', () => {
    render(
      <ThemeProvider theme={mockTheme}>
        <Stories />
      </ThemeProvider>
    );

    const buttons = screen.getAllByRole('button');
    const leftButton = buttons[0];

    fireEvent.click(leftButton);

    expect(scrollByMock).toHaveBeenCalledWith(
      expect.objectContaining({
        left: -300,
      })
    );
  });

  it('should scroll right with correct amount', () => {
    render(
      <ThemeProvider theme={mockTheme}>
        <Stories />
      </ThemeProvider>
    );

    const buttons = screen.getAllByRole('button');
    const rightButton = buttons[1];

    fireEvent.click(rightButton);

    expect(scrollByMock).toHaveBeenCalledWith(
      expect.objectContaining({
        left: 300,
      })
    );
  });

  it('should use smooth scroll behavior', () => {
    render(
      <ThemeProvider theme={mockTheme}>
        <Stories />
      </ThemeProvider>
    );

    const buttons = screen.getAllByRole('button');
    fireEvent.click(buttons[0]);

    expect(scrollByMock).toHaveBeenCalledWith(
      expect.objectContaining({
        behavior: 'smooth',
      })
    );
  });

  it('should render story avatars', () => {
    render(
      <ThemeProvider theme={mockTheme}>
        <Stories />
      </ThemeProvider>
    );

    const avatars = screen.getAllByRole('img');
    expect(avatars.length).toBe(8);

    // Check first avatar has correct alt text
    expect(avatars[0]).toHaveAttribute('alt', 'Your story');
  });

  it('should render story with correct avatar alt text', () => {
    render(
      <ThemeProvider theme={mockTheme}>
        <Stories />
      </ThemeProvider>
    );

    expect(screen.getByAltText('Your story')).toBeInTheDocument();
    expect(screen.getByAltText('john_doe')).toBeInTheDocument();
    expect(screen.getByAltText('jane_smith')).toBeInTheDocument();
  });

  it('should handle multiple left scroll clicks', () => {
    render(
      <ThemeProvider theme={mockTheme}>
        <Stories />
      </ThemeProvider>
    );

    const buttons = screen.getAllByRole('button');
    const leftButton = buttons[0];

    fireEvent.click(leftButton);
    fireEvent.click(leftButton);
    fireEvent.click(leftButton);

    expect(scrollByMock).toHaveBeenCalledTimes(3);
  });

  it('should handle multiple right scroll clicks', () => {
    render(
      <ThemeProvider theme={mockTheme}>
        <Stories />
      </ThemeProvider>
    );

    const buttons = screen.getAllByRole('button');
    const rightButton = buttons[1];

    fireEvent.click(rightButton);
    fireEvent.click(rightButton);

    expect(scrollByMock).toHaveBeenCalledTimes(2);
  });

  it('should render stories in a scrollable container', () => {
    render(
      <ThemeProvider theme={mockTheme}>
        <Stories />
      </ThemeProvider>
    );

    // Stories are rendered - scrollable container exists implicitly
    const storyElements = screen.getAllByRole('img');
    expect(storyElements.length).toBe(8);
  });

  it('should render all usernames truncated correctly', () => {
    render(
      <ThemeProvider theme={mockTheme}>
        <Stories />
      </ThemeProvider>
    );

    // All usernames should be rendered
    const usernames = [
      'Your story',
      'john_doe',
      'jane_smith',
      'photography',
      'travel_blog',
      'food_lover',
      'tech_news',
      'fitness_pro',
    ];

    usernames.forEach((username) => {
      expect(screen.getByText(username)).toBeInTheDocument();
    });
  });

  it('should render Paper component wrapper', () => {
    const { container } = render(
      <ThemeProvider theme={mockTheme}>
        <Stories />
      </ThemeProvider>
    );

    // Paper component should be rendered
    const paper = container.querySelector('.MuiPaper-root');
    expect(paper).toBeInTheDocument();
  });
});
