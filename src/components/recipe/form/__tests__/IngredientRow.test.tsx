import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import { text } from '@/i18n/text';
import { RECIPE_UNITS } from '@/lib/constants';
import IngredientRow, { filterUnitOptions, IngredientRowProps } from '../IngredientRow';
import { renderWithTheme } from './editorHarness';

const UNITS = [...RECIPE_UNITS];

const renderRow = (props: Partial<IngredientRowProps> = {}) => {
  const handlers = {
    onChange: jest.fn(),
    onRowBlur: jest.fn(),
    onRemove: jest.fn(),
    onNameEnter: jest.fn(),
    onEmptyBackspace: jest.fn(),
  };
  renderWithTheme(
    <IngredientRow
      row={{ id: 'i1', name: 'Flour', amount: '200', unit: 'g' }}
      index={1}
      {...handlers}
      {...props}
    />
  );
  return { ...handlers, user: userEvent.setup() };
};

describe('filterUnitOptions', () => {
  it('should return every unit while nothing is typed', () => {
    expect(filterUnitOptions(UNITS, '  ')).toEqual(UNITS);
  });

  it('should put the exact unit first', () => {
    expect(filterUnitOptions(UNITS, 'g')[0]).toBe('g');
  });

  it('should ignore case so a typed l finds litres before pounds', () => {
    expect(filterUnitOptions(UNITS, 'l').slice(0, 2)).toEqual(['L', 'lb']);
  });

  it('should rank units that start with the text before units that contain it', () => {
    expect(filterUnitOptions(UNITS, 'k')[0]).toBe('kg');
  });

  it('should match the expanded name of a unit', () => {
    expect(filterUnitOptions(UNITS, 'gram')).toEqual(['g', 'kg']);
  });

  it('should find a unit by the start of its expanded name', () => {
    expect(filterUnitOptions(UNITS, 'whole')).toEqual(['units']);
  });

  it('should keep the list order among equal matches', () => {
    expect(filterUnitOptions(UNITS, 't').slice(0, 3)).toEqual(['tsp', 'tbsp', 'to taste']);
  });

  it('should return nothing for text that matches no unit', () => {
    expect(filterUnitOptions(UNITS, 'zzz')).toEqual([]);
  });

  it('should match a legacy unit that has no expanded name', () => {
    expect(filterUnitOptions([...UNITS, 'pieces'], 'pie')).toEqual(['pieces']);
  });
});

describe('IngredientRow', () => {
  it('should name its controls after its position', () => {
    renderRow();

    expect(screen.getByRole('group', { name: 'Ingredient 2' })).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'Amount for ingredient 2' })).toHaveValue('200');
    expect(screen.getByRole('combobox', { name: 'Unit for ingredient 2' })).toHaveValue('g');
    expect(screen.getByRole('textbox', { name: 'Name of ingredient 2' })).toHaveValue('Flour');
  });

  it('should carry its row id in the DOM for the focus hand-off', () => {
    renderRow();

    expect(screen.getByRole('group', { name: 'Ingredient 2' })).toHaveAttribute(
      'data-row-id',
      'i1'
    );
  });

  it('should be removable by default', async () => {
    const { user, onRemove } = renderRow();

    await user.click(screen.getByRole('button', { name: 'Remove ingredient 2: Flour' }));

    expect(onRemove).toHaveBeenCalledWith('i1');
  });

  it('should report edits as patches addressed by row id', async () => {
    const { user, onChange } = renderRow({ row: { id: 'i1', name: '', amount: '', unit: '' } });

    await user.type(screen.getByRole('textbox', { name: 'Name of ingredient 2' }), 'S');

    expect(onChange).toHaveBeenCalledWith('i1', { name: 'S' });
  });

  it('should report the row blur once, when focus leaves the row', async () => {
    const { user, onRowBlur } = renderRow();
    await user.click(screen.getByRole('textbox', { name: 'Amount for ingredient 2' }));
    await user.tab();
    expect(onRowBlur).not.toHaveBeenCalled();

    await user.click(document.body);

    expect(onRowBlur).toHaveBeenCalledTimes(1);
    expect(onRowBlur).toHaveBeenCalledWith('i1');
  });

  it('should mark each failing field and describe all three with the first message', () => {
    renderRow({
      unitError: text('recipeForm.issues.ingredientUnitTooLong', {
        named: 'yes',
        name: 'Flour',
        position: 2,
        max: 50,
      }),
    });

    const unit = screen.getByRole('combobox', { name: 'Unit for ingredient 2' });
    expect(unit).toHaveAttribute('aria-invalid', 'true');
    expect(unit).toHaveAccessibleDescription('Flour: the unit is 50 characters at most');
    expect(screen.getByRole('textbox', { name: 'Name of ingredient 2' })).toHaveAttribute(
      'aria-invalid',
      'false'
    );
  });

  it('should describe the fields with a note and mark it with an icon', () => {
    renderRow({ note: text('recipeParser.reasons.unknownContainer', { word: 'lata' }) });

    const name = screen.getByRole('textbox', { name: 'Name of ingredient 2' });
    expect(name).toHaveAccessibleDescription('No unit recognised - is "lata" part of the name?');
    expect(name).toHaveAttribute('aria-invalid', 'false');
    expect(screen.getByTestId('WarningAmberIcon')).toBeInTheDocument();
  });

  it('should show the error instead of the note while the row is failing', () => {
    renderRow({
      note: text('recipeParser.reasons.numberInName'),
      nameError: text('recipeForm.issues.ingredientNameRequired', { position: 2 }),
    });

    expect(
      screen.queryByText('The name still holds a number - is the amount right?')
    ).not.toBeInTheDocument();
    expect(screen.getByText('Ingredient 2: add a name, or clear the row')).toBeInTheDocument();
  });

  it('should ignore Shift+Enter in the name', async () => {
    const { user, onNameEnter } = renderRow();
    await user.click(screen.getByRole('textbox', { name: 'Name of ingredient 2' }));

    await user.keyboard('{Shift>}{Enter}{/Shift}');

    expect(onNameEnter).not.toHaveBeenCalled();
  });

  it('should leave other keys in the unit to the list', async () => {
    const { user } = renderRow();
    await user.click(screen.getByRole('combobox', { name: 'Unit for ingredient 2' }));

    await user.keyboard('{ArrowDown}');

    expect(screen.getByRole('combobox', { name: 'Unit for ingredient 2' })).toHaveFocus();
  });
});
