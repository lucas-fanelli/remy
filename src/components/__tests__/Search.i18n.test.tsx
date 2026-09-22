import { ThemeProvider, createTheme } from '@mui/material/styles';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';
import '@testing-library/jest-dom';
import { renderWithLocale } from '@/i18n/testing';
import PersistentSearchBar from '../search/PersistentSearchBar';
import SearchResults from '../SearchResults';

/**
 * The Spanish half of the search surfaces. SearchResults.test.tsx and
 * PersistentSearchBar.test.tsx keep asserting the English copy, untouched.
 */

jest.mock('framer-motion', () => {
  const mockMotion: any = (component: any) => component;
  mockMotion.create = (component: any) => component;
  mockMotion.div = ({ children, initial, animate, exit, transition, variants, ...props }: any) => (
    <div {...props}>{children}</div>
  );

  return {
    motion: mockMotion,
    AnimatePresence: ({ children }: any) => <>{children}</>,
  };
});

const mockPush = jest.fn();
jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
  usePathname: () => '/',
}));

jest.mock('@/contexts/MotionContext', () => ({
  useMotionContext: () => ({ setSource: jest.fn(), clearSource: jest.fn() }),
}));

const theme = createTheme();

const renderInSpanish = (ui: React.ReactElement) =>
  renderWithLocale(
    (element) => render(<ThemeProvider theme={theme}>{element}</ThemeProvider>),
    'es',
    ui
  );

describe('SearchResults in Spanish', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should offer the "see everything" row in Spanish', () => {
    renderInSpanish(
      <SearchResults
        query="pasta"
        users={[{ id: '1', username: 'chef_ana' }]}
        recipes={[]}
        loading={false}
        onClose={jest.fn()}
      />
    );

    expect(screen.getByText('Buscar "pasta"')).toBeInTheDocument();
    expect(screen.getByText('Ver todos los resultados')).toBeInTheDocument();
  });

  it('should say in Spanish that nothing matched', () => {
    renderInSpanish(
      <SearchResults query="pasta" users={[]} recipes={[]} loading={false} onClose={jest.fn()} />
    );

    expect(screen.getByText('No encontramos resultados para “pasta”')).toBeInTheDocument();
  });
});

describe('PersistentSearchBar in Spanish', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should fall back to its own Spanish placeholder', () => {
    renderInSpanish(<PersistentSearchBar />);

    expect(screen.getByPlaceholderText('Buscá recetas, ingredientes...')).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'Buscar recetas' })).toBeInTheDocument();
  });

  it('should hint in Spanish while the box is still empty', () => {
    renderInSpanish(<PersistentSearchBar />);

    fireEvent.focus(screen.getByRole('textbox'));

    expect(screen.getByText('Escribí para buscar recetas...')).toBeInTheDocument();
  });

  it('should name the clear button and the suggestion row in Spanish', async () => {
    renderInSpanish(<PersistentSearchBar />);

    const input = screen.getByRole('textbox');
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: 'ñoquis' } });

    expect(screen.getByRole('button', { name: 'Borrar la búsqueda' })).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByText('Buscar "ñoquis"')).toBeInTheDocument();
    });
  });
});
