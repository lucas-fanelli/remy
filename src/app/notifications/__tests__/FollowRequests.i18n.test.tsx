import { QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen } from '@testing-library/react';
import React from 'react';
import { testQueryClient } from '@/__tests__/helpers/queryClient';
import { ToastProvider } from '@/contexts/ToastContext';
import { renderWithLocale } from '@/i18n/testing';
import FollowRequestsPage from '../requests/page';

/**
 * The follow-request inbox in Spanish: its title, its two answers, and every sentence an
 * answer can end in. followRequestsPage.test.tsx asserts the behaviour in English.
 */

const mockRouter = { push: jest.fn(), back: jest.fn() };
jest.mock('next/navigation', () => ({
  useRouter: () => mockRouter,
}));

jest.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({
    user: { id: 'owner-id', username: 'olga' },
    isLoading: false,
    isAuthenticated: true,
  }),
}));

interface FakeResponse {
  ok: boolean;
  status: number;
  json: () => Promise<unknown>;
}

const respond = (status: number, body: unknown): FakeResponse => ({
  ok: status >= 200 && status < 300,
  status,
  json: async () => body,
});

const ANA = {
  requester: { id: 'id-ana', username: 'ana', fullName: 'Ana López', avatar: null },
  createdAt: '2026-09-22T12:00:00.000Z',
};

/** The inbox read, then how the one answer goes (a status, or `null` for no connection). */
function serve(read: FakeResponse, answer: number | null = 200) {
  (global.fetch as jest.Mock).mockImplementation(async (input: string, init?: RequestInit) => {
    if (init?.method !== 'POST') return read;
    if (answer === null) throw new TypeError('Failed to fetch');
    return respond(answer, answer === 200 ? { success: true } : {});
  });
}

const renderInSpanish = () =>
  renderWithLocale(
    (ui) =>
      render(
        <QueryClientProvider client={testQueryClient()}>
          <ToastProvider>{ui}</ToastProvider>
        </QueryClientProvider>
      ),
    'es',
    <FollowRequestsPage />
  );

describe('/notifications/requests in Spanish', () => {
  beforeEach(() => {
    (global.fetch as jest.Mock).mockReset();
  });

  it('should title the inbox and name both answers', async () => {
    serve(respond(200, { requests: [ANA], total: 1 }));
    renderInSpanish();

    expect(screen.getByRole('heading', { name: 'Solicitudes de seguimiento' })).toBeInTheDocument();
    expect(await screen.findByRole('button', { name: 'Aceptar' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Rechazar' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Atrás' })).toBeInTheDocument();
  });

  it('should say the inbox is empty', async () => {
    serve(respond(200, { requests: [], total: 0 }));
    renderInSpanish();

    expect(await screen.findByText('No tenés solicitudes pendientes')).toBeInTheDocument();
  });

  it('should say a failed read failed, with "Reintentar"', async () => {
    serve(respond(500, {}));
    renderInSpanish();

    expect(await screen.findByText('No pudimos cargar tus solicitudes')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Reintentar' })).toBeInTheDocument();
  });

  it.each([
    ['Aceptar', 404, 'Esta solicitud ya no está'],
    ['Aceptar', 500, 'No pudimos aceptar la solicitud'],
    ['Rechazar', 500, 'No pudimos rechazar la solicitud'],
    ['Aceptar', null, 'Sin conexión — la solicitud sigue pendiente'],
  ])('%s answered %s should say "%s"', async (label, status, sentence) => {
    serve(respond(200, { requests: [ANA], total: 1 }), status);
    renderInSpanish();

    fireEvent.click(await screen.findByRole('button', { name: label }));

    expect(await screen.findByText(sentence)).toBeInTheDocument();
  });
});
