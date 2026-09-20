import { ThemeProvider, createTheme } from '@mui/material/styles';
import { render, screen } from '@testing-library/react';
import React from 'react';
import { renderWithLocale } from '@/i18n/testing';
import AboutPage from '../about/page';
import ErrorPage from '../error';
import NotFound from '../not-found';
import OfflinePage from '../offline/page';

/**
 * The shell screens a visitor can land on without ever opening a recipe: the error boundary,
 * the 404, the offline page and About. None of them had a test asserting their copy, so this
 * file is the only proof that they follow the locale - and that the keys they ask for exist,
 * since tsconfig.i18n.json typechecks it.
 *
 * app/global-error.tsx is deliberately absent: it replaces the root layout, so it renders
 * outside NextIntlClientProvider and keeps its English copy. See the comment in that file.
 */

jest.mock('@sentry/nextjs', () => ({ captureException: jest.fn() }));

const theme = createTheme();

const renderInSpanish = (ui: React.ReactElement) =>
  renderWithLocale(
    (element) => render(<ThemeProvider theme={theme}>{element}</ThemeProvider>),
    'es',
    ui
  );

describe('Error boundary in Spanish', () => {
  it('should render its copy and both actions in Spanish', () => {
    renderInSpanish(<ErrorPage error={new Error('boom')} reset={jest.fn()} />);

    expect(screen.getByText('¡Uy! Algo salió mal')).toBeInTheDocument();
    expect(
      screen.getByText(
        'Tuvimos un error inesperado. No te preocupes: ya nos avisaron y lo estamos solucionando.'
      )
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Probar de nuevo' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Ir al inicio' })).toBeInTheDocument();
  });
});

describe('Not found page in Spanish', () => {
  it('should render its copy and both actions in Spanish', () => {
    renderInSpanish(<NotFound />);

    expect(screen.getByText('Página no encontrada')).toBeInTheDocument();
    expect(
      screen.getByText('No encontramos la página que buscás. Puede que la hayan movido o borrado.')
    ).toBeInTheDocument();
    expect(
      screen.getByText('¿Te perdiste? Probá buscar recetas o mirá las recetas de la comunidad.')
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Ir al inicio' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Volver' })).toBeInTheDocument();
  });
});

describe('Offline page in Spanish', () => {
  it('should render its copy and the retry action in Spanish', () => {
    renderInSpanish(<OfflinePage />);

    expect(screen.getByText('Estás sin conexión')).toBeInTheDocument();
    expect(
      screen.getByText(
        'Parece que te quedaste sin internet. Algunas funciones no van a estar disponibles hasta que vuelvas a conectarte.'
      )
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Probar de nuevo' })).toBeInTheDocument();
  });
});

describe('About page in Spanish', () => {
  it('should render the headings around the brand name in Spanish', () => {
    renderInSpanish(<AboutPage />);

    expect(screen.getByText("Sobre Remy's")).toBeInTheDocument();
    expect(screen.getByText("¿Qué es Remy's?")).toBeInTheDocument();
    expect(screen.getByText('Funciones')).toBeInTheDocument();
    expect(screen.getByText('Quién la hizo')).toBeInTheDocument();
    expect(screen.getByText('Hecha con')).toBeInTheDocument();
    expect(screen.getByText('← Volver al inicio')).toBeInTheDocument();
  });

  it('should render every feature card in Spanish', () => {
    renderInSpanish(<AboutPage />);

    expect(screen.getByText('Compartí recetas')).toBeInTheDocument();
    expect(screen.getByText('Despensa inteligente')).toBeInTheDocument();
    expect(screen.getByText('Descubrí')).toBeInTheDocument();
    expect(screen.getByText('Guardá tus favoritas')).toBeInTheDocument();
    expect(screen.getByText('Conectate')).toBeInTheDocument();
    expect(screen.getByText('Compartí')).toBeInTheDocument();
  });

  it('should keep the brand name inside the translated prose', () => {
    renderInSpanish(<AboutPage />);

    expect(
      screen.getByText(/^Remy's es una red social de recetas inspirada en el amor por la cocina/)
    ).toBeInTheDocument();
    expect(screen.getByText(/Remy's nació como un proyecto hecho con cariño/)).toBeInTheDocument();
  });
});
