import { render } from '@testing-library/react';
import React from 'react';
import ScrollReset from '../ScrollReset';

/**
 * Measured before this existed: going from the feed at scroll 2500 into a recipe ended at
 * 740, which plus the 1273px viewport is exactly that recipe's height — the last line of
 * something you had not read yet.
 */

const mockPathname = jest.fn();
jest.mock('next/navigation', () => ({
  usePathname: () => mockPathname(),
}));

describe('ScrollReset', () => {
  const scrollTo = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    window.scrollTo = scrollTo as unknown as typeof window.scrollTo;
    window.location.hash = '';
    mockPathname.mockReturnValue('/');
  });

  it('does not fight the first paint', () => {
    // A cold load, or a link opened in a new tab, is already where it should be.
    render(<ScrollReset />);

    expect(scrollTo).not.toHaveBeenCalled();
  });

  it('starts a new page at the top', () => {
    const { rerender } = render(<ScrollReset />);

    mockPathname.mockReturnValue('/recipe/abc');
    rerender(<ScrollReset />);

    expect(scrollTo).toHaveBeenCalledWith(0, 0);
  });

  it('leaves back and forward where the reader left them', () => {
    // The failure this guards against is replacing one bug with a worse one: resetting
    // unconditionally means going "back" to a feed you had scrolled deep into dumps you
    // at the top of it.
    const { rerender } = render(<ScrollReset />);

    window.dispatchEvent(new PopStateEvent('popstate'));
    mockPathname.mockReturnValue('/recipe/abc');
    rerender(<ScrollReset />);

    expect(scrollTo).not.toHaveBeenCalled();
  });

  it('resets again on the navigation after a back', () => {
    // The history flag is consumed, not sticky.
    const { rerender } = render(<ScrollReset />);

    window.dispatchEvent(new PopStateEvent('popstate'));
    mockPathname.mockReturnValue('/recipe/abc');
    rerender(<ScrollReset />);

    mockPathname.mockReturnValue('/pantry');
    rerender(<ScrollReset />);

    expect(scrollTo).toHaveBeenCalledTimes(1);
    expect(scrollTo).toHaveBeenCalledWith(0, 0);
  });

  it('lets a fragment keep the position it asked for', () => {
    // The comment button navigates to `/recipe/<id>#comments`; scrolling to the top would
    // undo the only thing that link is for.
    const { rerender } = render(<ScrollReset />);

    window.location.hash = '#comments';
    mockPathname.mockReturnValue('/recipe/abc');
    rerender(<ScrollReset />);

    expect(scrollTo).not.toHaveBeenCalled();
  });

  it('renders nothing', () => {
    const { container } = render(<ScrollReset />);

    expect(container).toBeEmptyDOMElement();
  });
});
