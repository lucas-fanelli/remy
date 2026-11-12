import { ThemeProvider, createTheme } from '@mui/material/styles';
import { render, screen } from '@testing-library/react';
import React from 'react';
import RecipeCard from '../RecipeCard';

/**
 * What a card asks Next to prefetch. Next prefetches every link that scrolls into view, so
 * each card in a feed page cost a server call for its author's profile, which almost nobody
 * opens from there. The recipe link keeps its prefetch: that is the tap, and it is what lets
 * the recipe's skeleton show at once.
 */

jest.mock('next/link', () => {
  const Link = React.forwardRef(function MockLink(
    { href, prefetch, children, ...props }: Record<string, unknown>,
    ref: React.Ref<HTMLAnchorElement>
  ) {
    return (
      <a ref={ref} href={String(href)} data-prefetch={String(prefetch)} {...props}>
        {children as React.ReactNode}
      </a>
    );
  });
  return { __esModule: true, default: Link };
});

jest.mock('framer-motion', () => {
  const passThrough = (Component: string) =>
    React.forwardRef(function Motion(
      { initial, animate, exit, transition, whileHover, whileTap, layout, ...props }: any,
      ref: any
    ) {
      return React.createElement(Component, { ...props, ref });
    });
  const motion: any = (component: any) => component;
  motion.create = (component: any) => component;
  motion.div = passThrough('div');
  return { motion, AnimatePresence: ({ children }: any) => <>{children}</> };
});

const recipe = {
  id: 'r1',
  title: 'Empanadas',
  imageUrl: 'https://res.cloudinary.com/demo/image/upload/v1/sample.jpg',
  author: { username: 'ana', avatar: null },
  likeCount: 0,
  commentCount: 0,
};

describe('what a recipe card prefetches', () => {
  beforeEach(() => {
    render(
      <ThemeProvider theme={createTheme()}>
        <RecipeCard recipe={recipe} viewer={null} />
      </ThemeProvider>
    );
  });

  it('does not prefetch the author, from the name or the avatar', () => {
    const authorLinks = screen
      .getAllByRole('link')
      .filter((link) => link.getAttribute('href') === '/profile/ana');

    expect(authorLinks.length).toBeGreaterThan(0);
    authorLinks.forEach((link) => expect(link).toHaveAttribute('data-prefetch', 'false'));
  });

  it('leaves the recipe link to Next, which prefetches it', () => {
    const recipeLink = screen.getByRole('link', { name: 'Empanadas' });

    expect(recipeLink).toHaveAttribute('data-prefetch', 'undefined');
  });
});
