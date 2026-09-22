import { act, render } from '@testing-library/react';
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

  describe('a link to a fragment', () => {
    // The comment button links to `/recipe/<id>#comments`. The comments render after the
    // recipe loads, so the browser — which resolves a fragment once, on arrival — never
    // found them, and the link opened the recipe at the top.

    /** Under the fixed header: what globals.css sets as `scroll-padding-top`. */
    const HEADER_OFFSET = 80;
    /** Where the target sits by layout: its own offset plus its offset parent's. */
    const LAYOUT_TOP = 1200 + 300;
    const EXPECTED = LAYOUT_TOP - HEADER_OFFSET;

    let resizeCallbacks: Array<() => void> = [];

    class FakeResizeObserver {
      constructor(private readonly callback: () => void) {}
      observe() {
        resizeCallbacks.push(this.callback);
      }
      disconnect() {
        resizeCallbacks = resizeCallbacks.filter((callback) => callback !== this.callback);
      }
    }

    /** The target, positioned by layout (jsdom lays nothing out, so the offsets are set). */
    function renderTarget(offsetTop = 1200) {
      const parent = document.createElement('div');
      const target = document.createElement('div');
      target.id = 'comments';
      Object.defineProperty(target, 'offsetTop', { configurable: true, value: offsetTop });
      Object.defineProperty(target, 'offsetParent', { configurable: true, value: parent });
      Object.defineProperty(parent, 'offsetTop', { configurable: true, value: 300 });
      Object.defineProperty(parent, 'offsetParent', { configurable: true, value: null });
      parent.appendChild(target);
      document.body.appendChild(parent);
      return target;
    }

    /** MutationObserver answers in a microtask. */
    const flush = () => act(async () => {});

    function navigateToComments(rerender: (ui: React.ReactElement) => void) {
      window.location.hash = '#comments';
      mockPathname.mockReturnValue('/recipe/abc');
      rerender(<ScrollReset />);
    }

    beforeEach(() => {
      resizeCallbacks = [];
      (window as unknown as { ResizeObserver: unknown }).ResizeObserver = FakeResizeObserver;
      jest
        .spyOn(window, 'getComputedStyle')
        .mockReturnValue({ scrollPaddingTop: `${HEADER_OFFSET}px` } as CSSStyleDeclaration);
    });

    afterEach(() => {
      jest.restoreAllMocks();
      jest.useRealTimers();
      document.body.innerHTML = '';
    });

    it('goes to a target already on the page, under the header', () => {
      const { rerender } = render(<ScrollReset />);
      renderTarget();

      navigateToComments(rerender);

      expect(scrollTo).toHaveBeenCalledWith(0, EXPECTED);
    });

    it('waits at the top for a target the page renders later, and goes there when it does', async () => {
      const { rerender } = render(<ScrollReset />);

      navigateToComments(rerender);
      // Not left wherever the previous page was while the recipe loads.
      expect(scrollTo).toHaveBeenLastCalledWith(0, 0);

      renderTarget();
      await flush();

      expect(scrollTo).toHaveBeenLastCalledWith(0, EXPECTED);
    });

    it('keeps the target in place while the page above it fills in', async () => {
      // Measured: the photo above loaded after the comments appeared and pushed them back
      // off the screen.
      const { rerender } = render(<ScrollReset />);
      navigateToComments(rerender);
      const target = renderTarget();
      await flush();

      Object.defineProperty(target, 'offsetTop', { configurable: true, value: 1600 });
      act(() => resizeCallbacks.forEach((callback) => callback()));

      expect(scrollTo).toHaveBeenLastCalledWith(0, 1600 + 300 - HEADER_OFFSET);
    });

    it('lets the reader take over', async () => {
      const { rerender } = render(<ScrollReset />);
      navigateToComments(rerender);

      window.dispatchEvent(new Event('wheel'));
      renderTarget();
      await flush();

      expect(scrollTo).not.toHaveBeenCalledWith(0, EXPECTED);
    });

    it('stops waiting when the reader leaves for another page', async () => {
      const { rerender } = render(<ScrollReset />);
      navigateToComments(rerender);

      window.location.hash = '';
      mockPathname.mockReturnValue('/pantry');
      rerender(<ScrollReset />);
      renderTarget();
      await flush();

      expect(scrollTo).not.toHaveBeenCalledWith(0, EXPECTED);
    });

    it('gives up on a target that never renders', async () => {
      jest.useFakeTimers();
      const { rerender } = render(<ScrollReset />);
      navigateToComments(rerender);

      act(() => jest.advanceTimersByTime(10_000));
      renderTarget();
      await flush();

      expect(scrollTo).not.toHaveBeenCalledWith(0, EXPECTED);
    });

    it('resolves a fragment on a first load too, without resetting while it waits', async () => {
      // A shared link to a recipe's comments, opened in a new tab.
      window.location.hash = '#comments';
      mockPathname.mockReturnValue('/recipe/abc');
      render(<ScrollReset />);
      expect(scrollTo).not.toHaveBeenCalled();

      renderTarget();
      await flush();

      expect(scrollTo).toHaveBeenLastCalledWith(0, EXPECTED);
    });

    it('survives a hash nobody can decode', () => {
      // Anyone can type a URL; a stray `%` makes decodeURIComponent throw, and from the
      // app's frame that would take the whole page down.
      const { rerender } = render(<ScrollReset />);

      window.location.hash = '#100%';
      mockPathname.mockReturnValue('/recipe/abc');

      expect(() => rerender(<ScrollReset />)).not.toThrow();
    });

    it('leaves back and forward alone even with a fragment', () => {
      const { rerender } = render(<ScrollReset />);
      renderTarget();

      window.dispatchEvent(new PopStateEvent('popstate'));
      navigateToComments(rerender);

      expect(scrollTo).not.toHaveBeenCalled();
    });
  });

  it('renders nothing', () => {
    const { container } = render(<ScrollReset />);

    expect(container).toBeEmptyDOMElement();
  });
});
