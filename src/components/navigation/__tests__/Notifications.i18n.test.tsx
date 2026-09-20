import { render, screen } from '@testing-library/react';
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
