import { ThemeProvider, createTheme } from '@mui/material/styles';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import '@testing-library/jest-dom';
// Filters React's false 'suspended inside act' report for focus moved inside an effect
import './editorHarness';
import { Recipe } from '@/domain/types/recipe';
import RecipeTextFirstDialog, {
  DRAFT_SAVED_TOAST,
  RecipeTextFirstDialogProps,
  tabForPath,
} from '../RecipeTextFirstDialog';
import { RECIPE_DRAFT_DEBOUNCE_MS, toDraftValues } from '../useRecipeDraft';
import { COVER_URL, STEP_URL, makeRecipe, makeValues } from './fixtures';

// Boundaries only: the session, the toasts, the router and the network
const mockPush = jest.fn();
const mockShowSuccess = jest.fn();
const mockShowInfo = jest.fn();
const mockLogout = jest.fn();
let mockUser: { id: string; username: string } | null = { id: 'user-1', username: 'ana' };

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
}));
jest.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({ user: mockUser, logout: mockLogout }),
}));
jest.mock('@/contexts/ToastContext', () => ({
  useToast: () => ({ showSuccess: mockShowSuccess, showInfo: mockShowInfo }),
}));
// The 400ms double-click guard of PublishButton has its own suite
jest.mock('@/components/recipe/form/formMotion', () => ({
  ...jest.requireActual('@/components/recipe/form/formMotion'),
  PUBLISH_GUARD_MS: 0,
}));

// Whole-dialog journeys on the real engine and the real MUI widgets are slow in jsdom
jest.setTimeout(30_000);

const USER_KEY = 'remy:recipe-draft:v1:user-1';
const AUTHOR = { id: 'user-1', username: 'ana' };
const SOMEBODY_ELSE = { id: 'user-2', username: 'beto' };
const theme = createTheme();

const createStorage = (initial: Record<string, string> = {}) => {
  const data = new Map(Object.entries(initial));
  return {
    data,
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => {
      data.set(key, value);
    },
    removeItem: (key: string) => {
      data.delete(key);
    },
  };
};

const storedDraft = (overrides: Record<string, unknown> = {}) =>
  JSON.stringify({
    v: 1,
    savedAt: Date.now() - 10 * 60_000,
    section: 'check',
    values: toDraftValues(makeValues()),
    text: {
      ingredients: '500 g Chocolinas\n400 g Dulce de leche',
      method: 'Mix the filling\n\nBuild the layers',
    },
    ...overrides,
  });

type Props = Partial<RecipeTextFirstDialogProps>;

function renderDialog(props: Props = {}) {
  const onClose = jest.fn();
  const onSuccess = jest.fn();
  const storage = props.draftStorage ?? createStorage();
  const ui = (extra: Props = {}) => (
    <ThemeProvider theme={theme}>
      <RecipeTextFirstDialog
        mode="create"
        open
        onClose={onClose}
        onSuccess={onSuccess}
        draftStorage={storage}
        {...props}
        {...extra}
      />
    </ThemeProvider>
  );
  const view = render(ui());
  return {
    onClose,
    onSuccess,
    storage: storage as ReturnType<typeof createStorage>,
    user: userEvent.setup(),
    rerender: (extra: Props) => view.rerender(ui(extra)),
  };
}

const okResponse = (body: unknown) => ({ ok: true, status: 200, json: async () => body });
const errorResponse = (status: number, body: unknown) => ({
  ok: false,
  status,
  headers: { get: () => null },
  json: async () => body,
});

let mockFetch: jest.Mock;
/** Uploads succeed; the recipe endpoints answer with what the test queued */
const answerRecipeWith = (response: unknown) => {
  mockFetch.mockImplementation(async (url: string) => {
    if (url === '/api/upload') return okResponse({ url: COVER_URL });
    if (response instanceof Error) throw response;
    return response;
  });
};

const recipeCalls = () => mockFetch.mock.calls.filter(([url]) => url !== '/api/upload');

const tab = (name: RegExp) => screen.getByRole('tab', { name });
const writeTab = () => tab(/^Write/);
const checkTab = () => tab(/^Check & (publish|save)/);
const titleBox = () => screen.getByRole('textbox', { name: /^Title/ });
const ingredientsBox = () => screen.getByRole('textbox', { name: 'Ingredients' });
const methodBox = () => screen.getByRole('textbox', { name: 'Method' });
const publishButton = () => screen.getByRole('button', { name: 'Publish recipe' });
const saveButton = () => screen.getByRole('button', { name: 'Save changes' });
const coverGroup = () => screen.getByRole('group', { name: /^Cover photo/ });

const paste = async (user: ReturnType<typeof userEvent.setup>, box: HTMLElement, text: string) => {
  await user.click(box);
  await user.paste(text);
};

const selectFile = (file: File) => {
  // The step rows above carry their own photo inputs: this one is the cover's
  const input = within(coverGroup()).getByTestId('image-upload-input');
  Object.defineProperty(input, 'files', { value: [file], configurable: true });
  fireEvent.change(input);
};

const EIGHT_LINES = [
  '500 g harina',
  '2 huevos',
  '1 1/2 tazas de leche',
  '1,5 kg papas',
  'sal a gusto',
  '2 tbsp olive oil',
  '1 lata de tomate',
  'pimienta',
].join('\n');

beforeEach(() => {
  mockUser = { id: 'user-1', username: 'ana' };
  mockPush.mockReset();
  mockShowSuccess.mockReset();
  mockShowInfo.mockReset();
  mockLogout.mockReset();
  mockFetch = global.fetch as jest.Mock;
  mockFetch.mockReset();
});

describe('tabForPath', () => {
  it('should send the title to Write and everything else to the structured tab', () => {
    expect(tabForPath('title')).toBe('write');
    expect(tabForPath('cookingTime')).toBe('check');
    expect(tabForPath('ingredients.abc.name')).toBe('check');
    expect(tabForPath('imageUrl')).toBe('check');
  });
});

