import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';
import { renderWithLocale } from '@/i18n/testing';
import EditProfileModal from '../EditProfileModal';

/**
 * The Spanish counterpart of EditProfileModal.test.tsx, which asserts the English copy and
 * was not touched. Between them the fields, the character counter and every validation
 * message are covered in both languages.
 */

const mockUpdateProfile = jest.fn();
const mockUseAuth = jest.fn();
jest.mock('@/contexts/AuthContext', () => ({
  useAuth: () => mockUseAuth(),
}));

const mockShowError = jest.fn();
const mockShowSuccess = jest.fn();
jest.mock('@/contexts/ToastContext', () => ({
  useToast: () => ({
    showSuccess: mockShowSuccess,
    showError: mockShowError,
    showToast: jest.fn(),
    showWarning: jest.fn(),
    showInfo: jest.fn(),
  }),
}));

const renderInSpanish = () =>
  renderWithLocale(
    render,
    'es',
    <EditProfileModal open={true} onClose={jest.fn()} onSuccess={jest.fn()} />
  );

describe('EditProfileModal in Spanish', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseAuth.mockReturnValue({
      user: {
        id: '1',
        username: 'tester',
        email: 'tester@test.com',
        fullName: 'Tester',
        bio: 'Hola',
        website: '',
        avatar: null,
        isPrivate: false,
      },
      isAuthenticated: true,
      updateProfile: mockUpdateProfile,
    });
  });

  it('should label every field in Spanish', () => {
    renderInSpanish();

    expect(screen.getByText('Editar perfil')).toBeInTheDocument();
    expect(screen.getByLabelText('Usuario')).toBeInTheDocument();
    expect(screen.getByLabelText('Tu email')).toBeInTheDocument();
    expect(screen.getByLabelText('Nombre completo')).toBeInTheDocument();
    expect(screen.getByLabelText('Biografía')).toBeInTheDocument();
    expect(screen.getByLabelText('Sitio web')).toBeInTheDocument();
    expect(screen.getByText('El usuario no se puede cambiar')).toBeInTheDocument();
    expect(screen.getByText('Cuenta privada')).toBeInTheDocument();
  });

  it('should count the bio characters in Spanish', () => {
    renderInSpanish();

    expect(screen.getByText('4/300 caracteres')).toBeInTheDocument();
  });

  it('should show its buttons and placeholders in Spanish', () => {
    renderInSpanish();

    expect(screen.getByRole('button', { name: 'Cambiar foto' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Cancelar' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Guardar cambios' })).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Contanos algo sobre vos...')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('https://tusitio.com')).toBeInTheDocument();
  });

  it('should reject a website without a scheme in Spanish', async () => {
    renderInSpanish();

    fireEvent.change(screen.getByLabelText('Sitio web'), { target: { value: 'ftp://nope.com' } });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }));

    expect(
      await screen.findByText('El sitio web tiene que empezar con http:// o https://')
    ).toBeInTheDocument();
    expect(mockUpdateProfile).not.toHaveBeenCalled();
  });

  it('should confirm the save in Spanish', async () => {
    mockUpdateProfile.mockResolvedValueOnce(undefined);
    renderInSpanish();

    fireEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }));

    await waitFor(() => {
      expect(mockShowSuccess).toHaveBeenCalledWith('¡Actualizamos tu perfil!');
    });
  });
});
