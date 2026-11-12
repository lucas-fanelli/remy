'use client';

import { QueryClient, QueryClientProvider, focusManager } from '@tanstack/react-query';

function makeQueryClient() {
  const client: QueryClient = new QueryClient({
    defaultOptions: {
      queries: {
        // Data is fresh for 60 seconds
        staleTime: 60 * 1000,
        // Keep in cache for 5 minutes
        gcTime: 5 * 60 * 1000,
        // Retry failed requests once
        retry: 1,
        // Coming back to the app reads again whatever has gone stale. This was off "for a
        // smoother UX", and the cost showed in production: with two accounts in two windows,
        // nothing one of them did reached the other without a manual reload.
        //
        // Not while a write is on its way, though: a read sent then can be answered before
        // the write lands and paint the state from before the tap over it — the heart
        // undoing itself that useViewerMutation is written to avoid.
        refetchOnWindowFocus: () => client.isMutating() === 0,
      },
    },
  });
  return client;
}

/**
 * What counts as coming back to the app: the tab becoming visible — React Query's own
 * signal — and also the window getting focus. With two windows side by side, as when
 * testing with two accounts, both stay visible the whole time, so moving from one to the
 * other never changes visibility, and returning to a window refreshed nothing.
 */
function listenForReturns() {
  focusManager.setEventListener((onFocus) => {
    const returned = () => onFocus();
    window.addEventListener('visibilitychange', returned, false);
    window.addEventListener('focus', returned, false);
    return () => {
      window.removeEventListener('visibilitychange', returned);
      window.removeEventListener('focus', returned);
    };
  });
}

let browserQueryClient: QueryClient | undefined = undefined;

/** Returns the browser-side QueryClient singleton (null on server). */
export function getQueryClient() {
  if (typeof window === 'undefined') {
    // Server: always make a new query client
    return makeQueryClient();
  } else {
    // Browser: make a new query client if we don't already have one
    if (!browserQueryClient) {
      browserQueryClient = makeQueryClient();
      listenForReturns();
    }
    return browserQueryClient;
  }
}

interface QueryProviderProps {
  children: React.ReactNode;
}

export default function QueryProvider({ children }: QueryProviderProps) {
  // NOTE: Avoid useState when initializing the query client if you don't
  // have a suspense boundary between this and the code that may suspend
  // because React will throw away the client on the initial render if it
  // suspends and there is no boundary
  const queryClient = getQueryClient();

  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}
