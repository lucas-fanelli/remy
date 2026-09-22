import { screen, fireEvent, waitFor, within } from '@testing-library/react';
import React from 'react';
import { renderWithQueryClient } from '@/__tests__/helpers/queryClient';
import { ToastProvider } from '@/contexts/ToastContext';
import { renderWithLocale } from '@/i18n/testing';
import PantryPage from '../page';

/**
 * The Spanish half of the pantry screen. The English half is what every other suite already
 * renders, so this file only asserts what the migration added: the copy in Spanish, the
 * plural on the item chip, the category labels, and - the part worth guarding - that
 * translating those labels never touches the values the API is sent.
 */

const mockUseAuth = jest.fn();
jest.mock('@/contexts/AuthContext', () => ({
  useAuth: () => mockUseAuth(),
}));

const pantryItems = [
  {
    id: 'item-1',
    name: 'Zanahoria',
    quantity: 3,
    unit: 'units',
    category: 'vegetable',
    expiresAt: null,
    notes: null,
    addedAt: new Date('2026-01-01').toISOString(),
  },
  {
    id: 'item-2',
    name: 'Sal',
    quantity: 0,
    unit: 'to taste',
    category: 'spice',
    expiresAt: null,
    notes: 'fina',
    addedAt: new Date('2026-01-01').toISOString(),
  },
];

const mockFetch = jest.fn();

// The pantry lives in the query cache now, and speaks through the app's toast.
const renderInSpanish = () =>
  renderWithLocale(
    renderWithQueryClient,
    'es',
    <ToastProvider>
      <PantryPage />
    </ToastProvider>
  );

describe('Pantry in Spanish', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    global.fetch = mockFetch as unknown as typeof fetch;
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ pantry: { items: pantryItems } }),
    });
    mockUseAuth.mockReturnValue({
      user: { id: 'owner-1' },
      isAuthenticated: true,
      isLoading: false,
    });
  });

  it('should render the header and the filters in Spanish', async () => {
    renderInSpanish();

    expect(await screen.findByText('Mi despensa')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Agregar ingrediente' })).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Buscá ingredientes...')).toBeInTheDocument();
    // MUI prints an outlined field's label twice: the <label> and the notch it cuts out
    expect(screen.getAllByText('Filtrar por categoría').length).toBeGreaterThan(0);
  });

  it('should count the items with a Spanish plural', async () => {
    renderInSpanish();

    expect(await screen.findByText('2 ingredientes')).toBeInTheDocument();
  });

  it('should translate the seeded category headings', async () => {
    renderInSpanish();

    expect(await screen.findByText('Verdura')).toBeInTheDocument();
    expect(screen.getByText('Especias')).toBeInTheDocument();
  });

  it('should label the amounts with the Spanish unit and "a gusto"', async () => {
    renderInSpanish();

    expect(await screen.findByText('3 unidades')).toBeInTheDocument();
    expect(screen.getByText('a gusto • fina')).toBeInTheDocument();
  });

  it('should show the guest prompt in Spanish', async () => {
    mockUseAuth.mockReturnValue({ isAuthenticated: false, isLoading: false });

    renderInSpanish();

    expect(await screen.findByText('Iniciá sesión para ver tu despensa')).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Iniciá sesión para continuar' })
    ).toBeInTheDocument();
  });

  it('should render the add dialog in Spanish', async () => {
    renderInSpanish();

    fireEvent.click(await screen.findByRole('button', { name: 'Agregar ingrediente' }));

    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText('Agregar ingrediente')).toBeInTheDocument();
    expect(within(dialog).getByLabelText(/Nombre del ingrediente/)).toBeInTheDocument();
    expect(within(dialog).getByLabelText(/Cantidad \(opcional\)/)).toBeInTheDocument();
    expect(within(dialog).getByLabelText(/Notas \(opcional\)/)).toBeInTheDocument();
    expect(within(dialog).getByText("Dejalo vacío para 'a gusto'")).toBeInTheDocument();
    expect(within(dialog).getByText('Categoría: Otros')).toBeInTheDocument();
  });

  it('should keep saving the English category a Spanish label was chosen from', async () => {
    renderInSpanish();

    fireEvent.click(await screen.findByRole('button', { name: 'Agregar ingrediente' }));
    const dialog = await screen.findByRole('dialog');

    fireEvent.change(within(dialog).getByLabelText(/Nombre del ingrediente/), {
      target: { value: 'Papa' },
    });
    // Typing the Spanish label has to come back as the stored 'vegetable'
    fireEvent.change(within(dialog).getByLabelText(/Categoría/), {
      target: { value: 'Verdura' },
    });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Agregar' }));

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        '/api/pantry',
        expect.objectContaining({ method: 'POST' })
      );
    });

    const [, request] = mockFetch.mock.calls.find(([, init]) => init?.method === 'POST') ?? [];
    expect(JSON.parse(request.body)).toEqual(
      expect.objectContaining({ category: 'vegetable', unit: 'g' })
    );
  });

  it('should offer to undo a delete in Spanish, instead of asking first', async () => {
    renderInSpanish();

    await screen.findByText('Zanahoria');
    fireEvent.click(screen.getAllByTestId('DeleteIcon')[0].closest('button')!);

    expect(await screen.findByText('Eliminamos el ingrediente')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Deshacer' })).toBeInTheDocument();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});
