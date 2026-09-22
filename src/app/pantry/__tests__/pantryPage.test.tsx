import { QueryClient } from '@tanstack/react-query';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import React from 'react';
import { queryWrapper, testQueryClient } from '@/__tests__/helpers/queryClient';
import { afterPantryChangedElsewhere, type PantryItem } from '@/hooks/usePantry';
import { queryKeys } from '@/lib/query/keys';
import PantryPage from '../page';

/**
 * What Lucas saw in production: every delete in the pantry "reloaded the page". Each write
 * re-read the whole pantry, and while that read ran the page rendered nothing and then
 * played its entrance again. These tests hold the page to the opposite: a write changes
 * the one item it is about, nothing is re-read, and the page never goes blank.
 */

const mockUseAuth = jest.fn();
jest.mock('@/contexts/AuthContext', () => ({
  useAuth: () => mockUseAuth(),
}));

const item = (id: string, name: string, overrides: Partial<PantryItem> = {}): PantryItem => ({
  id,
  name,
  quantity: 2,
  unit: 'units',
  category: 'vegetable',
  expiresAt: null,
  notes: null,
  addedAt: '2026-01-01T00:00:00.000Z',
  ...overrides,
});

const carrot = item('item-1', 'Carrot');
const onion = item('item-2', 'Onion');

const mockFetch = jest.fn();

const json = (body: unknown, status = 200) =>
  Promise.resolve({ ok: status < 400, status, json: async () => body } as Response);

/** A response that answers only when the test says so. */
function deferred() {
  let resolve!: (response: Promise<Response>) => void;
  const promise = new Promise<Response>((done) => {
    resolve = (response) => void response.then(done);
  });
  return { promise, resolve };
}

const pantryReads = () =>
  mockFetch.mock.calls.filter(([url, init]) => url === '/api/pantry' && !init?.method);

function renderPage(client: QueryClient = testQueryClient()) {
  return { client, ...render(<PantryPage />, { wrapper: queryWrapper(client) }) };
}

async function confirmDelete(name: string) {
  const row = (await screen.findByText(name)).closest('li')!;
  fireEvent.click(within(row).getByTestId('DeleteIcon').closest('button')!);
  fireEvent.click(await screen.findByRole('button', { name: 'Delete' }));
}

