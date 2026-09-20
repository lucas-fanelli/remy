import { ThemeProvider, createTheme } from '@mui/material/styles';
import { render, screen } from '@testing-library/react';
import React from 'react';
import { usePwa } from '@/contexts/PwaContext';
import { renderWithLocale } from '@/i18n/testing';
import InstallPrompt from '../InstallPrompt';

/**
 * The counterpart of InstallPrompt.test.tsx: that file asserts the ENGLISH copy and was not
 * touched by the migration, this one proves the same drawer speaks Spanish when the locale
 * says so - including the two iOS steps, which are t.rich messages and would silently lose
 * their <strong> if the tags ever stopped matching.
 */

jest.mock('@/contexts/PwaContext', () => ({ usePwa: jest.fn() }));

const mockUsePwa = usePwa as jest.MockedFunction<typeof usePwa>;

const theme = createTheme();

const showPrompt = (isIOSSafari: boolean) => {
  mockUsePwa.mockReturnValue({
    canInstall: true,
    isInstalled: false,
    isRunningStandalone: false,
    isIOSSafari,
    isDesktopChrome: !isIOSSafari,
    showInstallPrompt: true,
    promptAvailable: !isIOSSafari,
    triggerInstall: jest.fn(),
    dismissInstallPrompt: jest.fn(),
    openApp: jest.fn(),
    resetDismissal: jest.fn(),
  });
};

const renderInSpanish = (ui: React.ReactElement) =>
  renderWithLocale(
    (element) => render(<ThemeProvider theme={theme}>{element}</ThemeProvider>),
    'es',
    ui
  );

describe('InstallPrompt in Spanish', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should render the install drawer in Spanish', () => {
    showPrompt(false);

    renderInSpanish(<InstallPrompt />);

    expect(screen.getByText('Llevate la experiencia completa')).toBeInTheDocument();
    expect(
      screen.getByText(
        "Instalá Remy's en tu pantalla de inicio para que ande más rápido, como una app nativa."
      )
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Instalar la app' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Ahora no' })).toBeInTheDocument();
    expect(screen.getByLabelText('Cerrar el aviso de instalación')).toBeInTheDocument();
  });

  it('should render the iOS steps in Spanish and keep their emphasis', () => {
    showPrompt(true);

    renderInSpanish(<InstallPrompt />);

    expect(screen.getByText('Para instalarla en tu dispositivo:')).toBeInTheDocument();
    // The emphasised part is a t.rich chunk: it has to be its own <strong>, not plain text
    expect(screen.getByText('Compartir').tagName).toBe('STRONG');
    expect(screen.getByText('"Agregar a la pantalla de inicio"').tagName).toBe('STRONG');
    expect(screen.getByRole('button', { name: 'Entendido' })).toBeInTheDocument();
  });
});
