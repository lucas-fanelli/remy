import { ThemeProvider, createTheme } from '@mui/material/styles';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';
import '@testing-library/jest-dom';
import { Recipe } from '@/domain/types/recipe';
import { renderWithLocale } from '@/i18n/testing';
import CommentsSection from '../CommentsSection';
import DifficultyChip from '../display/DifficultyChip';
import IngredientLine from '../display/IngredientLine';
import RecipeTimeStrip from '../display/RecipeTimeStrip';
import MatchedRecipes from '../MatchedRecipes';
import RecipeCard from '../RecipeCard';

/**
 * The Spanish half of the recipe-reading area.
 *
 * RecipeCard.test.tsx, MatchedRecipes.test.tsx, CommentsSection.test.tsx and
 * displayBlocks.test.tsx assert the ENGLISH copy and were not touched by the migration;
 * this file proves the very same components speak Spanish when the locale says so.
 * Between them both sides of every migrated string are covered.
 */

jest.mock('framer-motion', () => {
  const mockMotion: any = (component: any) => component;
  mockMotion.create = (component: any) => component;
  mockMotion.div = ({
    children,
    initial,
    animate,
    exit,
    transition,
    whileHover,
    whileTap,
    ...props
  }: any) => <div {...props}>{children}</div>;

  return {
    motion: mockMotion,
    AnimatePresence: ({ children }: any) => <>{children}</>,
  };
});

const mockPush = jest.fn();
jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
}));

