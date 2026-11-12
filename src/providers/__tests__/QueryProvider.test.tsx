import { MutationObserver, QueryObserver } from '@tanstack/react-query';
import { act, waitFor } from '@testing-library/react';
import { getQueryClient } from '../QueryProvider';

/**
 * Coming back to the app reads again what has gone stale. It was switched off, and with two
 * accounts in two windows nothing one did reached the other without a reload.
 */

describe("the app's query client", () => {
  const client = getQueryClient();

  // What QueryClientProvider does: until mounted, a client hears no focus at all.
  beforeAll(() => client.mount());
  afterAll(() => client.unmount());

  /** A query something is watching, stale from the start, counting its reads. */
  async function watchedQuery(key: string) {
    const read = jest.fn().mockResolvedValue('answer');
    const observer = new QueryObserver(client, { queryKey: [key], queryFn: read, staleTime: 0 });
    const stop = observer.subscribe(() => {});
    await waitFor(() => expect(read).toHaveBeenCalledTimes(1));
    return { read, stop };
  }

  afterEach(() => client.clear());

  it('reads a stale query again when the window gets focus', async () => {
    // Moving between two windows side by side changes no visibility — both stay visible —
    // so the tab's own visibility change, React Query's default signal, never fired.
    const { read, stop } = await watchedQuery('focus');

    act(() => {
      window.dispatchEvent(new Event('focus'));
    });

    await waitFor(() => expect(read).toHaveBeenCalledTimes(2));
    stop();
  });

  it('reads it again when the tab becomes visible, as before', async () => {
    const { read, stop } = await watchedQuery('visible');

    act(() => {
      document.dispatchEvent(new Event('visibilitychange'));
      window.dispatchEvent(new Event('visibilitychange'));
    });

    await waitFor(() => expect(read).toHaveBeenCalledTimes(2));
    stop();
  });

  it('does not read while a write is on its way', async () => {
    // A read sent then can be answered before the write lands and paint the state from
    // before the tap over it.
    const { read, stop } = await watchedQuery('writing');
    const write = new MutationObserver(client, { mutationFn: () => new Promise(() => {}) });
    void write.mutate();
    await waitFor(() => expect(client.isMutating()).toBe(1));

    act(() => {
      window.dispatchEvent(new Event('focus'));
    });
    await act(async () => {});

    expect(read).toHaveBeenCalledTimes(1);
    stop();
  });
});
