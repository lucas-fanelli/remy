import { render, screen } from '@testing-library/react';
import React from 'react';
import { renderWithLocale } from '@/i18n/testing';
import { apiErrorCodeOf, translateApiError, useApiErrorMessage } from '../translateApiError';

describe('apiErrorCodeOf', () => {
  it('should read a code this build knows about', () => {
    expect(apiErrorCodeOf({ error: 'Nope', code: 'unauthorized' })).toBe('unauthorized');
  });

  it('should ignore a code from a newer server this build does not know', () => {
    expect(apiErrorCodeOf({ error: 'Nope', code: 'somethingBrandNew' })).toBeNull();
  });

  it('should return null when the body carries no code at all', () => {
    expect(apiErrorCodeOf({ error: 'Nope' })).toBeNull();
  });

  it('should return null for a body that is not an object', () => {
    expect(apiErrorCodeOf('<html>502</html>')).toBeNull();
  });
});

describe('translateApiError', () => {
  const t = (key: string) => `translated:${key}`;

  it('should translate the message when the server sent a known code', () => {
    const message = translateApiError(t, { error: 'Unauthorized', code: 'unauthorized' }, 'fb');

    expect(message).toBe('translated:unauthorized');
  });

  it("should fall back to the server's own text when there is no code", () => {
    const message = translateApiError(t, { error: 'Username already taken' }, 'fb');

    expect(message).toBe('Username already taken');
  });

  it('should use the fallback when the body has neither a code nor a usable string', () => {
    const message = translateApiError(t, { error: '   ' }, 'Something went wrong');

    expect(message).toBe('Something went wrong');
  });

  it('should use the fallback when there is no body at all', () => {
    const message = translateApiError(t, null, 'Something went wrong');

    expect(message).toBe('Something went wrong');
  });
});

function ErrorMessage({ body, fallback }: { body: unknown; fallback?: string }) {
  const apiErrorMessage = useApiErrorMessage();
  return <span>{apiErrorMessage(body, fallback)}</span>;
}

describe('useApiErrorMessage', () => {
  it('should show the English message for a known code', () => {
    render(<ErrorMessage body={{ error: 'Unauthorized', code: 'unauthorized' }} />);

    expect(screen.getByText('You need to log in to do that.')).toBeInTheDocument();
  });

  it('should show the Spanish message for the same code', () => {
    renderWithLocale(
      render,
      'es',
      <ErrorMessage body={{ error: 'Unauthorized', code: 'unauthorized' }} />
    );

    expect(screen.getByText('Tenés que iniciar sesión para hacer eso.')).toBeInTheDocument();
  });

  it('should show the untranslated server sentence for a route that sends no code', () => {
    renderWithLocale(render, 'es', <ErrorMessage body={{ error: 'Username already taken' }} />);

    expect(screen.getByText('Username already taken')).toBeInTheDocument();
  });

  it('should fall back to the generic message when nothing usable arrived', () => {
    renderWithLocale(render, 'es', <ErrorMessage body={null} />);

    expect(screen.getByText('Algo salió mal. Probá de nuevo.')).toBeInTheDocument();
  });

  it('should prefer the caller-supplied fallback over the generic one', () => {
    render(<ErrorMessage body={null} fallback="Could not save the recipe" />);

    expect(screen.getByText('Could not save the recipe')).toBeInTheDocument();
  });
});
