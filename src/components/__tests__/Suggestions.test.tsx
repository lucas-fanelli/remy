import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import Suggestions from '../Suggestions';

// Mock framer-motion - comprehensive mock supporting all patterns
jest.mock('framer-motion', () => {
  const mockMotion: any = (component: any) => component;
  mockMotion.create = (component: any) => component;
  mockMotion.div = ({ children, initial, animate, exit, transition, whileHover, whileTap, ...props }: any) =>
    <div {...props}>{children}</div>;

  return {
    motion: mockMotion,
    AnimatePresence: ({ children, mode }: any) => <>{children}</>,
  };
});

const mockTheme = createTheme();

const renderWithTheme = (component: React.ReactElement) => {
  return render(
    <ThemeProvider theme={mockTheme}>
      {component}
    </ThemeProvider>
  );
};

describe('Suggestions Component', () => {
  it('should render user profile section', () => {
    renderWithTheme(<Suggestions />);

    expect(screen.getByText('your_username')).toBeInTheDocument();
    expect(screen.getByText('Your Name')).toBeInTheDocument();
    expect(screen.getByText('Switch')).toBeInTheDocument();
  });

  it('should render suggestions header', () => {
    renderWithTheme(<Suggestions />);

    expect(screen.getByText('Suggestions For You')).toBeInTheDocument();
    expect(screen.getByText('See All')).toBeInTheDocument();
  });

  it('should render all suggestion items', () => {
    renderWithTheme(<Suggestions />);

    expect(screen.getByText('sarah_designs')).toBeInTheDocument();
    expect(screen.getByText('alex_photos')).toBeInTheDocument();
    expect(screen.getByText('mike_codes')).toBeInTheDocument();
    expect(screen.getByText('emma_art')).toBeInTheDocument();
    expect(screen.getByText('david_music')).toBeInTheDocument();
  });

  it('should render suggestion subtitles', () => {
    renderWithTheme(<Suggestions />);

    expect(screen.getByText('Followed by user1 + 2 more')).toBeInTheDocument();
    expect(screen.getByText('New to Recipe Sharing')).toBeInTheDocument();
  });

  it('should render follow buttons for each suggestion', () => {
    renderWithTheme(<Suggestions />);

    const followButtons = screen.getAllByText('Follow');
    expect(followButtons).toHaveLength(5);
  });

  it('should render footer with links and copyright', () => {
    renderWithTheme(<Suggestions />);

    expect(screen.getByText(/About · Help · Press/)).toBeInTheDocument();
    expect(screen.getByText('© 2025 RECIPE SHARING APP')).toBeInTheDocument();
  });
});
