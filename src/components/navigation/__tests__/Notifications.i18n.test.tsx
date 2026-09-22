import { render, screen, within } from '@testing-library/react';
import React from 'react';
import { renderWithLocale } from '@/i18n/testing';
import NotificationDropdown from '../NotificationDropdown';

/**
 * Navigation.test.tsx asserts the four English notification sentences and was not touched.
 * This file proves the same `select` produces Spanish - including the one sentence whose
 * word order changes ("A Ana le gustó tu receta") - and that the relative time follows.
 */

const sender = (username: string, fullName: string | null) => ({
  id: `sender-${username}`,
  username,
  fullName,
  avatar: null,
});

const notifications = [
  {
    id: 'n1',
    type: 'follow' as const,
    isRead: false,
    createdAt: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
    sender: sender('bruno', 'Bruno'),
  },
  {
    id: 'n2',
    type: 'like' as const,
    isRead: true,
    createdAt: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
    sender: sender('ana', 'Ana'),
  },
  {
    id: 'n3',
    type: 'comment' as const,
    isRead: true,
    createdAt: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
    sender: sender('clara', null),
  },
  {
    id: 'n4',
    type: 'rating' as const,
    isRead: true,
    createdAt: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
    sender: sender('dario', 'Darío'),
  },
];

const renderDropdown = (props: Partial<React.ComponentProps<typeof NotificationDropdown>> = {}) =>
  renderWithLocale(
    render,
    'es',
    <NotificationDropdown
      anchorEl={document.createElement('div')}
      onClose={jest.fn()}
      notifications={notifications}
      unreadCount={1}
      pendingRequestsCount={0}
      markAllAsRead={jest.fn()}
      markingAsRead={false}
      mounted={true}
      onNotificationClick={jest.fn()}
      {...props}
    />
  );

describe('NotificationDropdown in Spanish', () => {
  it('should build each sentence in its natural Spanish order', () => {
    renderDropdown();

    expect(screen.getByText('Bruno empezó a seguirte')).toBeInTheDocument();
    expect(screen.getByText('A Ana le gustó tu receta')).toBeInTheDocument();
    expect(screen.getByText('clara comentó tu receta')).toBeInTheDocument();
    expect(screen.getByText('Darío puntuó tu receta')).toBeInTheDocument();
  });

  it('should fall back to the generic sentence for a type it does not know', () => {
    renderDropdown({
      notifications: [{ ...notifications[0], type: 'mention' as never }],
    });

    expect(screen.getByText('Tenés una notificación nueva')).toBeInTheDocument();
  });

  it('should render its header and the mark-all action in Spanish', () => {
    renderDropdown();

    expect(screen.getByText('Notificaciones')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Marcar todas' })).toBeInTheDocument();
  });

  it('should say "Marcando..." while the request is in flight', () => {
    renderDropdown({ markingAsRead: true });

    expect(screen.getByRole('button', { name: 'Marcando...' })).toBeInTheDocument();
  });

  it('should render the relative times with the Spanish date-fns locale', () => {
    renderDropdown();

    expect(screen.getAllByText('hace 5 minutos').length).toBe(notifications.length);
  });

  it('should show the empty state in Spanish', () => {
    renderDropdown({ notifications: [], unreadCount: 0 });

    expect(screen.getByText('Todavía no tenés notificaciones')).toBeInTheDocument();
    expect(
      screen.getByText('Cuando alguien te siga o interactúe con tus recetas, lo vas a ver acá')
    ).toBeInTheDocument();
  });
});

describe('NotificationDropdown — follow requests, in Spanish', () => {
  const requested = {
    id: 'n5',
    type: 'follow_request' as const,
    isRead: false,
    createdAt: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
    sender: sender('ana', 'Ana'),
  };
  const accepted = { ...requested, id: 'n6', type: 'follow_accepted' as const };

  it('should say who wants to follow you, and who accepted', () => {
    renderDropdown({ notifications: [requested, accepted] });

    expect(screen.getByText('Ana quiere seguirte')).toBeInTheDocument();
    expect(screen.getByText('Ana aceptó tu solicitud')).toBeInTheDocument();
  });

  it('should read an accepted request as a follow, the way the server converts it', () => {
    renderDropdown({ notifications: [{ ...requested, type: 'follow' as const }] });

    expect(screen.getByText('Ana empezó a seguirte')).toBeInTheDocument();
  });

  it.each([
    [1, '1 solicitud pendiente'],
    [3, '3 solicitudes pendientes'],
  ])('should pin %i pending request(s) as "%s"', (count, sentence) => {
    renderDropdown({ pendingRequestsCount: count });

    expect(screen.getByText('Solicitudes de seguimiento')).toBeInTheDocument();
    expect(screen.getByText(sentence)).toBeInTheDocument();
  });

  it('should pin nothing when no one is waiting', () => {
    renderDropdown({ pendingRequestsCount: 0 });

    expect(screen.queryByText('Solicitudes de seguimiento')).not.toBeInTheDocument();
  });

  it('should keep the pinned row, and drop "todavía no tenés notificaciones", with no rows', () => {
    renderDropdown({ notifications: [], unreadCount: 0, pendingRequestsCount: 2 });

    expect(screen.getByText('2 solicitudes pendientes')).toBeInTheDocument();
    expect(screen.queryByText('Todavía no tenés notificaciones')).not.toBeInTheDocument();
  });

  it('should put no "Aceptar" or "Rechazar" inside a "quiere seguirte" row', () => {
    renderDropdown({ notifications: [requested] });

    // Each row is itself a button; one inside it would be a button nested in a button.
    const row = screen.getByText('Ana quiere seguirte').closest('[role="button"]');
    expect(row).not.toBeNull();
    expect(within(row as HTMLElement).queryByRole('button')).not.toBeInTheDocument();
    expect(screen.queryByText('Aceptar')).not.toBeInTheDocument();
    expect(screen.queryByText('Rechazar')).not.toBeInTheDocument();
  });
});
