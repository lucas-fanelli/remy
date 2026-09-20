import { ThemeProvider, createTheme } from '@mui/material/styles';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { renderWithLocale, setTestLocale } from '@/i18n/testing';
import { text } from '@/i18n/text';
import { parseIngredientLines } from '@/lib/utils/recipeText';
import AtAGlance from '../AtAGlance';
import CheckTab from '../CheckTab';
import DraftRestoredBar from '../DraftRestoredBar';
import FormStatus from '../FormStatus';
import IngredientRow from '../IngredientRow';
import ParsedIngredientsReadout from '../ParsedIngredientsReadout';
import PublishButton from '../PublishButton';
import { useTextCapture } from '../useTextCapture';
import { validateRecipe } from '../validateRecipe';
import WriteTab from '../WriteTab';
import { renderEditor } from './editorHarness';
import { makeValues } from './fixtures';
import type { RecipeFormApi } from '../useRecipeForm';

/**
 * The counterpart of the suites next door: those assert the ENGLISH copy and were not
 * rewritten by the migration, this one proves the very same editor speaks Spanish when the
 * locale says so - including the two things that are easy to get wrong, the sentences a PURE
 * function produces (validateRecipe, the free-text parser) and the ICU plurals.
 */

const theme = createTheme();

const inSpanish = (ui: React.ReactElement) =>
  renderWithLocale(
    (element) => render(<ThemeProvider theme={theme}>{element}</ThemeProvider>),
    'es',
    ui
  );

/** The real engine, in Spanish: the editors below are the ones the app mounts */
const editorInSpanish = (
  renderUi: (form: RecipeFormApi) => React.ReactElement,
  values = makeValues()
) => {
  setTestLocale('es');
  return renderEditor(renderUi, { values });
};

const noop = () => undefined;

function WriteTabHarness({ form }: { form: RecipeFormApi }) {
  const capture = useTextCapture(form);
  return <WriteTab form={form} capture={capture} onCheckRow={noop} />;
}

describe('the Write tab in Spanish', () => {
  it('should label the title and the two text boxes', () => {
    editorInSpanish((form) => <WriteTabHarness form={form} />);

    expect(screen.getByRole('textbox', { name: /^Título/ })).toBeInTheDocument();
    expect(screen.getByText('Ingredientes')).toBeInTheDocument();
    expect(screen.getByText('Preparación')).toBeInTheDocument();
    expect(screen.getByText('Uno por línea')).toBeInTheDocument();
    expect(
      screen.getByText('Un paso por párrafo - los números son opcionales')
    ).toBeInTheDocument();
  });

  it('should keep the Spanish hint examples the author types against', () => {
    editorInSpanish((form) => <WriteTabHarness form={form} />);

    // The parser's own language: these are what an author writes, not chrome
    expect(screen.getByPlaceholderText(/500 g harina/)).toBeInTheDocument();
    expect(screen.getByPlaceholderText('ej. Empanadas de carne')).toBeInTheDocument();
  });

  it('should count what it understood with the Spanish plural', () => {
    editorInSpanish((form) => <WriteTabHarness form={form} />);

    expect(screen.getAllByText('2 ingredientes')[0]).toBeInTheDocument();
    expect(screen.getAllByText('2 pasos')[0]).toBeInTheDocument();
  });
});

describe('the Check tab in Spanish', () => {
  it('should name its four sections', () => {
    editorInSpanish((form) => <CheckTab form={form} capture={{ checks: {}, confirmRow: noop }} />);

    expect(screen.getByRole('heading', { name: 'Ingredientes' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Pasos' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'De un vistazo' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Foto y descripción' })).toBeInTheDocument();
  });

  it('should label at a glance and its quick picks', () => {
    editorInSpanish((form) => <AtAGlance form={form} />);

    expect(screen.getByRole('textbox', { name: /^Tiempo de preparación/ })).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: /^Tiempo de cocción/ })).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: /^Porciones/ })).toBeInTheDocument();
    expect(screen.getByRole('group', { name: 'Tiempos de cocción sugeridos' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Más porciones' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Fácil' })).toBeInTheDocument();
  });

  it('should name an ingredient row and its controls by its position', () => {
    inSpanish(
      <IngredientRow
        row={{ id: 'i1', name: 'Harina', amount: '500', unit: 'g' }}
        index={1}
        onChange={noop}
        onRowBlur={noop}
        onRemove={noop}
        onNameEnter={noop}
        onEmptyBackspace={noop}
      />
    );

    expect(screen.getByRole('group', { name: 'Ingrediente 2' })).toBeInTheDocument();
    expect(screen.getByLabelText('Cantidad del ingrediente 2')).toBeInTheDocument();
    expect(screen.getByLabelText('Unidad del ingrediente 2')).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Eliminar el ingrediente 2: Harina' })
    ).toBeInTheDocument();
  });

  /** A row whose unit picker is on screen (a named row with an amount is never 'to taste') */
  const unitRowInSpanish = (unit: string) => {
    const user = userEvent.setup();
    const onChange = jest.fn();
    inSpanish(
      <IngredientRow
        row={{ id: 'i1', name: 'Harina', amount: '2', unit }}
        index={0}
        onChange={onChange}
        onRowBlur={noop}
        onRemove={noop}
        onNameEnter={noop}
        onEmptyBackspace={noop}
      />
    );
    return { user, onChange, field: screen.getByLabelText('Unidad del ingrediente 1') };
  };

  it('should show the Spanish label of the stored unit in the field', () => {
    const { field } = unitRowInSpanish('cups');

    expect(field).toHaveValue('tazas');
  });

  it('should list every unit by its Spanish label, in the plural a list wants', async () => {
    const { user, field } = unitRowInSpanish('');

    await user.click(field);

    expect(screen.getByRole('option', { name: 'cda - cucharadas' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'unidades - unidades enteras' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'tazas' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'pizcas' })).toBeInTheDocument();
  });

  it('should store the English unit the picked Spanish option stands for', async () => {
    const { user, onChange, field } = unitRowInSpanish('');

    await user.click(field);
    await user.click(screen.getByRole('option', { name: 'tazas' }));

    expect(onChange).toHaveBeenCalledWith('i1', { unit: 'cups' });
  });

  it('should find a unit by the Spanish abbreviation the list itself shows', async () => {
    const { user, onChange, field } = unitRowInSpanish('');

    await user.click(field);
    await user.keyboard('cda');
    await user.tab();

    expect(onChange).toHaveBeenCalledWith('i1', { unit: 'tbsp' });
  });

  it('should translate the unit label of a to-taste row, never what is stored', () => {
    inSpanish(
      <IngredientRow
        row={{ id: 'i1', name: 'Sal', amount: '', unit: '' }}
        index={0}
        onChange={noop}
        onRowBlur={noop}
        onRemove={noop}
        onNameEnter={noop}
        onEmptyBackspace={noop}
      />
    );

    expect(screen.getByText('a gusto')).toBeInTheDocument();
    expect(screen.getByLabelText('Sal es a gusto - poné una cantidad')).toBeInTheDocument();
  });
});

