import { act, renderHook, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import EditorLiveRegion, { useAnnouncer } from '../EditorLiveRegion';
import { renderWithTheme } from './editorHarness';

describe('EditorLiveRegion', () => {
  it('should announce the message politely and as a whole', () => {
    renderWithTheme(<EditorLiveRegion message="Ingredient 5 added" />);

    const region = screen.getByRole('status');
    expect(region).toHaveTextContent('Ingredient 5 added');
    expect(region).toHaveAttribute('aria-live', 'polite');
    expect(region).toHaveAttribute('aria-atomic', 'true');
  });

  // A bare `1` in sx is a fraction: the region was 100% x 100%, which made the dialog
  // Paper scrollable and added a viewport of blank scroll under a page
  it('should take one pixel, never a share of its container', () => {
    renderWithTheme(<EditorLiveRegion message="" />);

    const style = window.getComputedStyle(screen.getByRole('status'));
    expect(style.width).toBe('1px');
    expect(style.height).toBe('1px');
  });

  it('should be out of the flow and clipped', () => {
    renderWithTheme(<EditorLiveRegion message="" />);

    const style = window.getComputedStyle(screen.getByRole('status'));
    expect(style.position).toBe('absolute');
    expect(style.overflow).toBe('hidden');
  });
});

describe('useAnnouncer', () => {
  it('should start silent', () => {
    const { result } = renderHook(() => useAnnouncer());

    expect(result.current.message).toBe('');
  });

  it('should publish the announced sentence', () => {
    const { result } = renderHook(() => useAnnouncer());

    act(() => result.current.announce('Step 2 removed'));

    expect(result.current.message).toBe('Step 2 removed');
  });

  it('should change the message when the same sentence is announced twice', () => {
    const { result } = renderHook(() => useAnnouncer());
    act(() => result.current.announce('Step 2 removed'));

    act(() => result.current.announce('Step 2 removed'));

    expect(result.current.message).not.toBe('Step 2 removed');
    expect(result.current.message.trim()).toBe('Step 2 removed');
  });
});