const mockUseAuth = jest.fn();
jest.mock('@/contexts/AuthContext', () => ({
  ...jest.requireActual('@/contexts/AuthContext'),
  useAuth: () => mockUseAuth(),
  AuthProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

const theme = createTheme();

const renderInSpanish = (ui: React.ReactElement) =>
  renderWithLocale(
    (element) => render(<ThemeProvider theme={theme}>{element}</ThemeProvider>),
    'es',
    ui
  );

const spanishRecipe: Recipe = {
  id: 'recipe-1',
  userId: 'user-1',
  title: 'Milanesas a la napolitana',
  description: 'El clásico de los domingos',
  imageUrl: 'https://example.com/milanesa.jpg',
  prepTime: 15,
  cookingTime: 30,
  servings: 4,
  difficulty: 'easy',
  ingredients: [{ name: 'pan rallado', amount: '200', unit: 'g' }],
  instructions: [{ step: 1, description: 'Empanar' }],
  createdAt: new Date(),
  updatedAt: new Date(),
};

describe('RecipeCard in Spanish', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should print the difficulty, the servings and the total time in Spanish', () => {
    renderInSpanish(<RecipeCard recipe={spanishRecipe} />);

    // The stored value stays 'easy'; only the label is translated
    expect(screen.getByText('fácil')).toBeInTheDocument();
    expect(screen.getByText('4 porciones')).toBeInTheDocument();
    expect(screen.getByText('45 min')).toBeInTheDocument();
  });

  it('should say in Spanish that nobody rated the recipe yet', () => {
    renderInSpanish(<RecipeCard recipe={spanishRecipe} />);

    expect(screen.getByText('Todavía no tiene puntuaciones')).toBeInTheDocument();
  });

  it('should label the like and comment actions in Spanish', () => {
    renderInSpanish(<RecipeCard recipe={spanishRecipe} showActions likeCount={2} />);

    expect(screen.getByRole('button', { name: 'Me gusta' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Comentarios' })).toBeInTheDocument();
  });

  it('should open the owner menu in Spanish', async () => {
    renderInSpanish(<RecipeCard recipe={spanishRecipe} showActions currentUserId="user-1" />);

    fireEvent.click(screen.getByRole('button', { name: 'opciones de la receta' }));

    await waitFor(() => {
      expect(screen.getByText('Editar receta')).toBeInTheDocument();
    });
    expect(screen.getByText('Eliminar receta')).toBeInTheDocument();
  });
});

describe('recipe display blocks in Spanish', () => {
  it('should caption the time strip in Spanish and keep the minute symbol', () => {
    renderInSpanish(<RecipeTimeStrip prepTime={15} cookingTime={30} />);

    expect(screen.getByText('PREPARACIÓN').parentElement).toHaveTextContent('15 min');
    expect(screen.getByText('COCCIÓN').parentElement).toHaveTextContent('30 min');
    expect(screen.getByText('TIEMPO TOTAL').parentElement).toHaveTextContent('45 min');
  });

  it('should print the Spanish label of a unit that stays stored in English', () => {
    renderInSpanish(
      <ul>
        <IngredientLine ingredient={{ name: 'harina', amount: '2', unit: 'cups' }} />
      </ul>
    );

    expect(screen.getByRole('listitem')).toHaveTextContent(/^2 tazas harina$/);
  });

  it('should keep a unit it does not know exactly as the row stores it', () => {
    renderInSpanish(
      <ul>
        <IngredientLine ingredient={{ name: 'cebolla', amount: '1', unit: 'whole' }} />
      </ul>
    );

    expect(screen.getByRole('listitem')).toHaveTextContent(/^1 whole cebolla$/);
  });

  it("should read '{name}, a gusto' for a to-taste row", () => {
    renderInSpanish(
      <ul>
        <IngredientLine ingredient={{ name: 'Sal', amount: '', unit: 'to taste' }} />
      </ul>
    );

    expect(screen.getByRole('listitem')).toHaveTextContent(/^Sal, a gusto$/);
  });

  it('should echo a difficulty it does not recognise instead of a missing key', () => {
    renderInSpanish(<DifficultyChip difficulty="Unknown" />);

    expect(screen.getByText('Unknown')).toBeInTheDocument();
  });
});

describe('MatchedRecipes in Spanish', () => {
  let mockFetch: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    mockFetch = global.fetch as jest.Mock;
    mockUseAuth.mockReturnValue({ token: null, isAuthenticated: true });
  });

  it('should invite the reader to fill an empty pantry, in Spanish', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ readyToCook: [], almostThere: [], pantryItemsCount: 0 }),
    });

    renderInSpanish(<MatchedRecipes />);

    expect(await screen.findByText('Tu despensa está vacía')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Ir a mi despensa' })).toBeInTheDocument();
  });

  it('should name the two tabs with the glossary wording', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        readyToCook: [
          {
            id: '1',
            title: 'Ñoquis',
            description: 'Del 29',
            imageUrl: 'https://example.com/noquis.jpg',
            difficulty: 'easy',
            matchPercentage: 100,
            matchedIngredients: 4,
            totalIngredients: 4,
            missingIngredients: [],
          },
        ],
        almostThere: [],
        pantryItemsCount: 10,
      }),
    });

    renderInSpanish(<MatchedRecipes />);

    expect(await screen.findByRole('tab', { name: 'Listas para cocinar (1)' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Casi listas (0)' })).toBeInTheDocument();
    expect(screen.getByText('100% coincide')).toBeInTheDocument();
  });

  it('should keep the pantry count inside one Spanish sentence', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ readyToCook: [], almostThere: [], pantryItemsCount: 10 }),
    });

    renderInSpanish(<MatchedRecipes />);

    expect(await screen.findByText('Recetas con lo que tenés en la despensa')).toBeInTheDocument();
    expect(screen.getByText('10 ingredientes')).toBeInTheDocument();
  });

  it('should report a failed load in Spanish', async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, json: async () => ({}) });

    renderInSpanish(<MatchedRecipes />);

    expect(
      await screen.findByText('No pudimos cargar tus coincidencias. Probá de nuevo.')
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Reintentar' })).toBeInTheDocument();
  });
});

describe('CommentsSection in Spanish', () => {
  let mockFetch: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    mockFetch = global.fetch as jest.Mock;
    mockFetch.mockResolvedValue({ ok: true, json: async () => ({ comments: [] }) });
  });

  it('should ask a signed-out reader to log in, with voseo', async () => {
    mockUseAuth.mockReturnValue({ token: null, user: null });

    renderInSpanish(<CommentsSection recipeId="recipe1" />);

    expect(await screen.findByText('Comentarios (0)')).toBeInTheDocument();
    expect(screen.getByText('Iniciá sesión para dejar un comentario')).toBeInTheDocument();
  });

  it('should render the comment form and the empty state in Spanish', async () => {
    mockUseAuth.mockReturnValue({
      token: null,
      user: { id: 'user1', username: 'tester', email: 'tester@test.com' },
    });

    renderInSpanish(<CommentsSection recipeId="recipe1" />);

    expect(
      await screen.findByPlaceholderText('Contá qué te pareció esta receta...')
    ).toBeInTheDocument();
    expect(screen.getByText('Puntuá esta receta:')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Publicar' })).toBeInTheDocument();
    expect(screen.getByText('Todavía no hay comentarios')).toBeInTheDocument();
  });
});
