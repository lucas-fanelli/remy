import { fireEvent, render, screen } from '@testing-library/react';
import React from 'react';
import { getTestTranslator, renderWithLocale } from '@/i18n/testing';
import FollowButton from '../FollowButton';

/**
 * The follow button and the follow copy in Spanish. FollowButton.test.tsx covers the
 * behaviour in English; this covers the words — the three labels, the question before
 * unfollowing a private account, and the select arms the code picks by name, where a
 * misspelt arm would quietly fall through to `other` and say the wrong thing.
 */

const onAction = jest.fn();

describe('FollowButton in Spanish', () => {
  beforeEach(() => onAction.mockReset());

  it.each([
    ['none', 'Seguir'],
    ['requested', 'Solicitado'],
    ['following', 'Siguiendo'],
  ] as const)('%s reads "%s"', (state, label) => {
    renderWithLocale(
      render,
      'es',
      <FollowButton state={state} isPrivate={true} name="ana" onAction={onAction} />
    );

    expect(screen.getByRole('button', { name: label })).toBeInTheDocument();
  });

  it('asks before unfollowing a private account, in voseo', () => {
    renderWithLocale(
      render,
      'es',
      <FollowButton state="following" isPrivate={true} name="ana" onAction={onAction} />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Siguiendo' }));

    const dialog = screen.getByRole('dialog', { name: '¿Dejar de seguir a ana?' });
    expect(dialog).toHaveTextContent(
      'Es una cuenta privada: para volver a ver sus recetas vas a tener que enviarle otra solicitud.'
    );
    fireEvent.click(screen.getByRole('button', { name: 'Dejar de seguir' }));
    expect(onAction).toHaveBeenCalledWith('unfollow');
  });
});

describe('the follow copy picks its arm by the value the code passes', () => {
  const es = getTestTranslator('profile', 'es');
  const en = getTestTranslator('profile', 'en');

  it('says what happens next on a locked profile, requested or not', () => {
    expect(es('private.body', { state: 'requested' })).toBe(
      'Cuando acepte tu solicitud, vas a ver sus recetas.'
    );
    expect(es('private.body', { state: 'none' })).toBe('Seguí esta cuenta para ver sus recetas.');
    expect(en('private.body', { state: 'requested' })).toBe(
      "Once they accept your request, you'll see their recipes."
    );
    expect(en('private.body', { state: 'none' })).toBe('Follow this account to see their recipes.');
  });

  it.each([
    [
      'follow',
      'No pudimos seguir a esta persona',
      'Sin conexión — no empezaste a seguir a esta persona',
    ],
    ['request', 'No pudimos enviar la solicitud', 'Sin conexión — no enviamos la solicitud'],
    ['cancel', 'No pudimos cancelar la solicitud', 'Sin conexión — tu solicitud sigue pendiente'],
    [
      'unfollow',
      'No pudimos dejar de seguir a esta persona',
      'Sin conexión — seguís siguiendo a esta persona',
    ],
  ] as const)('tells a failed %s from a dropped connection', (action, failed, offline) => {
    expect(es('followFailed', { action })).toBe(failed);
    expect(es('followOffline', { action })).toBe(offline);
  });
});
