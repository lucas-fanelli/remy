import { ThemeProvider, createTheme } from '@mui/material/styles';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { useFormatter, useTranslations } from 'next-intl';
import React from 'react';
import '@testing-library/jest-dom';
import { ToastProvider } from '@/contexts/ToastContext';
import { Recipe } from '@/domain/types/recipe';
import { RecipeFetchError } from '@/hooks/useRecipe';
import { renderWithLocale } from '@/i18n/testing';
import { text, useTextDescriptor } from '@/i18n/text';
import CommentsSection from '../CommentsSection';
import CookConfirmDialog from '../CookConfirmDialog';
import DifficultyChip from '../display/DifficultyChip';
import IngredientLine from '../display/IngredientLine';
import RecipeTimeStrip from '../display/RecipeTimeStrip';
import MatchedRecipes from '../MatchedRecipes';
import RecipeCard from '../RecipeCard';
import type { IngredientPlan } from '@/lib/cooking/pantryPlan';

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

/**
 * The pantry matches and the feed read through React Query now, and their hearts go through
 * the shared mutation layer, which reports through the toast. A fresh client per render so
 * one test's cache does not answer the next test's query.
 */
const renderInSpanish = (ui: React.ReactElement) =>
  renderWithLocale(
    (element) =>
      render(
        <QueryClientProvider
          client={
            new QueryClient({
              defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
            })
          }
        >
          <ThemeProvider theme={theme}>
            <ToastProvider>{element}</ToastProvider>
          </ThemeProvider>
        </QueryClientProvider>
      ),
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

/** Stands in for the recipe page, which is the only thing that renders these descriptors */
function LoadFailure({ error }: { error: RecipeFetchError }) {
  const renderText = useTextDescriptor();
  return <p>{renderText(error.descriptor)}</p>;
}

describe("useRecipe's failures", () => {
  it('should say in Spanish that the recipe is not there', () => {
    const error = new RecipeFetchError(text('recipe.states.notFound'), 'Recipe not found');

    renderInSpanish(<LoadFailure error={error} />);

    expect(screen.getByText('No encontramos la receta')).toBeInTheDocument();
    // The English sentence stays on the Error itself, for logs
    expect(error.message).toBe('Recipe not found');
  });

  it('should say in Spanish that the recipe could not be loaded', () => {
    const error = new RecipeFetchError(text('recipe.states.loadFailed'), 'Failed to load recipe');

    renderInSpanish(<LoadFailure error={error} />);

    expect(screen.getByText('No pudimos cargar la receta')).toBeInTheDocument();
    expect(error.message).toBe('Failed to load recipe');
  });
});

describe('the cook confirmation dialog in Spanish', () => {
  const line = (over: Partial<IngredientPlan> = {}): IngredientPlan => ({
    name: 'harina',
    unit: 'cups',
    required: 2,
    available: 1,
    status: 'short',
    pantryItemId: 'p1',
    pantryUnit: 'cups',
    pantryQuantity: 1,
    deduct: 1,
    emptiesPantryItem: true,
    ...over,
  });

  const show = (ingredients: IngredientPlan[]) =>
    renderInSpanish(
      <CookConfirmDialog
        open
        plan={{ ingredients, canCookNow: false }}
        busy={false}
        onCancel={jest.fn()}
        onConfirm={jest.fn()}
      />
    );

  it('should label each amount with its own plural', () => {
    show([line()]);

    expect(screen.getByText('necesita 2 tazas, tenés 1 taza')).toBeInTheDocument();
  });

  it('should keep the plural for an empty pantry shelf', () => {
    show([line({ name: 'huevos', unit: 'units', required: 1, available: 0, pantryQuantity: 0 })]);

    expect(screen.getByText('necesita 1 unidad, tenés 0 unidades')).toBeInTheDocument();
  });

  it('should name an ingredient the pantry does not have at all', () => {
    // The dialog this replaces could not mention these: an ingredient with no pantry row
    // was skipped without a word, and the recipe was marked cooked anyway.
    show([
      line({
        name: 'tomate',
        unit: 'pieces',
        required: 4,
        available: 0,
        status: 'missing',
        pantryItemId: null,
        pantryUnit: null,
        pantryQuantity: null,
        deduct: 0,
        emptiesPantryItem: false,
      }),
    ]);

    expect(screen.getByText('Esto no lo tenés:')).toBeInTheDocument();
    // 'pieces' is not one of the app's units (that list uses 'units'), so it prints as the
    // recipe stored it rather than as a missing-key path — the same fallback the unit
    // labels use everywhere else.
    expect(screen.getByText('necesita 4 pieces')).toBeInTheDocument();
  });

  it('should explain a unit it cannot measure against, naming what you do have', () => {
    show([
      line({
        name: 'pimienta',
        unit: 'tsp',
        required: 0.5,
        available: null,
        status: 'missing',
        pantryUnit: 'g',
        pantryQuantity: 50,
        deduct: 0,
        emptiesPantryItem: false,
      }),
    ]);

    expect(
      screen.getByText('necesita 0.5 cdta, y tus 50 g no se pueden comparar con eso')
    ).toBeInTheDocument();
  });
});

describe('RecipeCard in Spanish', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should print the difficulty, the servings and the total time in Spanish', () => {
    renderInSpanish(<RecipeCard recipe={spanishRecipe} viewer={null} />);

    // The stored value stays 'easy'; only the label is translated
    expect(screen.getByText('fácil')).toBeInTheDocument();
    expect(screen.getByText('4 porciones')).toBeInTheDocument();
    expect(screen.getByText('45 min')).toBeInTheDocument();
  });

  it('should say in Spanish that nobody rated the recipe yet', () => {
    // Explicitly zero. An ABSENT `totalRatings` now means the surface does not know, and
    // the card says nothing rather than asserting that nobody has rated it — which is the
    // difference between the feed, whose API answers, and a pantry match, whose does not.
    renderInSpanish(<RecipeCard recipe={{ ...spanishRecipe, totalRatings: 0 }} viewer={null} />);

    expect(screen.getByText('Todavía no tiene puntuaciones')).toBeInTheDocument();
  });

  it('should stay quiet about ratings the surface never reported', () => {
    renderInSpanish(
      <RecipeCard recipe={{ ...spanishRecipe, totalRatings: undefined }} viewer={null} />
    );

    expect(screen.queryByText('Todavía no tiene puntuaciones')).not.toBeInTheDocument();
  });

  it('should label the like and comment actions in Spanish', () => {
    renderInSpanish(
      <RecipeCard
        recipe={{ ...spanishRecipe, likeCount: 2 }}
        viewer={null}
        onLike={jest.fn()}
        onComment={jest.fn()}
      />
    );

    expect(screen.getByRole('button', { name: 'Me gusta' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Comentarios' })).toBeInTheDocument();
  });

  it('should open the owner menu in Spanish', async () => {
    renderInSpanish(
      <RecipeCard
        recipe={spanishRecipe}
        viewer={null}
        currentUserId="user-1"
        onEdit={jest.fn()}
        onDelete={jest.fn()}
      />
    );

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
    expect(screen.getByText('TOTAL').parentElement).toHaveTextContent('45 min');
  });

  it('should print the Spanish label of a unit that stays stored in English', () => {
    renderInSpanish(
      <ul>
        <IngredientLine ingredient={{ name: 'harina', amount: '2', unit: 'cups' }} />
      </ul>
    );

    expect(screen.getByRole('listitem')).toHaveTextContent(/^2 tazas harina$/);
  });

  it('should print the plural for an amount of zero, not the singular', () => {
    renderInSpanish(
      <ul>
        <IngredientLine ingredient={{ name: 'azúcar', amount: '0', unit: 'cups' }} />
      </ul>
    );

    expect(screen.getByRole('listitem')).toHaveTextContent(/^0 tazas azúcar$/);
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
    expect(screen.getByText('100% de coincidencia')).toBeInTheDocument();
  });

  /** The Casi listas tab is the 1-to-3-missing bucket, so both plural cases are common */
  const almostThereWith = (missingIngredients: string[]) => ({
    ok: true,
    json: async () => ({
      readyToCook: [],
      almostThere: [
        {
          id: '2',
          title: 'Salsa criolla',
          description: 'Para la carne',
          imageUrl: 'https://example.com/salsa.jpg',
          difficulty: 'easy',
          matchPercentage: 60,
          matchedIngredients: 3,
          totalIngredients: 3 + missingIngredients.length,
          missingIngredients,
        },
      ],
      pantryItemsCount: 8,
    }),
  });

  it('should agree the verb with a list of missing ingredients', async () => {
    mockFetch.mockResolvedValueOnce(almostThereWith(['cebolla', 'ajo']));

    renderInSpanish(<MatchedRecipes />);

    fireEvent.click(await screen.findByRole('tab', { name: 'Casi listas (1)' }));

    expect(await screen.findByText('Te faltan: cebolla, ajo')).toBeInTheDocument();
  });

  it('should keep the singular verb when a single ingredient is missing', async () => {
    mockFetch.mockResolvedValueOnce(almostThereWith(['cebolla']));

    renderInSpanish(<MatchedRecipes />);

    fireEvent.click(await screen.findByRole('tab', { name: 'Casi listas (1)' }));

    expect(await screen.findByText('Te falta: cebolla')).toBeInTheDocument();
  });

  it('should invite the reader to fill the pantry when nothing is close, in Spanish', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ readyToCook: [], almostThere: [], pantryItemsCount: 3 }),
    });

    renderInSpanish(<MatchedRecipes />);

    fireEvent.click(await screen.findByRole('tab', { name: 'Casi listas (0)' }));

    expect(
      await screen.findByText(
        'Todavía no hay recetas que se acerquen a lo que tenés. Agregá más ingredientes a tu despensa.'
      )
    ).toBeInTheDocument();
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
    // No star prompt here any more — scoring moved out of the comment form.
    expect(screen.queryByText('Puntuá esta receta:')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Publicar' })).toBeInTheDocument();
    expect(screen.getByText('Todavía no hay comentarios')).toBeInTheDocument();
  });
});
