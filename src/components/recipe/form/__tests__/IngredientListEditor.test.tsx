import { act, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import { UNIT_TO_TASTE } from '@/lib/constants';
import IngredientListEditor, { IngredientListEditorProps } from '../IngredientListEditor';
import { RecipeFormValuesInput } from '../types';
import { renderEditor, renderWithTheme, settlePointer } from './editorHarness';
import { makeRecipe, makeValues } from './fixtures';

type EditorProps = Omit<IngredientListEditorProps, 'form' | 'registerField'>;

const renderList = (
  props: EditorProps = {},
  options: { values?: RecipeFormValuesInput; initial?: ReturnType<typeof makeRecipe> } = {}
) =>
  renderEditor(
    (form, registry) => (
      <>
        <IngredientListEditor form={form} registerField={registry.registerField} {...props} />
        <button type="button">Outside</button>
      </>
    ),
    options
  );

/** Chocolinas 500 g, Dulce de leche 400 g, then the engine's blank row */
const renderFilled = (props: EditorProps = {}) => renderList(props, { values: makeValues() });

const amount = (n: number) => screen.getByRole('textbox', { name: `Amount for ingredient ${n}` });
const unit = (n: number) => screen.getByRole('combobox', { name: `Unit for ingredient ${n}` });
const name = (n: number) => screen.getByRole('textbox', { name: `Name of ingredient ${n}` });
const row = (n: number) => screen.getByRole('group', { name: `Ingredient ${n}` });
const addButton = () => screen.getByRole('button', { name: 'Add ingredient' });
const outside = () => screen.getByRole('button', { name: 'Outside' });
/** Clicks outside the list and lets the deferred row validation land */
const leaveRow = async (user: ReturnType<typeof userEvent.setup>) => {
  await user.click(outside());
  await settlePointer();
};

describe('IngredientListEditor', () => {
  afterEach(() => {
    delete (window as any).matchMedia;
  });

  describe('rendering', () => {
    it('should start with one blank row inside a group named Ingredients', () => {
      renderList();

      const list = screen.getByRole('group', { name: 'Ingredients' });
      expect(within(list).getAllByRole('group', { name: /^Ingredient \d+$/ })).toHaveLength(1);
    });

    it('should name every control of a row, the unit combobox included', () => {
      renderList();

      expect(amount(1)).toBeInTheDocument();
      expect(unit(1)).toBeInTheDocument();
      expect(name(1)).toBeInTheDocument();
    });

    it('should keep the published reading order amount, unit, name in the DOM', () => {
      renderList();

      const fields = Array.from(row(1).querySelectorAll('input'));
      expect(fields).toEqual([amount(1), unit(1), name(1)]);
    });

    it('should take its name from the section heading when given one', () => {
      renderEditor((form) => (
        <>
          <h2 id="ingredients-heading">What you need</h2>
          <IngredientListEditor form={form} labelledBy="ingredients-heading" />
        </>
      ));

      expect(screen.getByRole('group', { name: 'What you need' })).toBeInTheDocument();
    });

    it('should explain the to taste model in one caption line', () => {
      renderList();

      expect(
        screen.getByText('No exact amount? Leave amount and unit empty - it shows as to taste.')
      ).toBeInTheDocument();
    });

    it('should draw its own outlined surface', () => {
      const { container } = renderList();

      expect(container.querySelector('.MuiPaper-outlined')).toBeInTheDocument();
    });

    it('should show nothing in error at rest', () => {
      renderFilled();

      const fields = [...screen.getAllByRole('textbox'), ...screen.getAllByRole('combobox')];
      fields.forEach((field) => expect(field).toHaveAttribute('aria-invalid', 'false'));
    });

    it('should not offer to remove the trailing blank row', () => {
      renderFilled();

      expect(within(row(3)).queryByRole('button', { name: /^Remove/ })).not.toBeInTheDocument();
    });

    it('should hint the keyboards of the amount and name fields', () => {
      renderList();

      expect(amount(1)).toHaveAttribute('inputmode', 'decimal');
      expect(name(1)).toHaveAttribute('autocapitalize', 'none');
      expect(name(1)).toHaveAttribute('maxlength', '200');
    });
  });

  describe('continuous entry', () => {
    it('should keep one blank row at the end while the author types', async () => {
      const { user, form } = renderList();

      await user.type(name(1), 'Flour');

      expect(form().values.ingredients).toHaveLength(2);
      expect(name(2)).toHaveValue('');
    });

    it('should move from amount to unit on Enter', async () => {
      const { user } = renderList();
      await user.type(amount(1), '2');

      await user.keyboard('{Enter}');

      expect(unit(1)).toHaveFocus();
    });

    it('should move from an untouched unit to the name on Enter', async () => {
      const { user, form } = renderList();
      await user.click(unit(1));

      await user.keyboard('{Enter}');

      expect(name(1)).toHaveFocus();
      expect(form().values.ingredients[0].unit).toBe('');
    });

    it('should move from the name to the amount of the next row on Enter', async () => {
      const { user } = renderList();
      await user.type(name(1), 'Flour');

      await user.keyboard('{Enter}');

      expect(amount(2)).toHaveFocus();
    });

    it('should move to Add ingredient on Enter in the last blank name', async () => {
      const { user } = renderList();
      await user.click(name(1));

      await user.keyboard('{Enter}');

      expect(addButton()).toHaveFocus();
    });

    it('should enter a whole ingredient without leaving the keyboard', async () => {
      const { user, form } = renderList();
      await user.click(amount(1));

      await user.keyboard('2{Enter}cup{Enter}Flour{Enter}');

      expect(form().values.ingredients[0]).toMatchObject({
        amount: '2',
        unit: 'cups',
        name: 'Flour',
      });
      expect(amount(2)).toHaveFocus();
    });
  });

  describe('unit', () => {
    it('should pick the unit that was typed when tabbing away', async () => {
      const { user, form } = renderList();
      await user.click(unit(1));

      await user.keyboard('g');
      await user.tab();

      expect(form().values.ingredients[0].unit).toBe('g');
      expect(name(1)).toHaveFocus();
    });

    it('should not pick a unit when tabbing through an untouched field', async () => {
      const { user, form } = renderList();
      await user.click(amount(1));

      await user.tab();
      await user.tab();

      expect(name(1)).toHaveFocus();
      expect(form().values.ingredients[0].unit).toBe('');
    });

    it('should list the units with their expanded names', async () => {
      const { user } = renderList();

      await user.click(unit(1));

      expect(screen.getByRole('option', { name: 'g - grams' })).toBeInTheDocument();
      expect(screen.getByRole('option', { name: 'cups' })).toBeInTheDocument();
    });

    it('should pick a unit with the pointer', async () => {
      const { user, form } = renderList();
      await user.click(unit(1));

      await user.click(screen.getByRole('option', { name: 'tbsp - tablespoons' }));

      expect(form().values.ingredients[0].unit).toBe('tbsp');
    });

    it('should move on to the name with Enter after a pointer pick', async () => {
      const { user } = renderList();
      await user.click(unit(1));
      await user.click(screen.getByRole('option', { name: 'tbsp - tablespoons' }));

      await user.keyboard('{Enter}');

      expect(name(1)).toHaveFocus();
    });

    it('should not accept free text', async () => {
      const { user, form } = renderList();
      await user.click(unit(1));

      await user.keyboard('zzz');
      await user.tab();

      expect(form().values.ingredients[0].unit).toBe('');
      expect(unit(1)).toHaveValue('');
    });

    it('should clear the unit when its text is emptied', async () => {
      const { user, form } = renderFilled();

      await user.clear(unit(1));

      expect(form().values.ingredients[0].unit).toBe('');
    });

    it('should keep a stored legacy unit selectable in its own row', async () => {
      const values = makeValues({
        ingredients: [{ id: 'i1', name: 'Eggs', amount: '2', unit: 'pieces' }],
      });
      const { user } = renderList({}, { values });

      expect(unit(1)).toHaveValue('pieces');
      await user.click(unit(1));

      expect(screen.getByRole('option', { name: 'pieces' })).toBeInTheDocument();
    });

    it('should open the list without a virtual keyboard on a coarse pointer', () => {
      window.matchMedia = jest.fn().mockImplementation((query: string) => ({
        matches: query === '(pointer: coarse)',
        media: query,
        addEventListener: jest.fn(),
        removeEventListener: jest.fn(),
        addListener: jest.fn(),
        removeListener: jest.fn(),
      })) as any;

      renderList();

      expect(unit(1)).toHaveAttribute('inputmode', 'none');
    });

    it('should leave the keyboard alone on a fine pointer', () => {
      renderList();

      expect(unit(1)).not.toHaveAttribute('inputmode');
    });
  });

  describe('to taste', () => {
    it('should show one to taste chip once focus leaves a named row without amount', async () => {
      const { user } = renderList();
      await user.type(name(1), 'Salt');

      await leaveRow(user);

      const chip = within(row(1)).getByRole('button', {
        name: 'Salt is to taste - set an amount',
      });
      expect(chip).toHaveTextContent('to taste');
      expect(screen.queryByRole('textbox', { name: 'Amount for ingredient 1' })).toBeNull();
    });

    it('should keep the inputs while the author is still in the row', async () => {
      const { user } = renderList();

      await user.type(name(1), 'Salt');

      expect(amount(1)).toBeInTheDocument();
    });

    it('should bring the inputs back and focus the amount when the chip is activated', async () => {
      const { user } = renderList();
      await user.type(name(1), 'Salt');
      await leaveRow(user);

      await user.click(screen.getByRole('button', { name: 'Salt is to taste - set an amount' }));

      expect(amount(1)).toHaveFocus();
      expect(unit(1)).toBeInTheDocument();
    });

    it('should activate the chip with the keyboard', async () => {
      const { user } = renderList();
      await user.type(name(1), 'Salt');
      await leaveRow(user);
      screen.getByRole('button', { name: 'Salt is to taste - set an amount' }).focus();

      await user.keyboard('{Enter}');

      expect(amount(1)).toHaveFocus();
    });

    it('should keep the chip while focus only rests on it', async () => {
      const { user } = renderList();
      await user.type(name(1), 'Salt');
      await leaveRow(user);

      act(() => screen.getByRole('button', { name: 'Salt is to taste - set an amount' }).focus());

      expect(
        screen.getByRole('button', { name: 'Salt is to taste - set an amount' })
      ).toHaveFocus();
    });

    it('should bring the inputs back when the name is edited again', async () => {
      const { user } = renderList();
      await user.type(name(1), 'Salt');
      await leaveRow(user);

      await user.click(name(1));

      expect(amount(1)).toBeInTheDocument();
    });

    it('should return to the chip when the author leaves without an amount', async () => {
      const { user } = renderList();
      await user.type(name(1), 'Salt');
      await leaveRow(user);
      await user.click(screen.getByRole('button', { name: 'Salt is to taste - set an amount' }));

      await leaveRow(user);

      expect(
        screen.getByRole('button', { name: 'Salt is to taste - set an amount' })
      ).toBeInTheDocument();
    });

    it('should treat the to taste unit as the same state', async () => {
      const { user, form } = renderList();
      await user.type(amount(1), '2');
      await user.type(name(1), 'Salt');
      await user.click(unit(1));

      await user.click(screen.getByRole('option', { name: 'to taste - no exact amount' }));
      await leaveRow(user);

      expect(
        screen.getByRole('button', { name: 'Salt is to taste - set an amount' })
      ).toBeInTheDocument();
      expect(form().toPayload().ingredients[0]).toEqual({
        name: 'Salt',
        amount: '',
        unit: UNIT_TO_TASTE,
      });
    });

    it('should show a stored to taste ingredient as a chip when editing', () => {
      renderList({}, { initial: makeRecipe() });

      expect(
        screen.getByRole('button', { name: 'Salt is to taste - set an amount' })
      ).toBeInTheDocument();
    });
  });

  describe('row blur', () => {
    it('should fill in units when an amount has no unit', async () => {
      const { user } = renderList();
      await user.type(amount(1), '2');
      await user.type(name(1), 'Eggs');

      await leaveRow(user);

      expect(unit(1)).toHaveValue('units');
    });

    it('should normalise the amount', async () => {
      const { user } = renderList();
      await user.type(amount(1), '1,5');
      await user.type(name(1), 'Milk');

      await leaveRow(user);

      expect(amount(1)).toHaveValue('1.5');
    });

    it('should not validate while focus moves inside the row', async () => {
      const { user } = renderList();
      await user.click(unit(1));
      await user.click(screen.getByRole('option', { name: 'g - grams' }));

      await user.type(name(1), 'F');

      expect(amount(1)).not.toHaveAttribute('aria-invalid', 'true');
      expect(unit(1)).not.toHaveAttribute('aria-invalid', 'true');
    });

    it('should name the ingredient and the fix once focus leaves the row', async () => {
      const { user } = renderList();
      await user.click(unit(1));
      await user.click(screen.getByRole('option', { name: 'g - grams' }));
      await user.type(name(1), 'Flour');

      await leaveRow(user);

      expect(amount(1)).toHaveAttribute('aria-invalid', 'true');
      expect(amount(1)).toHaveAccessibleDescription(
        'Flour: add an amount, or clear the unit for to taste'
      );
    });

    it('should clear the row error when the amount is typed', async () => {
      const { user } = renderList();
      await user.click(unit(1));
      await user.click(screen.getByRole('option', { name: 'g - grams' }));
      await user.type(name(1), 'Flour');
      await leaveRow(user);

      await user.type(amount(1), '200');

      expect(amount(1)).not.toHaveAttribute('aria-invalid', 'true');
      expect(amount(1)).not.toHaveAccessibleDescription();
    });

    it('should flag a row that has an amount but no name', async () => {
      const { user } = renderList();
      await user.type(amount(1), '2');

      await leaveRow(user);

      expect(name(1)).toHaveAttribute('aria-invalid', 'true');
      expect(name(1)).toHaveAccessibleDescription('Ingredient 1: add a name, or clear the row');
    });

    it('should validate at once when the row is left with the keyboard', async () => {
      const { user } = renderList();
      await user.type(amount(1), '2');

      // unit -> name -> Remove -> the next row
      await user.tab();
      await user.tab();
      await user.tab();
      await user.tab();

      expect(amount(2)).toHaveFocus();
      expect(name(1)).toHaveAttribute('aria-invalid', 'true');
    });

    it('should not grow the row under a pointer that is still pressed', async () => {
      const { user } = renderList();
      await user.type(amount(1), '2');

      await user.pointer({ keys: '[MouseLeft>]', target: addButton() });

      expect(addButton()).toHaveFocus();
      expect(name(1)).toHaveAttribute('aria-invalid', 'false');
    });

    it('should validate the row once that press is released', async () => {
      const { user } = renderList();
      await user.type(amount(1), '2');
      await user.pointer({ keys: '[MouseLeft>]', target: outside() });

      await user.pointer({ keys: '[/MouseLeft]', target: outside() });
      await settlePointer();

      expect(name(1)).toHaveAttribute('aria-invalid', 'true');
    });
  });

  describe('errors', () => {
    it('should show the list error after a failed publish', () => {
      const { form } = renderList();

      act(() => {
        form().validate();
      });

      expect(screen.getByText('Add at least one ingredient')).toBeInTheDocument();
      expect(screen.getByRole('group', { name: 'Ingredients' })).toHaveAccessibleDescription(
        'Add at least one ingredient'
      );
    });

    it('should show a row note on the row it belongs to', () => {
      renderFilled({ rowNotes: { i2: 'No unit recognised - is "dulce" part of the name?' } });

      expect(within(row(2)).getByText(/is "dulce" part of the name/)).toBeInTheDocument();
      expect(within(row(1)).queryByText(/part of the name/)).not.toBeInTheDocument();
    });

    it('should show the name counter from 80% of the limit', () => {
      const values = makeValues({
        ingredients: [{ id: 'i1', name: 'x'.repeat(160), amount: '1', unit: 'g' }],
      });

      renderList({}, { values });

      expect(screen.getByText('160/200')).toBeInTheDocument();
    });
  });

  describe('remove', () => {
    it('should name the remove button after the ingredient', () => {
      renderFilled();

      expect(
        screen.getByRole('button', { name: 'Remove ingredient 1: Chocolinas' })
      ).toBeInTheDocument();
    });

    it('should name the remove button of an unnamed row by its position', () => {
      const values = makeValues({
        ingredients: [
          { id: 'i1', name: '', amount: '2', unit: 'g' },
          { id: 'i2', name: 'Salt', amount: '', unit: '' },
        ],
      });

      renderList({}, { values });

      expect(screen.getByRole('button', { name: 'Remove ingredient 1' })).toBeInTheDocument();
    });

    it('should remove the row and hand focus to the next remove button', async () => {
      const { user, form } = renderFilled();

      await user.click(screen.getByRole('button', { name: 'Remove ingredient 1: Chocolinas' }));

      expect(form().values.ingredients.map((r) => r.name)).toEqual(['Dulce de leche', '']);
      expect(
        screen.getByRole('button', { name: 'Remove ingredient 1: Dulce de leche' })
      ).toHaveFocus();
    });

    it('should hand focus to the previous row when the last filled row is removed', async () => {
      const { user } = renderFilled();

      await user.click(screen.getByRole('button', { name: 'Remove ingredient 2: Dulce de leche' }));

      expect(screen.getByRole('button', { name: 'Remove ingredient 1: Chocolinas' })).toHaveFocus();
    });

    it('should hand focus to Add ingredient when no filled row is left', async () => {
      const values = makeValues({
        ingredients: [{ id: 'i1', name: 'Salt', amount: '', unit: '' }],
      });
      const { user } = renderList({}, { values });

      await user.click(screen.getByRole('button', { name: 'Remove ingredient 1: Salt' }));

      expect(addButton()).toHaveFocus();
    });

    it('should announce the removal politely', async () => {
      const { user } = renderFilled();

      await user.click(screen.getByRole('button', { name: 'Remove ingredient 1: Chocolinas' }));

      expect(screen.getByRole('status')).toHaveTextContent('Ingredient 1 removed');
    });

    it('should announce a second identical removal as a new message', async () => {
      const { user } = renderFilled();
      await user.click(screen.getByRole('button', { name: 'Remove ingredient 1: Chocolinas' }));

      await user.click(screen.getByRole('button', { name: 'Remove ingredient 1: Dulce de leche' }));

      expect(screen.getByRole('status').textContent).toBe('Ingredient 1 removed ');
    });
  });

  describe('backspace', () => {
    it('should remove an empty row and go back to the previous name', async () => {
      const { user, form } = renderFilled();
      await user.click(amount(3));

      await user.keyboard('{Backspace}');

      expect(name(2)).toHaveFocus();
      expect(form().values.ingredients).toHaveLength(3);
    });

    it('should put the caret after the previous name', async () => {
      const { user } = renderFilled();
      await user.click(amount(3));

      await user.keyboard('{Backspace}');

      expect((name(2) as HTMLInputElement).selectionStart).toBe('Dulce de leche'.length);
    });

    it('should leave the only row alone', async () => {
      const { user, form } = renderList();
      const before = form().values.ingredients[0].id;
      await user.click(amount(1));

      await user.keyboard('{Backspace}');

      expect(form().values.ingredients[0].id).toBe(before);
      expect(amount(1)).toHaveFocus();
    });

    it('should continue in the next row when the first row was the empty one', async () => {
      const values = makeValues({
        ingredients: [
          { id: 'i1', name: '', amount: '', unit: '' },
          { id: 'i2', name: 'Salt', amount: '1', unit: 'pinch' },
        ],
      });
      const { user, form } = renderList({}, { values });
      await user.click(amount(1));

      await user.keyboard('{Backspace}');

      expect(form().values.ingredients[0].name).toBe('Salt');
      expect(amount(1)).toHaveFocus();
      expect(screen.getByRole('status')).toHaveTextContent('Ingredient 1 removed');
    });

    it('should not remove a row that still has a name', async () => {
      const values = makeValues({
        ingredients: [{ id: 'i1', name: 'Salt', amount: '', unit: '' }],
      });
      const { user, form } = renderList({}, { values });
      await user.click(name(1));
      await user.click(amount(1));

      await user.keyboard('{Backspace}');

      expect(form().values.ingredients[0].name).toBe('Salt');
    });
  });

  describe('add', () => {
    it('should focus the amount of the new row', async () => {
      const { user } = renderFilled();

      await user.click(addButton());

      expect(amount(3)).toHaveFocus();
    });

    it('should announce the new row politely', async () => {
      const { user } = renderFilled();

      await user.click(addButton());

      expect(screen.getByRole('status')).toHaveTextContent('Ingredient 3 added');
    });

    it('should stay put when the engine refuses a row', async () => {
      const form: IngredientListEditorProps['form'] = {
        values: makeValues(),
        errors: {},
        touch: jest.fn(),
        ingredients: {
          canAdd: true,
          add: jest.fn().mockReturnValue(null),
          remove: jest.fn(),
          update: jest.fn(),
          restore: jest.fn(),
          replaceAll: jest.fn(),
        },
      };
      const user = userEvent.setup();
      renderWithTheme(<IngredientListEditor form={form} />);

      await user.click(addButton());

      expect(addButton()).toHaveFocus();
      expect(screen.getByRole('status')).toBeEmptyDOMElement();
    });

    it('should disable Add ingredient with a caption when the list is full', () => {
      const form: IngredientListEditorProps['form'] = {
        values: makeValues(),
        errors: {},
        touch: jest.fn(),
        ingredients: {
          canAdd: false,
          add: jest.fn().mockReturnValue(null),
          remove: jest.fn(),
          update: jest.fn(),
          restore: jest.fn(),
          replaceAll: jest.fn(),
        },
      };

      renderWithTheme(<IngredientListEditor form={form} />);

      expect(addButton()).toBeDisabled();
      expect(screen.getByText('100 ingredients is the most a recipe can have')).toBeInTheDocument();
    });
  });

  describe('disabled', () => {
    it('should disable every control while the form is submitting', () => {
      renderFilled({ disabled: true });

      expect(amount(1)).toBeDisabled();
      expect(unit(1)).toBeDisabled();
      expect(name(1)).toBeDisabled();
      expect(
        screen.getByRole('button', { name: 'Remove ingredient 1: Chocolinas' })
      ).toBeDisabled();
      expect(addButton()).toBeDisabled();
    });

    it('should disable the to taste chip too', () => {
      renderList({ disabled: true }, { initial: makeRecipe() });

      expect(
        screen.getByRole('button', { name: 'Salt is to taste - set an amount' })
      ).toHaveAttribute('aria-disabled', 'true');
    });
  });

  describe('focus by path', () => {
    it('should send a list-level issue to the first control of the list', () => {
      const { form, registry } = renderList();
      let path = '';
      act(() => {
        path = form()
          .validate()
          .find((issue) => issue.section === 'ingredients')!.path;
      });

      act(() => {
        registry().focusField(path);
      });

      expect(path).toBe('ingredients');
      expect(amount(1)).toHaveFocus();
    });

    it('should focus the to taste chip when the first row shows one', () => {
      const values = makeValues({
        ingredients: [{ id: 'i1', name: 'Salt', amount: '', unit: '' }],
      });
      const { registry } = renderList({}, { values });

      act(() => {
        registry().focusField('ingredients');
      });

      expect(
        screen.getByRole('button', { name: 'Salt is to taste - set an amount' })
      ).toHaveFocus();
    });

    it.each([
      ['amount', amount],
      ['unit', unit],
      ['name', name],
    ])('should focus the %s of a row by its engine path', (field, getField) => {
      const { registry } = renderFilled();

      act(() => {
        registry().focusField(`ingredients.i2.${field}`);
      });

      expect(getField(2)).toHaveFocus();
    });

    it('should unregister the list when it unmounts', () => {
      const { registry, unmount } = renderFilled();
      const focusField = registry().focusField;

      unmount();

      expect(focusField('ingredients')).toBe(false);
    });
  });
});