describe('what a pure function says, in Spanish', () => {
  const statusFor = (issues: ReturnType<typeof validateRecipe>, publishAttempted: boolean) => (
    <FormStatus
      form={{ mode: 'create', issues, publishAttempted, uploadsInFlight: 0, isDirty: true }}
      goTo={noop}
    />
  );

  it('should count validateRecipe issues in Spanish', () => {
    const issues = validateRecipe(
      makeValues({ title: '', cookingTime: '', ingredients: [], steps: [] })
    );

    inSpanish(statusFor(issues, true));

    expect(screen.getByRole('button', { name: '4 cosas para corregir' })).toBeInTheDocument();
  });

  it('should name a single missing field in Spanish, in the singular', () => {
    const issues = validateRecipe(makeValues({ cookingTime: '' }));

    inSpanish(statusFor(issues, false));

    expect(screen.getByRole('button', { name: 'Falta: tiempo de cocción' })).toBeInTheDocument();
  });

  it('should spell out an issue in Spanish inside the menu', () => {
    const issues = validateRecipe(makeValues({ cookingTime: '' }));

    inSpanish(statusFor(issues, true));

    expect(screen.getByRole('button').textContent).toContain('1 cosa para corregir');
  });

  it('should count photos still on their way with the Spanish plural', () => {
    inSpanish(
      <FormStatus
        form={{
          mode: 'create',
          issues: [],
          publishAttempted: false,
          uploadsInFlight: 2,
          isDirty: true,
        }}
        goTo={noop}
      />
    );

    expect(screen.getByText('Esperando 2 fotos...')).toBeInTheDocument();
  });

  it("should show the parser's reason for a doubtful line in Spanish", () => {
    const [row] = parseIngredientLines('1 lata de tomate').rows;
    // The parser names the message; the readout is what turns it into a sentence
    expect(row.reason).toEqual(text('recipeParser.reasons.unknownContainer', { word: 'lata' }));

    inSpanish(
      <ParsedIngredientsReadout
        rows={[{ id: 'i1', name: 'lata de tomate', amount: '1', unit: 'units' }]}
        checks={{ i1: row.reason! }}
        onCheckRow={noop}
      />
    );

    expect(
      screen.getByText('No reconocimos la unidad - ¿"lata" es parte del nombre?')
    ).toBeInTheDocument();
    expect(screen.getAllByText('1 ingrediente - 1 para revisar').length).toBeGreaterThan(0);
    expect(screen.getByText('Revisar')).toBeInTheDocument();
  });

  it('should date a restored draft in Spanish', () => {
    const now = Date.UTC(2026, 0, 10, 12, 0, 0);

    inSpanish(
      <DraftRestoredBar savedAt={now - 10 * 60_000} now={now} onStartOver={noop} onDismiss={noop} />
    );

    expect(screen.getByText('Borrador restaurado de hace 10 min')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Empezar de nuevo' })).toBeInTheDocument();
  });
});

describe('the primary action in Spanish', () => {
  it.each([
    ['create' as const, 'Publicar receta'],
    ['edit' as const, 'Guardar cambios'],
  ])('should name the %s action in Spanish', (mode, label) => {
    inSpanish(<PublishButton mode={mode} onPublish={noop} />);

    expect(screen.getByRole('button', { name: label })).toBeInTheDocument();
  });

  it('should say it is publishing while the request is in flight', () => {
    inSpanish(<PublishButton mode="create" pending onPublish={noop} />);

    expect(screen.getByRole('button', { name: 'Publicando...' })).toBeInTheDocument();
  });
});
