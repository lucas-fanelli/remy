import { act, screen, within } from '@testing-library/react';
import '@testing-library/jest-dom';
import AtAGlance, { AtAGlanceProps } from '../AtAGlance';
import { renderEditor, renderWithTheme } from './editorHarness';
import { makeValues } from './fixtures';

const renderGlance = (props: { disabled?: boolean } = {}) =>
  renderEditor((form, registry) => (
    <AtAGlance form={form} registerField={registry.registerField} {...props} />
  ));

const prepField = () => screen.getByRole('textbox', { name: /^Prep time/ });
const cookField = () => screen.getByRole('textbox', { name: /^Cook time/ });
const servingsField = () => screen.getByRole('textbox', { name: /^Servings/ });
const prepPicks = () => screen.getByRole('group', { name: 'Quick pick prep time' });
const cookPicks = () => screen.getByRole('group', { name: 'Quick pick cook time' });
const difficulty = () => screen.getByRole('group', { name: 'Difficulty' });

describe('AtAGlance', () => {
  describe('rendering', () => {
    it('should lay the cells out in the order Prep, Cook, Servings, Difficulty', () => {
      renderGlance();

      const order = [prepField(), cookField(), servingsField(), difficulty()];
      const sorted = [...order].sort((a, b) =>
        a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1
      );
      expect(sorted).toEqual(order);
    });

    it('should not preselect any time', () => {
      renderGlance();

      expect(prepField()).toHaveValue('');
      expect(cookField()).toHaveValue('');
      expect(screen.queryByRole('button', { pressed: true, name: /minutes/ })).toBeNull();
    });

    it('should prefill four servings and medium difficulty', () => {
      renderGlance();

      expect(servingsField()).toHaveValue('4');
      expect(within(difficulty()).getByRole('button', { name: 'Medium' })).toHaveAttribute(
        'aria-pressed',
        'true'
      );
    });

    it('should mark the three numbers as required', () => {
      renderGlance();

      expect(prepField()).toBeRequired();
      expect(cookField()).toBeRequired();
      expect(servingsField()).toBeRequired();
    });

    it('should ask for a numeric keypad', () => {
      renderGlance();

      expect(cookField()).toHaveAttribute('inputmode', 'numeric');
      expect(cookField()).toHaveAttribute('maxlength', '3');
    });

    it('should offer the prep quick picks, None first', () => {
      renderGlance();

      const names = within(prepPicks())
        .getAllByRole('button')
        .map((chip) => chip.getAttribute('aria-label'));
      expect(names).toEqual([
        'No prep time',
        '5 minutes',
        '10 minutes',
        '15 minutes',
        '20 minutes',
        '30 minutes',
      ]);
    });

    it('should offer the cook quick picks', () => {
      renderGlance();

      const labels = within(cookPicks())
        .getAllByRole('button')
        .map((chip) => chip.textContent);
      expect(labels).toEqual(['10', '15', '20', '30', '45', '60', '90']);
    });

    it('should not show a total before a time is set', () => {
      renderGlance();

      expect(screen.queryByText(/^Total/)).not.toBeInTheDocument();
    });

    it('should show no error at rest', () => {
      renderGlance();

      expect(cookField()).not.toHaveAttribute('aria-invalid', 'true');
    });
  });

  describe('times', () => {
    it('should set the cook time from a quick pick without a keyboard', async () => {
      const { user, form } = renderGlance();

      await user.click(within(cookPicks()).getByRole('button', { name: '45 minutes' }));

      expect(form().values.cookingTime).toBe(45);
      expect(cookField()).toHaveValue('45');
    });

    it('should mark the picked chip as pressed', async () => {
      const { user } = renderGlance();

      await user.click(within(cookPicks()).getByRole('button', { name: '45 minutes' }));

      expect(within(cookPicks()).getByRole('button', { name: '45 minutes' })).toHaveAttribute(
        'aria-pressed',
        'true'
      );
      expect(within(cookPicks()).getByRole('button', { name: '30 minutes' })).toHaveAttribute(
        'aria-pressed',
        'false'
      );
    });

    it('should set prep to zero with None', async () => {
      const { user, form } = renderGlance();

      await user.click(within(prepPicks()).getByRole('button', { name: 'No prep time' }));

      expect(form().values.prepTime).toBe(0);
    });

    it('should operate a quick pick with the keyboard', async () => {
      const { user, form } = renderGlance();
      within(prepPicks()).getByRole('button', { name: '10 minutes' }).focus();

      await user.keyboard('{Enter}');

      expect(form().values.prepTime).toBe(10);
    });

    it('should accept a custom value typed in the field', async () => {
      const { user, form } = renderGlance();

      await user.type(cookField(), '25');

      expect(form().values.cookingTime).toBe(25);
      expect(screen.queryByRole('button', { pressed: true, name: /minutes/ })).toBeNull();
    });

    it('should keep digits only', async () => {
      const { user, form } = renderGlance();

      await user.type(prepField(), '1a5.');

      expect(form().values.prepTime).toBe(15);
    });

    it('should go back to empty when the field is cleared', async () => {
      const { user, form } = renderGlance();
      await user.type(cookField(), '5');

      await user.clear(cookField());

      expect(form().values.cookingTime).toBe('');
    });

    it('should show the live total once a time is set', async () => {
      const { user } = renderGlance();

      await user.click(within(prepPicks()).getByRole('button', { name: '15 minutes' }));
      await user.click(within(cookPicks()).getByRole('button', { name: '30 minutes' }));

      expect(screen.getByText('Total 45 min')).toBeInTheDocument();
    });

    it('should total a single time on its own', async () => {
      const { user } = renderGlance();

      await user.click(within(cookPicks()).getByRole('button', { name: '20 minutes' }));

      expect(screen.getByText('Total 20 min')).toBeInTheDocument();
    });

    it('should name the field and the fix after the first blur', async () => {
      const { user } = renderGlance();

      await user.click(cookField());
      await user.tab();

      expect(cookField()).toHaveAttribute('aria-invalid', 'true');
      expect(cookField()).toHaveAccessibleDescription('Cook time: whole minutes between 1 and 720');
    });

    it('should clear the error when a quick pick fixes it', async () => {
      const { user } = renderGlance();
      await user.click(cookField());
      await user.tab();

      await user.click(within(cookPicks()).getByRole('button', { name: '10 minutes' }));

      expect(cookField()).not.toHaveAttribute('aria-invalid', 'true');
    });

    it('should move from Prep to Cook on Enter', async () => {
      const { user } = renderGlance();
      await user.click(prepField());

      await user.keyboard('{Enter}');

      expect(cookField()).toHaveFocus();
    });
  });

  describe('servings', () => {
    it('should add a serving with the plus button', async () => {
      const { user, form } = renderGlance();

      await user.click(screen.getByRole('button', { name: 'More servings' }));

      expect(form().values.servings).toBe(5);
    });

    it('should take a serving away with the minus button', async () => {
      const { user, form } = renderGlance();

      await user.click(screen.getByRole('button', { name: 'Fewer servings' }));

      expect(form().values.servings).toBe(3);
    });

    it('should not go below one serving', async () => {
      const { user, form } = renderGlance();
      act(() => form().setField('servings', 1));

      await user.click(screen.getByRole('button', { name: 'Fewer servings' }));

      expect(form().values.servings).toBe(1);
      expect(screen.getByRole('button', { name: 'Fewer servings' })).toHaveAttribute(
        'aria-disabled',
        'true'
      );
    });

    it('should not go above a hundred servings', async () => {
      const { user, form } = renderGlance();
      act(() => form().setField('servings', 100));

      await user.click(screen.getByRole('button', { name: 'More servings' }));

      expect(form().values.servings).toBe(100);
      expect(screen.getByRole('button', { name: 'More servings' })).toHaveAttribute(
        'aria-disabled',
        'true'
      );
    });

    it('should keep focus on the stepper button at the limit', async () => {
      const { user, form } = renderGlance();
      act(() => form().setField('servings', 2));
      const fewer = screen.getByRole('button', { name: 'Fewer servings' });

      await user.click(fewer);

      expect(fewer).toHaveFocus();
    });

    it.each([
      ['Enter', 'More servings', '{Enter}', 5],
      ['Space', 'More servings', ' ', 5],
      ['Enter', 'Fewer servings', '{Enter}', 3],
      ['Space', 'Fewer servings', ' ', 3],
    ])('should step with %s on the focused "%s" button', async (_key, name, keys, expected) => {
      const { user, form } = renderGlance();
      const button = screen.getByRole('button', { name });
      button.focus();

      await user.keyboard(keys);

      expect(form().values.servings).toBe(expected);
      expect(button).toHaveFocus();
    });

    it('should still move on from the Servings input on Enter', async () => {
      const { user } = renderEditor((form) => (
        <>
          <AtAGlance form={form} />
          <input aria-label="Next field" />
        </>
      ));
      await user.click(servingsField());

      await user.keyboard('{Enter}');

      expect(screen.getByRole('textbox', { name: 'Next field' })).toHaveFocus();
    });

    it('should start from one when the field was emptied', async () => {
      const { user, form } = renderGlance();
      await user.clear(servingsField());

      await user.click(screen.getByRole('button', { name: 'More servings' }));

      expect(form().values.servings).toBe(1);
    });

    it('should cap a typed value at a hundred', async () => {
      const { user, form } = renderGlance();
      await user.clear(servingsField());

      await user.type(servingsField(), '250');

      expect(form().values.servings).toBe(100);
    });

    it('should raise a typed zero to one on blur', async () => {
      const { user, form } = renderGlance();
      await user.clear(servingsField());
      await user.type(servingsField(), '0');

      await user.tab();

      expect(form().values.servings).toBe(1);
      expect(servingsField()).not.toHaveAttribute('aria-invalid', 'true');
    });

    it('should report an emptied field on blur', async () => {
      const { user } = renderGlance();
      await user.clear(servingsField());

      await user.tab();

      expect(servingsField()).toHaveAccessibleDescription(
        'Servings: a whole number between 1 and 100'
      );
    });
  });

  describe('difficulty', () => {
    it('should select a difficulty', async () => {
      const { user, form } = renderGlance();

      await user.click(within(difficulty()).getByRole('button', { name: 'Hard' }));

      expect(form().values.difficulty).toBe('hard');
    });

    it('should keep the selection when the selected segment is clicked again', async () => {
      const { user, form } = renderGlance();

      await user.click(within(difficulty()).getByRole('button', { name: 'Medium' }));

      expect(form().values.difficulty).toBe('medium');
    });

    it('should show a difficulty error under the toggle', () => {
      const form: AtAGlanceProps['form'] = {
        values: makeValues(),
        errors: { difficulty: 'Difficulty: choose Easy, Medium or Hard' },
        setField: jest.fn(),
        touch: jest.fn(),
      };

      renderWithTheme(<AtAGlance form={form} />);

      expect(screen.getByText('Difficulty: choose Easy, Medium or Hard')).toBeInTheDocument();
    });
  });

  describe('disabled', () => {
    it('should disable every control while the form is submitting', () => {
      renderGlance({ disabled: true });

      expect(cookField()).toBeDisabled();
      expect(servingsField()).toBeDisabled();
      expect(screen.getByRole('button', { name: 'More servings' })).toBeDisabled();
      expect(within(difficulty()).getByRole('button', { name: 'Easy' })).toBeDisabled();
      expect(within(cookPicks()).getByRole('button', { name: '10 minutes' })).toHaveAttribute(
        'aria-disabled',
        'true'
      );
    });
  });

  describe('focus by path', () => {
    it.each([
      ['prepTime', prepField],
      ['cookingTime', cookField],
      ['servings', servingsField],
    ])('should focus %s by its engine path', (path, getField) => {
      const { registry } = renderGlance();

      act(() => {
        registry().focusField(path);
      });

      expect(getField()).toHaveFocus();
    });

    it('should focus the selected difficulty by its engine path', async () => {
      const { user, registry } = renderGlance();
      await user.click(within(difficulty()).getByRole('button', { name: 'Easy' }));
      act(() => (document.activeElement as HTMLElement).blur());

      act(() => {
        registry().focusField('difficulty');
      });

      expect(within(difficulty()).getByRole('button', { name: 'Easy' })).toHaveFocus();
    });
  });
});
