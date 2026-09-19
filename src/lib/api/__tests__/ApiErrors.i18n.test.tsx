import { render, screen } from '@testing-library/react';
import { useTranslations } from 'next-intl';
import React from 'react';
import { renderWithLocale } from '@/i18n/testing';
import { API_ERROR_CODES } from '../errorCodes';
import { useApiErrorMessage } from '../translateApiError';

/**
 * Area F has no screen of its own: what it ships is the `code` next to the unchanged English
 * `error`, and the client turns that into a sentence. So the Spanish side of this area is
 * tested where it becomes visible - a component reading a response body the routes really
 * answer with, rendered in Spanish.
 *
 * The bodies below are copied from the route that produces them; the comment says which.
 * errorCodes.test.ts is the other half: it reads the routes and proves the codes they send
 * are the ones this catalogue carries.
 */

function ApiError({ body }: { body: unknown }) {
  const apiErrorMessage = useApiErrorMessage();
  return <p>{apiErrorMessage(body)}</p>;
}

const renderInSpanish = (ui: React.ReactElement) => renderWithLocale(render, 'es', ui);

describe('an API error in Spanish', () => {
  it('should translate a 404 from GET /api/recipes/[id]', () => {
    renderInSpanish(<ApiError body={{ error: 'Recipe not found', code: 'recipe.notFound' }} />);

    expect(screen.getByText('No encontramos esa receta.')).toBeInTheDocument();
  });

  it('should translate the 401 from a route that only says "Unauthorized"', () => {
    renderInSpanish(<ApiError body={{ error: 'Unauthorized', code: 'unauthorized' }} />);

    expect(screen.getByText('Tenés que iniciar sesión para hacer eso.')).toBeInTheDocument();
  });

  it('should translate the upload limit without repeating the English "5MB" sentence', () => {
    renderInSpanish(
      <ApiError
        body={{ error: 'File size too large. Maximum size is 5MB.', code: 'upload.tooLarge' }}
      />
    );

    expect(
      screen.getByText('El archivo es demasiado grande. El máximo es 5MB.')
    ).toBeInTheDocument();
  });

  it('should translate the pantry duplicate from POST /api/pantry', () => {
    renderInSpanish(
      <ApiError
        body={{
          error: 'An item with this name already exists in your pantry',
          code: 'pantry.duplicateItem',
        }}
      />
    );

    expect(screen.getByText('Ese ingrediente ya está en tu despensa.')).toBeInTheDocument();
  });

  it('should keep the reset link answer generic in Spanish too', () => {
    renderInSpanish(
      <ApiError
        body={{
          success: false,
          error: 'This reset link is invalid or has expired',
          code: 'auth.invalidResetToken',
        }}
      />
    );

    expect(
      screen.getByText('Este enlace para restablecer la contraseña no es válido o expiró')
    ).toBeInTheDocument();
  });

  it('should fall back to the English the server sent when the branch carries no code', () => {
    // The zod branch of POST /api/auth/register: per-field messages, deliberately uncoded
    renderInSpanish(<ApiError body={{ error: 'Username must be at least 3 characters' }} />);

    expect(screen.getByText('Username must be at least 3 characters')).toBeInTheDocument();
  });

  it('should have a Spanish sentence for every code a route can send', () => {
    const unresolved = API_ERROR_CODES.filter((code) => {
      const { container, unmount } = renderInSpanish(<ApiError body={{ code }} />);
      const text = container.textContent ?? '';
      unmount();
      // use-intl answers a missing key with the key path itself
      return text === code || text.trim() === '';
    });

    expect(unresolved).toEqual([]);
  });
});

function ValidationMessage({ id }: { id: 'username.tooShort' | 'website.protocol' }) {
  const t = useTranslations('validation');
  return <p>{t(id)}</p>;
}

describe('the server validation messages in Spanish', () => {
  it('should translate the username rule zod answers with', () => {
    renderInSpanish(<ValidationMessage id="username.tooShort" />);

    expect(
      screen.getByText('El nombre de usuario tiene que tener al menos 3 caracteres')
    ).toBeInTheDocument();
  });

  it('should translate the website rule zod answers with', () => {
    renderInSpanish(<ValidationMessage id="website.protocol" />);

    expect(
      screen.getByText('El sitio tiene que empezar con http:// o https://')
    ).toBeInTheDocument();
  });

  it('should keep the English the server sends byte for byte', () => {
    render(<ValidationMessage id="username.tooShort" />);

    expect(screen.getByText('Username must be at least 3 characters')).toBeInTheDocument();
  });
});