describe('RecipeTextFirstDialog - create', () => {
  describe('shell', () => {
    it('should render nothing until it is opened for the first time', () => {
      renderDialog({ open: false });

      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    it("should be the 'New recipe' dialog with two tabs, opened on Write", () => {
      renderDialog();

      expect(screen.getByRole('dialog', { name: 'New recipe' })).toBeInTheDocument();
      expect(writeTab()).toHaveAttribute('aria-selected', 'true');
      expect(checkTab()).toHaveAttribute('aria-selected', 'false');
    });

    it('should wire each tab to its panel', () => {
      renderDialog();

      const panel = screen.getByRole('tabpanel');
      expect(panel).toHaveAttribute('aria-labelledby', writeTab().id);
      expect(writeTab()).toHaveAttribute('aria-controls', panel.id);
    });

    it('should show nothing in red on first open', () => {
      renderDialog();

      expect(document.querySelector('.Mui-error')).toBeNull();
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    });

    it('should offer Next on Write and keep Publish for the second tab', () => {
      renderDialog();

      expect(screen.getByRole('button', { name: 'Next: Check & publish' })).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Publish recipe' })).not.toBeInTheDocument();
    });

    it('should let the author switch tabs with nothing filled in', async () => {
      const { user } = renderDialog();

      await user.click(checkTab());

      expect(checkTab()).toHaveAttribute('aria-selected', 'true');
      expect(publishButton()).toBeEnabled();
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    });

    it('should move the focus to the heading of the panel after a tab change', async () => {
      const { user } = renderDialog();

      await user.click(screen.getByRole('button', { name: 'Next: Check & publish' }));

      expect(screen.getByRole('heading', { name: 'Ingredients', level: 3 })).toHaveFocus();
    });

    it('should return to Write with Back', async () => {
      const { user } = renderDialog();
      await user.click(checkTab());

      await user.click(screen.getByRole('button', { name: 'Back' }));

      expect(writeTab()).toHaveAttribute('aria-selected', 'true');
      expect(screen.getByRole('heading', { name: 'Write', level: 3 })).toHaveFocus();
    });

    describe('with a mouse', () => {
      const originalMatchMedia = window.matchMedia;
      beforeEach(() => {
        window.matchMedia = jest.fn().mockImplementation((query: string) => ({
          matches: query === '(pointer: fine)',
          media: query,
          addListener: jest.fn(),
          removeListener: jest.fn(),
          addEventListener: jest.fn(),
          removeEventListener: jest.fn(),
        }));
      });
      afterEach(() => {
        window.matchMedia = originalMatchMedia;
      });

      it('should put the caret in the title when the editor opens', () => {
        renderDialog();

        expect(titleBox()).toHaveFocus();
      });

      // `next dev` runs every effect twice: the dialog's focus trap hands the focus back to
      // the opener in between, which is a blur of the title the author never caused
      it('should show nothing in red when React mounts the editor twice (StrictMode)', () => {
        const opener = document.body.appendChild(document.createElement('button'));
        opener.focus();

        render(
          <React.StrictMode>
            <ThemeProvider theme={theme}>
              <RecipeTextFirstDialog mode="create" open onClose={jest.fn()} draftStorage={null} />
            </ThemeProvider>
          </React.StrictMode>
        );

        expect(titleBox()).toHaveFocus();
        expect(document.querySelector('.Mui-error')).toBeNull();
        opener.remove();
      });

      it('should leave the focus on the heading when the author comes back to Write', async () => {
        const { user } = renderDialog();
        await user.click(checkTab());

        await user.click(writeTab());

        expect(screen.getByRole('heading', { name: 'Write', level: 3 })).toHaveFocus();
      });
    });

    it('should start every opening as a fresh session', async () => {
      const { user, rerender } = renderDialog({ draftStorage: null });
      await user.type(titleBox(), 'Pan');
      rerender({ open: false, draftStorage: null });

      rerender({ open: true, draftStorage: null });

      expect(titleBox()).toHaveValue('');
    });
  });

  describe('writing', () => {
    it('should read eight pasted lines as eight ingredients and say so politely', async () => {
      jest.useFakeTimers();
      const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
      renderDialog();

      await paste(user, ingredientsBox(), EIGHT_LINES);
      act(() => {
        jest.advanceTimersByTime(1000);
      });

      const announcement = screen
        .getAllByRole('status')
        .find((node) => node.textContent === '8 ingredients - 1 to check');
      expect(announcement).toHaveAttribute('aria-live', 'polite');
      jest.useRealTimers();
    });

    it('should show each line the way it will be published', async () => {
      const { user } = renderDialog();

      await paste(user, ingredientsBox(), EIGHT_LINES);
      await user.click(screen.getByRole('button', { name: /^8 ingredients/ }));

      const lines = screen.getAllByRole('listitem').map((item) => item.textContent);
      expect(lines.slice(0, 5)).toEqual([
        '500 g harina',
        '2 huevos',
        '1.5 cups leche',
        '1.5 kg papas',
        'sal, to taste',
      ]);
    });

    it('should fold the readout behind its summary and open it on demand', async () => {
      const { user } = renderDialog();
      await paste(user, ingredientsBox(), '2 huevos');
      const summary = screen.getByRole('button', { name: '1 ingredient' });

      await user.click(summary);

      expect(summary).toHaveAttribute('aria-expanded', 'true');
      expect(document.getElementById(summary.getAttribute('aria-controls')!)).toBeVisible();
    });

    it('should mark a doubtful line with a reason and take the author to its row', async () => {
      const { user } = renderDialog();
      await paste(user, ingredientsBox(), '500 g harina\n1 lata de tomate');
      await user.click(screen.getByRole('button', { name: /^2 ingredients - 1 to check/ }));

      const flagged = screen.getByRole('button', { name: 'Check lata de tomate on the next tab' });
      expect(flagged).toHaveAccessibleDescription(
        'No unit recognised - is "lata" part of the name?'
      );
      await user.click(flagged);

      expect(checkTab()).toHaveAttribute('aria-selected', 'true');
      expect(screen.getByRole('textbox', { name: 'Name of ingredient 2' })).toHaveFocus();
    });

    it('should count the doubtful rows on the second tab', async () => {
      const { user } = renderDialog();

      await paste(user, ingredientsBox(), '1 lata de tomate');

      expect(checkTab()).toHaveAccessibleName(/1 to check/);
    });

    it('should keep Enter a newline in the text boxes and never publish with it', async () => {
      const { user } = renderDialog();

      await user.click(methodBox());
      await user.keyboard('Mezclar{Enter}Hornear');

      expect(methodBox()).toHaveValue('Mezclar\nHornear');
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('should split the method into numbered steps in the readout', async () => {
      const { user } = renderDialog();

      await paste(user, methodBox(), '1. Mezclar todo\n2. Hornear 30 min');
      await user.click(screen.getByRole('button', { name: '2 steps' }));

      expect(screen.getByText('Mezclar todo')).toBeInTheDocument();
      expect(screen.getByText('Hornear 30 min')).toBeInTheDocument();
    });

    it('should say when the ingredient list is longer than a recipe allows', async () => {
      renderDialog();
      const text = Array.from({ length: 101 }, (_, index) => `${index + 1} g cosa`).join('\n');

      fireEvent.change(ingredientsBox(), { target: { value: text } });

      expect(screen.getByText(/Only the first 100 ingredients were read/)).toBeInTheDocument();
    });

    it('should say when the method is longer than a recipe allows', () => {
      renderDialog();
      const text = Array.from({ length: 51 }, (_, index) => `Paso ${index + 1}: algo`).join('\n');

      fireEvent.change(methodBox(), { target: { value: text } });

      expect(screen.getByText(/Only the first 50 steps were read/)).toBeInTheDocument();
    });

    it('should mark Write as complete once it has a title, an ingredient and a step', async () => {
      const { user } = renderDialog();

      await user.type(titleBox(), 'Pan');
      await paste(user, ingredientsBox(), '500 g harina');
      await paste(user, methodBox(), 'Amasar');

      expect(writeTab()).toHaveAccessibleName(/complete/);
    });
  });

  describe('both tabs edit the same recipe', () => {
    it('should show the pasted lines as rows on the second tab', async () => {
      const { user } = renderDialog();
      await paste(user, ingredientsBox(), '500 g harina\n2 huevos');

      await user.click(checkTab());

      expect(screen.getByRole('textbox', { name: 'Amount for ingredient 1' })).toHaveValue('500');
      expect(screen.getByRole('combobox', { name: 'Unit for ingredient 1' })).toHaveValue('g');
      expect(screen.getByRole('textbox', { name: 'Name of ingredient 2' })).toHaveValue('huevos');
    });

    it('should show a doubtful row with a note that an edit of the row clears', async () => {
      const { user } = renderDialog();
      await paste(user, ingredientsBox(), '1 lata de tomate');
      await user.click(checkTab());
      const row = screen.getByRole('group', { name: 'Ingredient 1' });

      expect(within(row).getByText(/is "lata" part of the name/)).toBeInTheDocument();
      await user.type(screen.getByRole('textbox', { name: 'Name of ingredient 1' }), 's');

      expect(within(row).queryByText(/is "lata" part of the name/)).not.toBeInTheDocument();
      expect(checkTab()).not.toHaveAccessibleName(/to check/);
    });

    it('should rewrite the text from the rows after a row was edited by hand', async () => {
      const { user } = renderDialog();
      await paste(user, ingredientsBox(), '2 tazas de leche');
      await user.click(checkTab());
      const amount = screen.getByRole('textbox', { name: 'Amount for ingredient 1' });
      await user.clear(amount);
      await user.type(amount, '3');

      await user.click(writeTab());

      expect(ingredientsBox()).toHaveValue('3 cups leche');
    });

    it('should keep the wording when the rows were only looked at', async () => {
      const { user } = renderDialog();
      await paste(user, ingredientsBox(), '2 tazas de leche');
      await user.click(checkTab());

      await user.click(writeTab());

      expect(ingredientsBox()).toHaveValue('2 tazas de leche');
    });

    it('should let an author who prefers fields skip the text boxes', async () => {
      const { user } = renderDialog();
      await user.click(checkTab());
      await user.type(screen.getByRole('textbox', { name: 'Name of ingredient 1' }), 'sal');

      await user.click(writeTab());

      expect(ingredientsBox()).toHaveValue('sal');
    });
  });

  describe('publish', () => {
    const openComplete = () =>
      renderDialog({ draftStorage: createStorage({ [USER_KEY]: storedDraft() }) });

    it('should publish a recipe written as a note, then close, toast and open it', async () => {
      answerRecipeWith(okResponse({ recipe: { id: 'new-1' }, message: 'ok' }));
      const { user, onClose, storage } = renderDialog();
      await paste(user, titleBox(), 'Pan casero');
      await paste(user, ingredientsBox(), '500 g harina\n2 huevos\nsal a gusto');
      await paste(user, methodBox(), '1. Amasar\n2. Hornear');
      await user.click(screen.getByRole('button', { name: 'Next: Check & publish' }));
      await user.click(
        within(screen.getByRole('group', { name: 'Quick pick cook time' })).getByRole('button', {
          name: '30 minutes',
        })
      );
      await user.click(
        within(screen.getByRole('group', { name: 'Quick pick prep time' })).getByRole('button', {
          name: 'No prep time',
        })
      );
      await paste(user, screen.getByRole('textbox', { name: /^Description/ }), 'De mi abuela');
      selectFile(new File(['x'], 'pan.jpg', { type: 'image/jpeg' }));
      await within(coverGroup()).findByRole('button', { name: 'Replace photo' });

      await user.click(publishButton());

      await waitFor(() => expect(mockPush).toHaveBeenCalledWith('/recipe/new-1'));
      const [[url, init]] = recipeCalls();
      expect(url).toBe('/api/recipes');
      expect(JSON.parse(init.body)).toEqual({
        title: 'Pan casero',
        description: 'De mi abuela',
        imageUrl: COVER_URL,
        cookingTime: 30,
        prepTime: 0,
        servings: 4,
        difficulty: 'medium',
        caption: '',
        ingredients: [
          { name: 'harina', amount: '500', unit: 'g' },
          { name: 'huevos', amount: '2', unit: 'units' },
          { name: 'sal', amount: '', unit: 'to taste' },
        ],
        instructions: [
          { step: 1, description: 'Amasar' },
          { step: 2, description: 'Hornear' },
        ],
      });
      expect(onClose).toHaveBeenCalledTimes(1);
      expect(mockShowSuccess).toHaveBeenCalledWith('Recipe published');
      expect(storage.data.has(USER_KEY)).toBe(false);
    });

    it('should not let a doubtful row block publishing', async () => {
      answerRecipeWith(okResponse({ recipe: { id: 'new-2' } }));
      const draft = storedDraft({
        values: toDraftValues(
          makeValues({
            ingredients: [{ id: 'i1', name: 'lata de tomate', amount: '1', unit: 'units' }],
          })
        ),
        text: { ingredients: '1 lata de tomate', method: 'Mix the filling\n\nBuild the layers' },
      });
      const { user } = renderDialog({ draftStorage: createStorage({ [USER_KEY]: draft }) });
      expect(checkTab()).toHaveAccessibleName(/1 to check/);

      await user.click(publishButton());

      await waitFor(() => expect(mockPush).toHaveBeenCalledWith('/recipe/new-2'));
    });

    it('should go home when the answer carries no recipe id', async () => {
      answerRecipeWith(okResponse({ message: 'ok' }));
      const { user } = openComplete();

      await user.click(publishButton());

      await waitFor(() => expect(mockPush).toHaveBeenCalledWith('/'));
    });

    it('should switch to Write and focus the title when the title is what is missing', async () => {
      const draft = storedDraft({ values: toDraftValues(makeValues({ title: '' })) });
      const { user } = renderDialog({ draftStorage: createStorage({ [USER_KEY]: draft }) });

      await user.click(publishButton());

      expect(writeTab()).toHaveAttribute('aria-selected', 'true');
      expect(titleBox()).toHaveFocus();
      expect(titleBox()).toHaveAccessibleDescription('Add a title');
      expect(writeTab()).toHaveAccessibleName(/1 to fix/);
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('should stay on the structured tab and focus the first invalid field there', async () => {
      const draft = storedDraft({ values: toDraftValues(makeValues({ cookingTime: '' })) });
      const { user } = renderDialog({ draftStorage: createStorage({ [USER_KEY]: draft }) });

      await user.click(publishButton());

      expect(screen.getByRole('textbox', { name: /^Cook time/ })).toHaveFocus();
      expect(checkTab()).toHaveAccessibleName(/1 to fix/);
      expect(screen.getByRole('alert')).toHaveTextContent('1 thing to fix');
    });

    it('should name an invalid row with a field-level message and focus it', async () => {
      const draft = storedDraft({
        values: toDraftValues(
          makeValues({ ingredients: [{ id: 'i1', name: 'Harina', amount: '', unit: 'g' }] })
        ),
        text: undefined,
      });
      const { user } = renderDialog({ draftStorage: createStorage({ [USER_KEY]: draft }) });

      await user.click(publishButton());

      expect(screen.getByRole('textbox', { name: 'Amount for ingredient 1' })).toHaveFocus();
      expect(
        screen.getByText('Harina: add an amount, or clear the unit for to taste')
      ).toBeInTheDocument();
    });

    it('should jump to a missing field from the status line', async () => {
      const draft = storedDraft({
        section: 'write',
        values: toDraftValues(makeValues({ description: '' })),
      });
      const { user } = renderDialog({ draftStorage: createStorage({ [USER_KEY]: draft }) });

      await user.click(screen.getByRole('button', { name: /Missing: description/ }));
      await user.click(screen.getByRole('menuitem', { name: 'Add a short description' }));

      await waitFor(() =>
        expect(screen.getByRole('textbox', { name: /^Description/ })).toHaveFocus()
      );
    });

    it.each([
      [
        'an expired session',
        errorResponse(401, { error: 'Unauthorized' }),
        'Your session expired. Your recipe is saved as a draft on this device.',
      ],
      [
        'the daily limit',
        errorResponse(429, { error: 'Daily recipe creation limit reached (10 per day)' }),
        'You have published 10 recipes in the last 24 hours. This one is saved as a draft - publish it tomorrow.',
      ],
      [
        'the rate limiter',
        errorResponse(429, { error: 'Too many requests', retryAfter: 120 }),
        'Too many requests - try again in 2 min',
      ],
      [
        'a network failure',
        new TypeError('Failed to fetch'),
        'Could not reach Remy. Nothing was lost.',
      ],
      [
        'a server error',
        errorResponse(500, { error: 'boom' }),
        'Could not reach Remy. Nothing was lost.',
      ],
      [
        'a rule only the server knows',
        errorResponse(400, { error: 'Title contains a banned word' }),
        'Title contains a banned word',
      ],
    ])('should explain %s next to the button and keep the draft', async (_case, response, copy) => {
      answerRecipeWith(response);
      const { user, onClose, storage } = openComplete();

      await user.click(publishButton());

      expect(await screen.findByRole('alert')).toHaveTextContent(copy);
      expect(storage.data.has(USER_KEY)).toBe(true);
      expect(onClose).not.toHaveBeenCalled();
      expect(mockPush).not.toHaveBeenCalled();
      expect(publishButton()).toBeEnabled();
    });

    it('should send the author to log in again with the create intent', async () => {
      answerRecipeWith(errorResponse(401, { error: 'Unauthorized' }));
      const { user } = openComplete();

      await user.click(publishButton());

      expect(await screen.findByRole('link', { name: 'Log in again' })).toHaveAttribute(
        'href',
        '/auth?next=create'
      );
    });

    describe('Log in again', () => {
      // jsdom can not follow a link; the click itself still reaches the editor
      const follow = async (user: ReturnType<typeof userEvent.setup>) => {
        const link = await screen.findByRole('link', { name: 'Log in again' });
        link.addEventListener('click', (event) => event.preventDefault());
        await user.click(link);
      };

      it('should close the editor so it does not cover the login page', async () => {
        answerRecipeWith(errorResponse(401, { error: 'Unauthorized' }));
        const { user, onClose } = openComplete();
        await user.click(publishButton());

        await follow(user);

        expect(onClose).toHaveBeenCalledTimes(1);
      });

      it('should end the session the server refused, so the login page does not bounce', async () => {
        answerRecipeWith(errorResponse(401, { error: 'Unauthorized' }));
        const { user } = openComplete();
        await user.click(publishButton());

        await follow(user);

        expect(mockLogout).toHaveBeenCalledTimes(1);
      });

      it("should leave without the 'Draft saved' toast: the author is not done", async () => {
        jest.useFakeTimers();
        const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
        answerRecipeWith(errorResponse(401, { error: 'Unauthorized' }));
        openComplete();
        await user.click(publishButton());

        await follow(user);
        act(() => {
          jest.advanceTimersByTime(theme.transitions.duration.leavingScreen * 2);
        });

        expect(mockShowInfo).not.toHaveBeenCalled();
        jest.useRealTimers();
      });

      it('should keep what was typed after the session expired, up to the last key', async () => {
        const { user, storage, rerender } = renderDialog();
        await user.type(titleBox(), 'Pan');
        mockUser = null;
        rerender({});
        await user.type(titleBox(), ' casero');

        await follow(user);

        expect(JSON.parse(storage.data.get(USER_KEY) ?? 'null').values.title).toBe('Pan casero');
        expect(mockLogout).not.toHaveBeenCalled();
      });

      describe('on a device that can not keep a draft', () => {
        afterEach(() => jest.useRealTimers());

        const expireWithoutDraft = async () => {
          const view = renderDialog({ draftStorage: null });
          await view.user.type(titleBox(), 'Pan');
          mockUser = null;
          view.rerender({});
          return view;
        };

        it('should ask first and keep the link from leaving the page', async () => {
          const { onClose } = await expireWithoutDraft();

          const followed = fireEvent.click(screen.getByRole('link', { name: 'Log in again' }));

          expect(followed).toBe(false);
          expect(screen.getByRole('dialog', { name: 'Discard your changes?' })).toBeInTheDocument();
          expect(onClose).not.toHaveBeenCalled();
        });

        it('should stay in the editor when the author keeps editing', async () => {
          const { user, onClose } = await expireWithoutDraft();
          fireEvent.click(screen.getByRole('link', { name: 'Log in again' }));

          await user.click(screen.getByRole('button', { name: 'Keep editing' }));

          expect(onClose).not.toHaveBeenCalled();
          expect(mockPush).not.toHaveBeenCalled();
          expect(await screen.findByRole('textbox', { name: /^Title/ })).toHaveValue('Pan');
        });

        it('should go to the login page once the author gives the recipe up', async () => {
          const { user, onClose } = await expireWithoutDraft();
          fireEvent.click(screen.getByRole('link', { name: 'Log in again' }));

          await user.click(screen.getByRole('button', { name: 'Discard' }));

          expect(onClose).toHaveBeenCalledTimes(1);
          expect(mockPush).toHaveBeenCalledWith('/auth?next=create');
        });

        it('should not say that the recipe is saved as a draft', async () => {
          jest.useFakeTimers();
          const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
          const { rerender } = renderDialog({ draftStorage: null });
          await user.type(titleBox(), 'Pan');
          act(() => {
            jest.advanceTimersByTime(RECIPE_DRAFT_DEBOUNCE_MS);
          });

          mockUser = null;
          rerender({});

          expect(screen.getByRole('alert')).toHaveTextContent(
            'Your session expired and this device could not save a draft - copy what you wrote before you log in again.'
          );
        });
      });
    });

    it('should try again after a network failure', async () => {
      answerRecipeWith(new TypeError('Failed to fetch'));
      const { user } = openComplete();
      await user.click(publishButton());
      await screen.findByRole('alert');
      answerRecipeWith(okResponse({ recipe: { id: 'new-3' } }));

      await user.click(screen.getByRole('button', { name: 'Try again' }));

      await waitFor(() => expect(mockPush).toHaveBeenCalledWith('/recipe/new-3'));
    });

    it('should lock the editor and block closing while the request is in flight', async () => {
      let answer: (value: unknown) => void = () => undefined;
      mockFetch.mockReturnValue(new Promise((resolve) => (answer = resolve)));
      const { user, onClose } = openComplete();

      await user.click(publishButton());

      expect(screen.getByRole('button', { name: 'Publishing...' })).toHaveAttribute(
        'aria-busy',
        'true'
      );
      expect(screen.getByRole('dialog', { name: 'New recipe' })).toHaveAttribute(
        'aria-busy',
        'true'
      );
      expect(screen.getByRole('button', { name: 'Close' })).toBeDisabled();
      expect(screen.getByRole('group', { name: 'Ingredients' }).closest('fieldset')).toBeDisabled();
      await act(async () => answer(okResponse({ recipe: { id: 'new-4' } })));
      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('should say that the session expired as soon as the user is gone', () => {
      const { rerender } = openComplete();

      mockUser = null;
      rerender({});

      expect(screen.getByRole('alert')).toHaveTextContent(/Your session expired/);
    });

    it('should not send anything once the session is known to be gone', async () => {
      const { user, rerender } = openComplete();
      mockUser = null;
      rerender({});

      await user.click(publishButton());

      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('should not publish a restored cover that no longer loads', async () => {
      const { user } = openComplete();
      fireEvent.error(screen.getByRole('img', { name: 'Cover photo preview' }));
      await screen.findByText('This photo could not be loaded - Replace');

      await user.click(publishButton());

      expect(mockFetch).not.toHaveBeenCalled();
      expect(within(coverGroup()).getByRole('button', { name: 'Replace photo' })).toHaveFocus();
    });

    it('should wait for a photo that is still uploading', async () => {
      mockFetch.mockReturnValue(new Promise(() => undefined));
      const { user } = openComplete();
      await user.click(within(coverGroup()).getByRole('button', { name: 'Replace photo' }));

      selectFile(new File(['x'], 'pan.jpg', { type: 'image/jpeg' }));

      expect(await screen.findByText('Waiting for 1 photo...')).toBeInTheDocument();
      expect(publishButton()).toBeDisabled();
    });

    describe('Try again while a photo uploads', () => {
      /** The recipe endpoint is offline; the upload answers when the test lets it */
      const failPublishAndHoldUpload = () => {
        let land: (value: unknown) => void = () => undefined;
        const upload = new Promise((resolve) => (land = resolve));
        mockFetch.mockImplementation((url: string) =>
          url === '/api/upload' ? upload : Promise.reject(new TypeError('Failed to fetch'))
        );
        return { land: () => land(okResponse({ url: STEP_URL })) };
      };

      const failThenReplaceCover = async () => {
        const upload = failPublishAndHoldUpload();
        const view = openComplete();
        await view.user.click(publishButton());
        await screen.findByRole('button', { name: 'Try again' });
        await view.user.click(within(coverGroup()).getByRole('button', { name: 'Replace photo' }));
        selectFile(new File(['x'], 'pan.jpg', { type: 'image/jpeg' }));
        await screen.findByText('Waiting for 1 photo...');
        return { ...view, upload };
      };

      it('should put Try again aside and say what Publish is waiting for', async () => {
        await failThenReplaceCover();

        expect(screen.queryByRole('button', { name: 'Try again' })).not.toBeInTheDocument();
        expect(publishButton()).toBeDisabled();
        expect(recipeCalls()).toHaveLength(1);
      });

      it('should offer Try again once more when the photo has landed', async () => {
        const { upload } = await failThenReplaceCover();

        await act(async () => upload.land());

        expect(await screen.findByRole('button', { name: 'Try again' })).toBeInTheDocument();
        expect(publishButton()).toBeEnabled();
      });

      it('should send the new photo, not the old one, with the retry', async () => {
        const { user, upload } = await failThenReplaceCover();
        await act(async () => upload.land());

        await user.click(await screen.findByRole('button', { name: 'Try again' }));

        await waitFor(() => expect(recipeCalls()).toHaveLength(2));
        expect(JSON.parse(recipeCalls()[1][1].body).imageUrl).toBe(STEP_URL);
      });
    });
  });

  describe('draft and close', () => {
    it('should restore the texts, the rows, the photos and the tab of a stored draft', async () => {
      const { user } = renderDialog({
        draftStorage: createStorage({ [USER_KEY]: storedDraft() }),
      });

      expect(screen.getByText(/^Draft restored from 10 min ago/)).toBeInTheDocument();
      expect(checkTab()).toHaveAttribute('aria-selected', 'true');
      expect(screen.getByRole('textbox', { name: 'Name of ingredient 1' })).toHaveValue(
        'Chocolinas'
      );
      expect(screen.getByRole('img', { name: 'Cover photo preview' })).toHaveAttribute(
        'src',
        COVER_URL
      );
      await user.click(writeTab());
      expect(titleBox()).toHaveValue('Chocotorta');
      expect(ingredientsBox()).toHaveValue('500 g Chocolinas\n400 g Dulce de leche');
      expect(methodBox()).toHaveValue('Mix the filling\n\nBuild the layers');
    });

    it('should write the texts from the rows of a draft another editor stored', async () => {
      const draft = storedDraft({ section: 'basics', text: undefined });
      renderDialog({ draftStorage: createStorage({ [USER_KEY]: draft }) });

      expect(writeTab()).toHaveAttribute('aria-selected', 'true');
      expect(ingredientsBox()).toHaveValue('500 g Chocolinas\n400 g Dulce de leche');
      expect(methodBox()).toHaveValue('1. Mix the filling\n\n2. Build the layers');
    });

    it('should hide the restored bar when it is dismissed', async () => {
      const { user } = renderDialog({
        draftStorage: createStorage({ [USER_KEY]: storedDraft() }),
      });

      await user.click(screen.getByRole('button', { name: 'Dismiss' }));

      expect(screen.queryByText(/Draft restored/)).not.toBeInTheDocument();
      expect(screen.getByRole('heading', { name: 'Ingredients', level: 3 })).toHaveFocus();
    });

    it('should start over only after a confirmation, and then forget the draft', async () => {
      const { user, storage } = renderDialog({
        draftStorage: createStorage({ [USER_KEY]: storedDraft() }),
      });

      await user.click(screen.getByRole('button', { name: 'Start over' }));
      await user.click(
        within(screen.getByRole('dialog', { name: 'Start over?' })).getByRole('button', {
          name: 'Start over',
        })
      );

      expect(storage.data.has(USER_KEY)).toBe(false);
      expect(writeTab()).toHaveAttribute('aria-selected', 'true');
      await waitFor(() => expect(titleBox()).toHaveFocus());
      expect(titleBox()).toHaveValue('');
      expect(ingredientsBox()).toHaveValue('');
      expect(screen.queryByText(/Draft restored/)).not.toBeInTheDocument();
    });

    it('should keep what was written as a draft when the X closes the dialog', async () => {
      jest.useFakeTimers();
      const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
      const { onClose, storage, rerender } = renderDialog();
      await paste(user, ingredientsBox(), '500 g harina');

      await user.click(screen.getByRole('button', { name: 'Close' }));
      rerender({ open: false });

      expect(onClose).toHaveBeenCalledTimes(1);
      const saved = JSON.parse(storage.data.get(USER_KEY) ?? 'null');
      expect(saved.text.ingredients).toBe('500 g harina');
      expect(saved.values.ingredients).toEqual([{ name: 'harina', amount: '500', unit: 'g' }]);
      expect(saved.section).toBe('write');
      jest.useRealTimers();
    });

    it('should reopen on the tab the author was on, texts and rows included', async () => {
      jest.useFakeTimers();
      const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
      const { rerender } = renderDialog();
      await paste(user, ingredientsBox(), '2 tazas de leche');
      act(() => {
        jest.advanceTimersByTime(RECIPE_DRAFT_DEBOUNCE_MS);
      });
      await user.click(checkTab());
      await user.click(screen.getByRole('button', { name: 'Close' }));
      rerender({ open: false });

      rerender({ open: true });

      expect(checkTab()).toHaveAttribute('aria-selected', 'true');
      expect(screen.getByText(/^Draft restored from/)).toBeInTheDocument();
      expect(screen.getByRole('textbox', { name: 'Name of ingredient 1' })).toHaveValue('leche');
      await user.click(writeTab());
      expect(ingredientsBox()).toHaveValue('2 tazas de leche');
      jest.useRealTimers();
    });

    it("should say 'Draft saved' only after the dialog has closed", async () => {
      jest.useFakeTimers();
      const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
      renderDialog();
      await user.type(titleBox(), 'Pan');

      await user.click(screen.getByRole('button', { name: 'Close' }));
      const saidAtOnce = mockShowInfo.mock.calls.length;
      act(() => {
        jest.advanceTimersByTime(theme.transitions.duration.leavingScreen);
      });

      expect(saidAtOnce).toBe(0);
      expect(mockShowInfo).toHaveBeenCalledWith(DRAFT_SAVED_TOAST);
      jest.useRealTimers();
    });

    it('should close an untouched editor without a word', async () => {
      const { user, onClose } = renderDialog();

      await user.click(screen.getByRole('button', { name: 'Close' }));

      expect(onClose).toHaveBeenCalledTimes(1);
      expect(mockShowInfo).not.toHaveBeenCalled();
    });

    it('should close with Escape', async () => {
      const { user, onClose } = renderDialog();

      await user.keyboard('{Escape}');

      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('should ignore a click on the backdrop while something is written', async () => {
      const { user, onClose } = renderDialog();
      await user.type(titleBox(), 'Pan');

      await user.click(document.querySelector('.MuiBackdrop-root') as HTMLElement);

      expect(onClose).not.toHaveBeenCalled();
    });

    it("should print 'Draft saved' in the status line after an autosave", async () => {
      jest.useFakeTimers();
      const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
      renderDialog();

      await user.type(titleBox(), 'Pan');
      act(() => {
        jest.advanceTimersByTime(RECIPE_DRAFT_DEBOUNCE_MS);
      });

      expect(screen.getByText('Draft saved')).toBeInTheDocument();
      jest.useRealTimers();
    });

    describe('a draft belongs to the author who wrote it', () => {
      const wait = (ms: number) =>
        act(() => {
          jest.advanceTimersByTime(ms);
        });

      beforeEach(() => jest.useFakeTimers());
      afterEach(() => jest.useRealTimers());

      /** Writes a title and closes with X; the dialog stays mounted, as in the root layout */
      const writeAndClose = async () => {
        const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
        const view = renderDialog();
        await user.type(titleBox(), 'Secret recipe of Ana');
        await user.click(screen.getByRole('button', { name: 'Close' }));
        view.rerender({ open: false });
        return view;
      };

      /** What Navigation does on a deliberate logout, then the next login in the same tab */
      const logOutAndIn = (view: ReturnType<typeof renderDialog>, next: typeof mockUser) => {
        view.storage.data.delete(USER_KEY);
        mockUser = null;
        view.rerender({ open: false });
        mockUser = next;
        view.rerender({ open: false });
        wait(RECIPE_DRAFT_DEBOUNCE_MS * 2);
      };

      it('should write nothing for the user who logs in after the author logged out', async () => {
        const view = await writeAndClose();

        logOutAndIn(view, SOMEBODY_ELSE);

        expect(Array.from(view.storage.data.keys())).toEqual([]);
      });

      it('should open blank for the user who logs in after the author logged out', async () => {
        const view = await writeAndClose();
        logOutAndIn(view, SOMEBODY_ELSE);

        view.rerender({ open: true });

        expect(titleBox()).toHaveValue('');
        expect(screen.queryByText(/Draft restored/)).not.toBeInTheDocument();
      });

      it('should not bring back the draft a logout cleared when the author logs in again', async () => {
        const view = await writeAndClose();

        logOutAndIn(view, AUTHOR);
        view.rerender({ open: true });

        expect(view.storage.data.has(USER_KEY)).toBe(false);
        expect(titleBox()).toHaveValue('');
      });

      it('should not bring a published recipe back as a draft after a logout and a login', async () => {
        answerRecipeWith(okResponse({ recipe: { id: 'new-9' } }));
        const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
        const view = renderDialog({ draftStorage: createStorage({ [USER_KEY]: storedDraft() }) });
        await user.click(publishButton());
        await waitFor(() => expect(view.onClose).toHaveBeenCalledTimes(1));
        view.rerender({ open: false });

        logOutAndIn(view, AUTHOR);
        view.rerender({ open: true });

        expect(view.storage.data.has(USER_KEY)).toBe(false);
        expect(screen.queryByText(/Draft restored/)).not.toBeInTheDocument();
      });

      it('should keep saving for an author whose session expired while writing', async () => {
        const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
        const { storage, rerender } = renderDialog();
        mockUser = null;
        rerender({});

        await user.type(titleBox(), 'Pan');
        wait(RECIPE_DRAFT_DEBOUNCE_MS);

        expect(JSON.parse(storage.data.get(USER_KEY) ?? 'null').values.title).toBe('Pan');
      });

      it('should save nothing while somebody else is logged in over an open editor', async () => {
        const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
        const { storage, rerender } = renderDialog();
        mockUser = SOMEBODY_ELSE;
        rerender({});

        await user.type(titleBox(), 'Pan');
        wait(RECIPE_DRAFT_DEBOUNCE_MS);

        expect(Array.from(storage.data.keys())).toEqual([]);
      });
    });

    it('should ask before closing when this device can not keep a draft', async () => {
      jest.useFakeTimers();
      const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
      const { onClose } = renderDialog({ draftStorage: null });
      await user.type(titleBox(), 'Pan');
      act(() => {
        jest.advanceTimersByTime(RECIPE_DRAFT_DEBOUNCE_MS);
      });

      await user.click(screen.getByRole('button', { name: 'Close' }));

      expect(screen.getByRole('dialog', { name: 'Discard your changes?' })).toBeInTheDocument();
      expect(onClose).not.toHaveBeenCalled();
      jest.useRealTimers();
    });

    describe("what 'Draft saved' promises", () => {
      const leave = () =>
        act(() => {
          jest.advanceTimersByTime(theme.transitions.duration.leavingScreen);
        });

      beforeEach(() => jest.useFakeTimers());
      afterEach(() => jest.useRealTimers());

      it('should ask, not promise, when the X comes before the first autosave could fail', async () => {
        const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
        const { onClose } = renderDialog({ draftStorage: null });
        await user.type(titleBox(), 'Pan');

        await user.click(screen.getByRole('button', { name: 'Close' }));
        leave();

        expect(screen.getByRole('dialog', { name: 'Discard your changes?' })).toBeInTheDocument();
        expect(onClose).not.toHaveBeenCalled();
        expect(mockShowInfo).not.toHaveBeenCalled();
      });

      it('should ask, not promise, when the editor has nobody to keep the draft for', async () => {
        const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
        const { onClose, rerender } = renderDialog();
        mockUser = SOMEBODY_ELSE;
        rerender({});
        await user.type(titleBox(), 'Pan');

        await user.click(screen.getByRole('button', { name: 'Close' }));
        leave();

        expect(screen.getByRole('dialog', { name: 'Discard your changes?' })).toBeInTheDocument();
        expect(onClose).not.toHaveBeenCalled();
        expect(mockShowInfo).not.toHaveBeenCalled();
      });

      it('should keep its word for what was typed after a silent logout', async () => {
        const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
        const { onClose, storage, rerender } = renderDialog();
        mockUser = null;
        rerender({});
        await user.type(titleBox(), 'Pan');

        await user.click(screen.getByRole('button', { name: 'Close' }));
        leave();

        expect(onClose).toHaveBeenCalledTimes(1);
        expect(JSON.parse(storage.data.get(USER_KEY) ?? 'null').values.title).toBe('Pan');
        expect(mockShowInfo).toHaveBeenCalledWith(DRAFT_SAVED_TOAST);
      });

      it('should close without a word when only a prefilled number was changed', async () => {
        const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
        const { onClose, storage } = renderDialog();
        await user.click(checkTab());
        await user.click(screen.getByRole('button', { name: 'More servings' }));

        await user.click(screen.getByRole('button', { name: 'Close' }));
        leave();

        expect(onClose).toHaveBeenCalledTimes(1);
        expect(storage.data.has(USER_KEY)).toBe(false);
        expect(mockShowInfo).not.toHaveBeenCalled();
      });
    });
  });

  describe('preview', () => {
    it('should open the faithful preview from the title row', async () => {
      const { user } = renderDialog({
        draftStorage: createStorage({ [USER_KEY]: storedDraft() }),
      });

      await user.click(screen.getByRole('button', { name: 'Preview' }));

      const preview = screen.getByRole('dialog', { name: 'Preview' });
      expect(within(preview).getByRole('heading', { name: 'Chocotorta' })).toBeInTheDocument();
      expect(within(preview).getByText('Mix the filling')).toBeInTheDocument();
    });

    it('should give the focus back to the Preview button when it closes', async () => {
      const { user } = renderDialog();
      await user.click(screen.getByRole('button', { name: 'Preview' }));

      await user.click(screen.getByRole('button', { name: 'Close preview' }));

      await waitFor(() => expect(screen.getByRole('button', { name: 'Preview' })).toHaveFocus());
    });

    it('should go to the field behind an Edit button of the preview', async () => {
      const { user } = renderDialog({
        draftStorage: createStorage({ [USER_KEY]: storedDraft() }),
      });
      await user.click(screen.getByRole('button', { name: 'Preview' }));

      await user.click(screen.getByRole('button', { name: 'Edit title and at a glance' }));

      await waitFor(() => expect(titleBox()).toHaveFocus());
      expect(writeTab()).toHaveAttribute('aria-selected', 'true');
    });

    it('should go to the list behind an Edit button that names no field', async () => {
      const { user } = renderDialog({
        draftStorage: createStorage({ [USER_KEY]: storedDraft({ section: 'write' }) }),
      });
      await user.click(screen.getByRole('button', { name: 'Preview' }));

      await user.click(screen.getByRole('button', { name: 'Edit steps' }));

      await waitFor(() => expect(screen.getByRole('textbox', { name: 'Step 1' })).toHaveFocus(), {
        timeout: 4000,
      });
    });
  });

  describe('keyboard only', () => {
    it('should walk Title -> Ingredients -> Method with Enter and Tab, and the tabs with arrows', async () => {
      const { user } = renderDialog();

      await user.click(titleBox());
      await user.keyboard('Pan{Enter}');
      expect(ingredientsBox()).toHaveFocus();
      await user.keyboard('2 huevos{Enter}sal');
      await user.tab();
      await user.tab();
      expect(methodBox()).toHaveFocus();

      writeTab().focus();
      await user.keyboard('{ArrowRight}');
      expect(checkTab()).toHaveFocus();
      await user.keyboard('{Enter}');

      expect(checkTab()).toHaveAttribute('aria-selected', 'true');
      expect(screen.getByRole('textbox', { name: 'Name of ingredient 2' })).toHaveValue('sal');
    });

    it('should publish with the keyboard alone', async () => {
      answerRecipeWith(okResponse({ recipe: { id: 'new-5' } }));
      const { user } = renderDialog({
        draftStorage: createStorage({ [USER_KEY]: storedDraft() }),
      });

      publishButton().focus();
      await user.keyboard('{Enter}');

      await waitFor(() => expect(mockPush).toHaveBeenCalledWith('/recipe/new-5'));
    });

    it('should open the cover picker from the keyboard', async () => {
      const { user } = renderDialog();
      await user.click(checkTab());
      const input = screen.getAllByTestId('image-upload-input').pop() as HTMLInputElement;
      const click = jest.spyOn(input, 'click');

      screen.getByRole('button', { name: /Add a cover photo/ }).focus();
      await user.keyboard('{Enter}');

      expect(click).toHaveBeenCalled();
    });
  });
});

describe('RecipeTextFirstDialog - edit', () => {
  const recipe = (overrides: Partial<Recipe> = {}) => makeRecipe(overrides);
  const renderEdit = (props: Props = {}) =>
    renderDialog({ mode: 'edit', recipe: recipe(), resetKey: 'recipe-1:true', ...props });

  it("should be the 'Edit recipe' dialog, opened on the structured tab", () => {
    renderEdit();

    expect(screen.getByRole('dialog', { name: 'Edit recipe' })).toBeInTheDocument();
    expect(tab(/^Check & save/)).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('textbox', { name: 'Name of ingredient 1' })).toHaveValue('Chocolinas');
  });

  it('should have nothing to save until something changes', () => {
    renderEdit();

    expect(screen.getByText('No changes yet')).toBeInTheDocument();
  });

  it('should show the recipe as text on Write, with Save on that tab too', async () => {
    const { user } = renderEdit();

    await user.click(writeTab());

    expect(ingredientsBox()).toHaveValue('500 g Chocolinas\nSalt');
    expect(methodBox()).toHaveValue('1. Mix the filling\n\n2. Build the layers');
    expect(saveButton()).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Next/ })).not.toBeInTheDocument();
  });

  it('should send the PUT body without any client-only key and hand the result over', async () => {
    const updated = recipe({ title: 'Chocotorta de la abuela' });
    answerRecipeWith(okResponse({ recipe: updated }));
    const { user, onClose, onSuccess } = renderEdit();
    await user.click(writeTab());
    await user.type(titleBox(), ' de la abuela');

    await user.click(saveButton());

    await waitFor(() => expect(onSuccess).toHaveBeenCalledWith(updated));
    const [[url, init]] = recipeCalls();
    expect(url).toBe('/api/recipes/recipe-1');
    expect(init.method).toBe('PUT');
    expect(JSON.parse(init.body)).toEqual({
      title: 'Chocotorta de la abuela',
      description: 'La clásica',
      imageUrl: COVER_URL,
      cookingTime: 30,
      prepTime: 10,
      servings: 12,
      difficulty: 'easy',
      caption: 'Better the next day',
      ingredients: [
        { name: 'Chocolinas', amount: '500', unit: 'g' },
        { name: 'Salt', amount: '', unit: 'to taste' },
      ],
      instructions: [
        { step: 1, description: 'Mix the filling' },
        { step: 2, description: 'Build the layers', image: STEP_URL },
      ],
    });
    expect(init.body).not.toMatch(/"id"|sourceText|confidence/);
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(mockShowSuccess).not.toHaveBeenCalled();
    expect(mockPush).not.toHaveBeenCalled();
  });

  it('should save the rows nobody touched as they were when a line is added on Write', async () => {
    // Units of the old form and of the seeds: the parser knows none of them
    const stored = [
      { name: 'eggs', amount: '2', unit: 'pieces' },
      { name: 'onion', amount: '1', unit: 'whole' },
      { name: 'olive oil', amount: '80', unit: 'ml' },
    ];
    answerRecipeWith(okResponse({ recipe: recipe() }));
    const { user } = renderEdit({ recipe: recipe({ ingredients: stored }) });
    await user.click(writeTab());

    await user.type(ingredientsBox(), '\n1 tsp salt');
    await user.click(saveButton());

    await waitFor(() => expect(recipeCalls()).toHaveLength(1));
    expect(JSON.parse(recipeCalls()[0][1].body).ingredients).toEqual([
      ...stored,
      { name: 'salt', amount: '1', unit: 'tsp' },
    ]);
  });

  it('should keep a step photo when the method is reworked as text', async () => {
    answerRecipeWith(okResponse({ recipe: recipe() }));
    const { user } = renderEdit();
    await user.click(writeTab());

    fireEvent.change(methodBox(), {
      target: { value: '1. Mix the filling\n\n2. Chill one hour\n\n3. Build the layers' },
    });
    await user.click(saveButton());

    await waitFor(() => expect(recipeCalls()).toHaveLength(1));
    expect(JSON.parse(recipeCalls()[0][1].body).instructions).toEqual([
      { step: 1, description: 'Mix the filling' },
      { step: 2, description: 'Chill one hour' },
      { step: 3, description: 'Build the layers', image: STEP_URL },
    ]);
  });

  it('should ask before discarding changes and keep editing on request', async () => {
    const { user, onClose } = renderEdit();
    await user.click(writeTab());
    await user.type(titleBox(), '!');

    await user.click(screen.getByRole('button', { name: 'Close' }));
    await user.click(screen.getByRole('button', { name: 'Keep editing' }));

    expect(onClose).not.toHaveBeenCalled();
    await waitFor(() =>
      expect(
        screen.queryByRole('dialog', { name: 'Discard your changes?' })
      ).not.toBeInTheDocument()
    );
    expect(titleBox()).toHaveValue('Chocotorta!');
  });

  it('should discard the changes when the author says so', async () => {
    const { user, onClose } = renderEdit();
    await user.click(writeTab());
    await user.type(titleBox(), '!');

    await user.click(screen.getByRole('button', { name: 'Close' }));
    await user.click(screen.getByRole('button', { name: 'Discard' }));

    expect(onClose).toHaveBeenCalledTimes(1);
    expect(mockShowInfo).not.toHaveBeenCalled();
  });

  it('should close an unchanged recipe without asking', async () => {
    const { user, onClose } = renderEdit();

    await user.click(screen.getByRole('button', { name: 'Close' }));

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('should never read or write a stored draft', async () => {
    jest.useFakeTimers();
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
    const storage = createStorage({ [USER_KEY]: storedDraft({ section: 'write' }) });
    renderEdit({ draftStorage: storage });
    const before = storage.data.get(USER_KEY);

    await user.click(writeTab());
    await user.type(titleBox(), '!');
    act(() => {
      jest.advanceTimersByTime(RECIPE_DRAFT_DEBOUNCE_MS);
    });

    expect(screen.queryByText(/Draft restored/)).not.toBeInTheDocument();
    expect(storage.data.get(USER_KEY)).toBe(before);
    jest.useRealTimers();
  });

  it('should not reset when the parent hands over a new object for the same recipe', async () => {
    const { user, rerender } = renderEdit();
    await user.click(writeTab());
    await user.type(titleBox(), '!');

    rerender({ recipe: recipe() });

    expect(titleBox()).toHaveValue('Chocotorta!');
  });

  it('should start from the other recipe when the key changes while open', () => {
    const { rerender } = renderEdit();

    rerender({ recipe: recipe({ id: 'recipe-2', title: 'Flan' }), resetKey: 'recipe-2:true' });

    expect(screen.getByRole('textbox', { name: 'Name of ingredient 1' })).toHaveValue('Chocolinas');
    expect(screen.getByRole('dialog', { name: 'Edit recipe' })).toBeInTheDocument();
  });

  it('should explain a failed save and stay open', async () => {
    answerRecipeWith(errorResponse(401, { error: 'Unauthorized' }));
    const { user, onClose } = renderEdit();
    await user.click(writeTab());
    await user.type(titleBox(), '!');

    await user.click(saveButton());

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Your session expired. Your changes are not saved - copy what you need before you log in again.'
    );
    expect(onClose).not.toHaveBeenCalled();
  });

  describe('Log in again', () => {
    const loginLink = () => screen.findByRole('link', { name: 'Log in again' });

    /** The author changed the title, and Save was refused: the session is gone */
    const refuseTheSave = async () => {
      answerRecipeWith(errorResponse(401, { error: 'Unauthorized' }));
      const view = renderEdit();
      await view.user.click(writeTab());
      await view.user.type(titleBox(), '!');
      await view.user.click(saveButton());
      return view;
    };

    it('should ask before the changes are lost and keep the link from leaving the page', async () => {
      const { onClose } = await refuseTheSave();

      const followed = fireEvent.click(await loginLink());

      expect(followed).toBe(false);
      expect(screen.getByRole('dialog', { name: 'Discard your changes?' })).toBeInTheDocument();
      expect(onClose).not.toHaveBeenCalled();
      expect(mockLogout).not.toHaveBeenCalled();
    });

    it('should keep the changes when the author stays', async () => {
      const { user, onClose } = await refuseTheSave();
      fireEvent.click(await loginLink());

      await user.click(screen.getByRole('button', { name: 'Keep editing' }));

      expect(onClose).not.toHaveBeenCalled();
      expect(mockPush).not.toHaveBeenCalled();
      expect(await screen.findByRole('textbox', { name: /^Title/ })).toHaveValue('Chocotorta!');
    });

    it('should end the refused session and go to the login page on Discard', async () => {
      const { user, onClose } = await refuseTheSave();
      fireEvent.click(await loginLink());

      await user.click(screen.getByRole('button', { name: 'Discard' }));

      expect(onClose).toHaveBeenCalledTimes(1);
      expect(mockLogout).toHaveBeenCalledTimes(1);
      expect(mockPush).toHaveBeenCalledWith('/auth');
    });

    it('should leave at once when nothing was changed', async () => {
      const { user, onClose, rerender } = renderEdit();
      mockUser = null;
      rerender({});
      const link = await loginLink();
      // jsdom can not follow a link
      link.addEventListener('click', (event) => event.preventDefault());

      await user.click(link);

      expect(onClose).toHaveBeenCalledTimes(1);
      expect(
        screen.queryByRole('dialog', { name: 'Discard your changes?' })
      ).not.toBeInTheDocument();
    });
  });
});
