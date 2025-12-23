import React from 'react';
import { render, screen, act } from '@testing-library/react';
import '@testing-library/jest-dom';
import { MotionProvider, useMotionContext } from '../MotionContext';

// Test component that exposes context values
function TestConsumer({
  onMount,
}: {
  onMount?: (context: ReturnType<typeof useMotionContext>) => void;
}) {
  const context = useMotionContext();

  React.useEffect(() => {
    if (onMount) {
      onMount(context);
    }
  }, [context, onMount]);

  return (
    <div>
      <span data-testid="sourceType">{context.sourceType || 'null'}</span>
      <span data-testid="recipeId">{context.recipeId || 'null'}</span>
      <span data-testid="layoutId">{context.layoutId || 'null'}</span>
      <button
        data-testid="setSource-feed"
        onClick={() => context.setSource('feed', 'recipe-123', 'layout-456')}
      >
        Set Feed Source
      </button>
      <button
        data-testid="setSource-search"
        onClick={() => context.setSource('search', 'recipe-789')}
      >
        Set Search Source
      </button>
      <button data-testid="clearSource" onClick={() => context.clearSource()}>
        Clear Source
      </button>
    </div>
  );
}

describe('MotionContext', () => {
  describe('MotionProvider', () => {
    it('should provide initial null values', () => {
      render(
        <MotionProvider>
          <TestConsumer />
        </MotionProvider>
      );

      expect(screen.getByTestId('sourceType')).toHaveTextContent('null');
      expect(screen.getByTestId('recipeId')).toHaveTextContent('null');
      expect(screen.getByTestId('layoutId')).toHaveTextContent('null');
    });

    it('should set source with feed type and layoutId', () => {
      render(
        <MotionProvider>
          <TestConsumer />
        </MotionProvider>
      );

      act(() => {
        screen.getByTestId('setSource-feed').click();
      });

      expect(screen.getByTestId('sourceType')).toHaveTextContent('feed');
      expect(screen.getByTestId('recipeId')).toHaveTextContent('recipe-123');
      expect(screen.getByTestId('layoutId')).toHaveTextContent('layout-456');
    });

    it('should set source with search type without layoutId', () => {
      render(
        <MotionProvider>
          <TestConsumer />
        </MotionProvider>
      );

      act(() => {
        screen.getByTestId('setSource-search').click();
      });

      expect(screen.getByTestId('sourceType')).toHaveTextContent('search');
      expect(screen.getByTestId('recipeId')).toHaveTextContent('recipe-789');
      expect(screen.getByTestId('layoutId')).toHaveTextContent('null');
    });

    it('should clear source values', () => {
      render(
        <MotionProvider>
          <TestConsumer />
        </MotionProvider>
      );

      // First set a source
      act(() => {
        screen.getByTestId('setSource-feed').click();
      });

      expect(screen.getByTestId('sourceType')).toHaveTextContent('feed');

      // Then clear it
      act(() => {
        screen.getByTestId('clearSource').click();
      });

      expect(screen.getByTestId('sourceType')).toHaveTextContent('null');
      expect(screen.getByTestId('recipeId')).toHaveTextContent('null');
      expect(screen.getByTestId('layoutId')).toHaveTextContent('null');
    });

    it('should provide memoized callbacks', () => {
      const contextValues: ReturnType<typeof useMotionContext>[] = [];

      const { rerender } = render(
        <MotionProvider>
          <TestConsumer onMount={(ctx) => contextValues.push(ctx)} />
        </MotionProvider>
      );

      const firstSetSource = contextValues[0]?.setSource;
      const firstClearSource = contextValues[0]?.clearSource;

      // Force re-render
      rerender(
        <MotionProvider>
          <TestConsumer onMount={(ctx) => contextValues.push(ctx)} />
        </MotionProvider>
      );

      // Callbacks should be stable (memoized with useCallback)
      expect(contextValues[1]?.setSource).toBe(firstSetSource);
      expect(contextValues[1]?.clearSource).toBe(firstClearSource);
    });
  });

  describe('useMotionContext', () => {
    it('should return default fallback values when used outside provider', () => {
      // Render without MotionProvider
      render(<TestConsumer />);

      expect(screen.getByTestId('sourceType')).toHaveTextContent('null');
      expect(screen.getByTestId('recipeId')).toHaveTextContent('null');
      expect(screen.getByTestId('layoutId')).toHaveTextContent('null');
    });

    it('should provide no-op functions when used outside provider', () => {
      let capturedContext: ReturnType<typeof useMotionContext> | null = null;

      render(
        <TestConsumer
          onMount={(ctx) => {
            capturedContext = ctx;
          }}
        />
      );

      // These should not throw when called outside provider
      expect(() => {
        capturedContext?.setSource('feed', 'test', 'layout');
        capturedContext?.clearSource();
      }).not.toThrow();
    });

    it('should return context values when used inside provider', () => {
      let capturedContext: ReturnType<typeof useMotionContext> | null = null;

      render(
        <MotionProvider>
          <TestConsumer
            onMount={(ctx) => {
              capturedContext = ctx;
            }}
          />
        </MotionProvider>
      );

      expect(capturedContext).toBeDefined();
      expect(capturedContext?.sourceType).toBe(null);
      expect(capturedContext?.recipeId).toBe(null);
      expect(capturedContext?.layoutId).toBe(null);
      expect(typeof capturedContext?.setSource).toBe('function');
      expect(typeof capturedContext?.clearSource).toBe('function');
    });
  });
});
