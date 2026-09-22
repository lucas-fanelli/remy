import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, renderHook, type RenderOptions } from '@testing-library/react';
import React from 'react';

/**
 * React Query for tests of code that writes.
 *
 * The recipe editor's write hooks tell the cache what they changed — a new recipe, an
 * edit — so every list showing recipes refreshes. That makes them need a QueryClient, and
 * a component test without one fails with "No QueryClient set".
 */

/** A client per test, so nothing cached leaks from one test into the next. */
export const testQueryClient = () =>
  new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });

export function queryWrapper(client: QueryClient = testQueryClient()) {
  return function QueryWrapper({ children }: { children: React.ReactNode }) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  };
}

/** `render`, inside a provider. A `rerender` from the result keeps it. */
export const renderWithQueryClient = (
  ui: React.ReactElement,
  options?: Omit<RenderOptions, 'wrapper'>
) => render(ui, { wrapper: queryWrapper(), ...options });

/** What a hook returns, called inside a provider — for hooks that hand back a function. */
export const callHook = <T,>(useHook: () => T, client?: QueryClient): T =>
  renderHook(useHook, { wrapper: queryWrapper(client) }).result.current;
