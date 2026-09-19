import { ThemeProvider, createTheme } from '@mui/material/styles';
import { act, render } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { Recipe } from '@/domain/types/recipe';
import { RecipeFormValuesInput } from '../types';
import { FieldRegistry, useFieldRegistry } from '../useFieldRegistry';
import { RecipeFormApi, useRecipeForm } from '../useRecipeForm';

/**
 * Mounts an editor on the REAL engine (the only thing these tests mock is the network),
 * inside a <form> like every shell does, and hands back the latest engine state.
 */

const theme = createTheme();

/**
 * One false positive is filtered out of console.error, for the files that import this
 * harness. The editors move focus inside an effect (add / move a row). user-event patches
 * `element.focus()` to dispatch through Testing Library's `act`, so that focus() re-enters
 * `act` while React is still flushing the outer one, and React 19 reports the unfinished
 * queue as "A component suspended inside an `act` scope" - nothing suspends, and the
 * assertions that follow (focus landed, state updated) prove the queue did flush.
 */
const FOCUS_IN_EFFECT_FALSE_POSITIVE = 'A component suspended inside an `act` scope';
let consoleError: typeof console.error;

beforeAll(() => {
  consoleError = console.error;
  console.error = (...args: unknown[]) => {
    const [first] = args;
    if (typeof first === 'string' && first.includes(FOCUS_IN_EFFECT_FALSE_POSITIVE)) return;
    consoleError.call(console, ...args);
  };
});

afterAll(() => {
  console.error = consoleError;
});

interface HarnessOptions {
  /** Edit mode: the recipe to prefill from */
  initial?: Recipe;
  /** Values loaded right after mount (what a restored draft does) */
  values?: RecipeFormValuesInput;
}

type RenderEditor = (form: RecipeFormApi, registry: FieldRegistry) => React.ReactElement;

export function renderEditor(renderUi: RenderEditor, { initial, values }: HarnessOptions = {}) {
  const latest: { form?: RecipeFormApi; registry?: FieldRegistry } = {};

  function Harness() {
    const form = useRecipeForm({ initial, resetKey: 'test' });
    const registry = useFieldRegistry();
    latest.form = form;
    latest.registry = registry;
    return (
      <form noValidate onSubmit={(event) => event.preventDefault()}>
        {renderUi(form, registry)}
      </form>
    );
  }

  const user = userEvent.setup();
  const view = render(
    <ThemeProvider theme={theme}>
      <Harness />
    </ThemeProvider>
  );
  if (values) act(() => latest.form!.load(values));

  return {
    ...view,
    user,
    /** The engine as of the last render */
    form: () => latest.form!,
    registry: () => latest.registry!,
  };
}

export const renderWithTheme = (ui: React.ReactElement) =>
  render(<ThemeProvider theme={theme}>{ui}</ThemeProvider>);