describe('The pantry page', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    global.fetch = mockFetch as unknown as typeof fetch;
    mockUseAuth.mockReturnValue({
      user: { id: 'owner-1' },
      isAuthenticated: true,
      isLoading: false,
    });
    mockFetch.mockImplementation(() => json({ pantry: { items: [carrot, onion] } }));
  });

  it('shows a placeholder the size of the page while the first read runs, not nothing', () => {
    mockFetch.mockImplementation(() => new Promise(() => {}));

    const { container } = renderPage();

    expect(screen.getByRole('status', { name: 'Loading...' })).toBeInTheDocument();
    expect(container).not.toBeEmptyDOMElement();
  });

  it('says a pantry that cannot be read failed, instead of calling it empty', async () => {
    mockFetch.mockImplementation(() => json({}, 500));

    renderPage();

    expect(await screen.findByText('Failed to load pantry')).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /add your first ingredient/i })
    ).not.toBeInTheDocument();
  });

  it('takes a deleted item out at once, without reading the pantry again or going blank', async () => {
    const pendingDelete = deferred();
    mockFetch.mockImplementation((url: string, init?: RequestInit) =>
      init?.method === 'DELETE'
        ? pendingDelete.promise
        : json({ pantry: { items: [carrot, onion] } })
    );
    renderPage();

    await confirmDelete('Carrot');

    // The server has not answered yet.
    await waitFor(() => expect(screen.queryByText('Carrot')).not.toBeInTheDocument());
    expect(screen.getByText('Onion')).toBeInTheDocument();
    expect(screen.getByText('My Pantry')).toBeInTheDocument();

    await act(async () => pendingDelete.resolve(json({ message: 'deleted' })));

    expect(await screen.findByText('Item deleted successfully')).toBeInTheDocument();
    expect(pantryReads()).toHaveLength(1);
  });

  it('puts a deleted item back, and says so, when the server refuses', async () => {
    mockFetch.mockImplementation((url: string, init?: RequestInit) =>
      init?.method === 'DELETE' ? json({}, 500) : json({ pantry: { items: [carrot, onion] } })
    );
    renderPage();

    await confirmDelete('Carrot');

    expect(await screen.findByText('Failed to delete item')).toBeInTheDocument();
    expect(screen.getByText('Carrot')).toBeInTheDocument();
  });

  it('does not let a read sent before a delete bring the item back', async () => {
    // A read already on its way — here, one asked for because a cook changed the pantry —
    // was answered by a server that still had the item.
    const staleRead = deferred();
    let reads = 0;
    let deleted = false;
    mockFetch.mockImplementation((url: string, init?: RequestInit) => {
      if (init?.method === 'DELETE') {
        deleted = true;
        return json({ message: 'deleted' });
      }
      reads += 1;
      if (reads === 2) return staleRead.promise;
      return json({ pantry: { items: deleted ? [onion] : [carrot, onion] } });
    });
    const { client } = renderPage();
    await screen.findByText('Carrot');

    act(() => afterPantryChangedElsewhere(client));
    await waitFor(() => expect(reads).toBe(2));
    await confirmDelete('Carrot');
    await act(async () => staleRead.resolve(json({ pantry: { items: [carrot, onion] } })));

    await screen.findByText('Item deleted successfully');
    // The cancelled read is sent again once the delete is done, and that one is current.
    await waitFor(() => expect(reads).toBe(3));
    expect(screen.queryByText('Carrot')).not.toBeInTheDocument();
  });

  it('puts an added item where it belongs, from the server’s answer, without reading again', async () => {
    const garlic = item('item-3', 'Garlic');
    mockFetch.mockImplementation((url: string, init?: RequestInit) =>
      init?.method === 'POST'
        ? json({ item: garlic }, 201)
        : json({ pantry: { items: [carrot, onion] } })
    );
    renderPage();

    fireEvent.click(await screen.findByRole('button', { name: 'Add Ingredient' }));
    const dialog = await screen.findByRole('dialog');
    fireEvent.change(within(dialog).getByLabelText(/Ingredient Name/), {
      target: { value: 'Garlic' },
    });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Add' }));

    expect(await screen.findByText('Item added successfully')).toBeInTheDocument();
    // By the DOM rather than by role: the closing dialog hides the page from the
    // accessibility tree until its exit transition ends.
    const names = Array.from(document.querySelectorAll('li')).map(
      (row) => within(row).queryByText(/^(Carrot|Garlic|Onion)$/)?.textContent
    );
    expect(names).toEqual(['Carrot', 'Garlic', 'Onion']);
    expect(pantryReads()).toHaveLength(1);
  });

  it('shows an edit as the server stored it', async () => {
    mockFetch.mockImplementation((url: string, init?: RequestInit) =>
      init?.method === 'PUT'
        ? json({ item: { ...carrot, quantity: 7 } })
        : json({ pantry: { items: [carrot, onion] } })
    );
    renderPage();

    const row = (await screen.findByText('Carrot')).closest('li')!;
    fireEvent.click(within(row).getByTestId('EditIcon').closest('button')!);
    fireEvent.click(
      within(await screen.findByRole('dialog')).getByRole('button', { name: 'Update' })
    );

    expect(await screen.findByText('7 units')).toBeInTheDocument();
    expect(pantryReads()).toHaveLength(1);
  });

  it('still offers to modify the item you have when the server says it is a duplicate', async () => {
    mockFetch.mockImplementation((url: string, init?: RequestInit) =>
      init?.method === 'POST'
        ? json({ error: 'exists', code: 'pantry.duplicate' }, 409)
        : json({ pantry: { items: [carrot, onion] } })
    );
    renderPage();

    fireEvent.click(await screen.findByRole('button', { name: 'Add Ingredient' }));
    const dialog = await screen.findByRole('dialog');
    fireEvent.change(within(dialog).getByLabelText(/Ingredient Name/), {
      target: { value: 'carrot' },
    });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Add' }));

    expect(await screen.findByText('Ingredient Already Exists')).toBeInTheDocument();
  });

  it('marks the home page’s pantry matches stale after a change', async () => {
    const client = testQueryClient();
    client.setQueryData(queryKeys.matched(), { recipes: [] });
    mockFetch.mockImplementation((url: string, init?: RequestInit) =>
      init?.method === 'DELETE'
        ? json({ message: 'deleted' })
        : json({ pantry: { items: [carrot, onion] } })
    );
    renderPage(client);

    await confirmDelete('Carrot');

    await waitFor(() =>
      expect(client.getQueryState(queryKeys.matched())?.isInvalidated).toBe(true)
    );
  });
});

describe('afterPantryChangedElsewhere', () => {
  it('marks every cached pantry and the matches stale', () => {
    // Cooking takes ingredients out of the pantry and undoing the cook puts them back; the
    // recipe page calls this after both.
    const client = testQueryClient();
    client.setQueryData(queryKeys.pantry('owner-1'), [carrot]);
    client.setQueryData(queryKeys.matched(), { recipes: [] });

    afterPantryChangedElsewhere(client);

    expect(client.getQueryState(queryKeys.pantry('owner-1'))?.isInvalidated).toBe(true);
    expect(client.getQueryState(queryKeys.matched())?.isInvalidated).toBe(true);
  });
});
