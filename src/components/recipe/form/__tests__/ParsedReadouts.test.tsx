import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import { text } from '@/i18n/text';
import ParsedIngredientsReadout, { ingredientsSummary } from '../ParsedIngredientsReadout';
import ParsedStepsReadout, { stepsSummary } from '../ParsedStepsReadout';
import RecipePreviewDialog from '../RecipePreviewDialog';
import { toPayload } from '../toPayload';
import { renderWithTheme } from './editorHarness';
import { STEP_URL, makeValues } from './fixtures';

const row = (id: string, amount: string, unit: string, name: string) => ({
  id,
  amount,
  unit,
  name,
});

describe('ingredientsSummary', () => {
  it('should count one ingredient in the singular', () => {
    expect(ingredientsSummary([row('a', '2', 'units', 'huevos')], 0)).toEqual(
      text('recipeParser.readout.ingredients', { count: 1 })
    );
  });

  it('should skip blank rows and add what is left to check', () => {
    const rows = [row('a', '2', 'units', 'huevos'), row('b', '', '', 'sal'), row('c', '', '', '')];

    expect(ingredientsSummary(rows, 1)).toEqual(
      text('recipeParser.readout.ingredientsWithChecks', { count: 2, checks: 1 })
    );
  });
});

describe('ParsedIngredientsReadout', () => {
  it('should render nothing while there is nothing to read back', () => {
    const { container } = renderWithTheme(
      <ParsedIngredientsReadout rows={[row('a', '', '', '')]} checks={{}} onCheckRow={jest.fn()} />
    );

    expect(container).toBeEmptyDOMElement();
  });

  it('should print a row that is still being typed the way it will be published', () => {
    renderWithTheme(
      <ParsedIngredientsReadout
        rows={[row('a', '1,5', '', 'papas'), row('b', '', 'to taste', 'sal')]}
        checks={{}}
        onCheckRow={jest.fn()}
      />
    );

    const lines = screen.getAllByRole('listitem', { hidden: true }).map((item) => item.textContent);
    expect(lines).toEqual(['1.5 papas', 'sal, to taste']);
  });

  it('should name a doubtful row without a name in its button', async () => {
    const onCheckRow = jest.fn();
    renderWithTheme(
      <ParsedIngredientsReadout
        rows={[row('a', '500', 'g', '')]}
        checks={{ a: 'No ingredient name on this line' }}
        onCheckRow={onCheckRow}
      />
    );
    await userEvent.click(screen.getByRole('button', { name: '1 ingredient - 1 to check' }));

    await userEvent.click(
      screen.getByRole('button', { name: 'Check this ingredient on the next tab' })
    );

    expect(onCheckRow).toHaveBeenCalledWith('a');
    expect(screen.getByText('Check')).toBeInTheDocument();
    expect(screen.getByTestId('WarningAmberIcon')).toBeInTheDocument();
  });

  it('should close the rows again with the summary', async () => {
    renderWithTheme(
      <ParsedIngredientsReadout
        rows={[row('a', '2', 'units', 'huevos')]}
        checks={{}}
        onCheckRow={jest.fn()}
      />
    );
    const summary = screen.getByRole('button', { name: '1 ingredient' });
    await userEvent.click(summary);

    await userEvent.click(summary);

    expect(summary).toHaveAttribute('aria-expanded', 'false');
  });
});

describe('stepsSummary', () => {
  it('should count one step in the singular', () => {
    expect(stepsSummary([{ id: 'a', description: 'Mix', image: '' }])).toEqual(
      text('recipeParser.readout.steps', { count: 1 })
    );
  });

  it('should mention the photos that lost their paragraph', () => {
    const rows = [
      { id: 'a', description: 'Mix', image: '' },
      { id: 'b', description: 'Bake', image: '' },
      { id: 'c', description: '', image: STEP_URL },
    ];

    expect(stepsSummary(rows)).toEqual(
      text('recipeParser.readout.stepsWithOrphans', { count: 2, orphans: 1 })
    );
  });

  it('should count several orphaned photos in the plural', () => {
    const rows = [
      { id: 'a', description: '', image: STEP_URL },
      { id: 'b', description: ' ', image: STEP_URL },
    ];

    expect(stepsSummary(rows)).toEqual(
      text('recipeParser.readout.stepsWithOrphans', { count: 0, orphans: 2 })
    );
  });
});

describe('ParsedStepsReadout', () => {
  it('should render nothing for the blank step of an empty form', () => {
    const { container } = renderWithTheme(
      <ParsedStepsReadout rows={[{ id: 'a', description: '', image: '' }]} />
    );

    expect(container).toBeEmptyDOMElement();
  });

  it('should print the first line of every written step and skip the photo-only ones', () => {
    renderWithTheme(
      <ParsedStepsReadout
        rows={[
          { id: 'a', description: 'Mix the filling\nslowly', image: '' },
          { id: 'b', description: '', image: STEP_URL },
        ]}
      />
    );

    const items = screen.getAllByRole('listitem', { hidden: true });
    expect(items).toHaveLength(1);
    expect(items[0]).toHaveTextContent(/^1Mix the filling$/);
  });
});

describe('RecipePreviewDialog', () => {
  const originalMatchMedia = window.matchMedia;
  afterEach(() => {
    window.matchMedia = originalMatchMedia;
  });

  const renderPreview = () =>
    renderWithTheme(
      <RecipePreviewDialog
        open
        onClose={jest.fn()}
        payload={toPayload(makeValues(), 'create')}
        onEditSection={jest.fn()}
      />
    );

  it('should be a small dialog on a wide screen', () => {
    renderPreview();

    expect(screen.getByRole('dialog', { name: 'Preview' })).not.toHaveClass(
      'MuiDialog-paperFullScreen'
    );
  });

  it('should be a full-screen sheet on a phone', () => {
    window.matchMedia = jest.fn().mockImplementation((query: string) => ({
      matches: query.includes('max-width:599.95px'),
      media: query,
      onchange: null,
      addListener: jest.fn(),
      removeListener: jest.fn(),
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
      dispatchEvent: jest.fn(),
    }));

    renderPreview();

    expect(screen.getByRole('dialog', { name: 'Preview' })).toHaveClass(
      'MuiDialog-paperFullScreen'
    );
  });
});
