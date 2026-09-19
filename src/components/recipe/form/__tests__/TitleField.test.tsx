import { act, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import TitleField from '../TitleField';
import { renderEditor } from './editorHarness';
import { makeValues } from './fixtures';

const renderTitle = (props: { autoFocus?: boolean; disabled?: boolean } = {}) =>
  renderEditor((form, registry) => (
    <>
      <TitleField form={form} registerField={registry.registerField} {...props} />
      <input aria-label="Next field" />
    </>
  ));

const stubPointer = (fine: boolean) => {
  window.matchMedia = jest.fn().mockReturnValue({ matches: fine }) as any;
};

describe('TitleField', () => {
  afterEach(() => {
    delete (window as any).matchMedia;
  });

  describe('rendering', () => {
    it('should render a required text field named Title', () => {
      renderTitle();

      expect(screen.getByRole('textbox', { name: /^Title/ })).toBeRequired();
    });

    it('should not show an error or a counter at rest', () => {
      renderTitle();

      const input = screen.getByRole('textbox', { name: /^Title/ });
      expect(input).not.toHaveAttribute('aria-invalid', 'true');
      expect(input).not.toHaveAccessibleDescription();
    });

    it('should cap the input at the server limit and hint the keyboard', () => {
      renderTitle();

      const input = screen.getByRole('textbox', { name: /^Title/ });
      expect(input).toHaveAttribute('maxlength', '100');
      expect(input).toHaveAttribute('enterkeyhint', 'next');
      expect(input).toHaveAttribute('autocapitalize', 'sentences');
    });

    it('should disable the input when disabled', () => {
      renderTitle({ disabled: true });

      expect(screen.getByRole('textbox', { name: /^Title/ })).toBeDisabled();
    });
  });

  describe('editing', () => {
    it('should write what is typed to the engine', async () => {
      const { user, form } = renderTitle();

      await user.type(screen.getByRole('textbox', { name: /^Title/ }), 'Empanadas');

      expect(form().values.title).toBe('Empanadas');
    });

    it('should show the error only after the first blur', async () => {
      const { user } = renderTitle();
      const input = screen.getByRole('textbox', { name: /^Title/ });

      await user.click(input);
      expect(input).not.toHaveAttribute('aria-invalid', 'true');
      await user.tab();

      expect(input).toHaveAttribute('aria-invalid', 'true');
      expect(input).toHaveAccessibleDescription('Add a title');
    });

    it('should clear the error as soon as the title is typed', async () => {
      const { user } = renderTitle();
      const input = screen.getByRole('textbox', { name: /^Title/ });
      await user.click(input);
      await user.tab();

      await user.type(input, 'E');

      expect(input).not.toHaveAttribute('aria-invalid', 'true');
    });

    it('should show the counter from 80% of the limit', () => {
      const { form } = renderTitle();

      act(() => form().load(makeValues({ title: 'x'.repeat(80) })));

      expect(screen.getByText('80/100')).toBeInTheDocument();
    });

    it('should keep the counter hidden below 80% of the limit', () => {
      const { form } = renderTitle();

      act(() => form().load(makeValues({ title: 'x'.repeat(79) })));

      expect(screen.queryByText('79/100')).not.toBeInTheDocument();
    });
  });

  describe('keyboard', () => {
    it('should move to the next field on Enter instead of submitting', async () => {
      const { user } = renderTitle();

      await user.click(screen.getByRole('textbox', { name: /^Title/ }));
      await user.keyboard('{Enter}');

      expect(screen.getByRole('textbox', { name: 'Next field' })).toHaveFocus();
    });
  });

  describe('focus', () => {
    it('should focus itself on mount on a fine pointer', () => {
      stubPointer(true);

      renderTitle();

      expect(screen.getByRole('textbox', { name: /^Title/ })).toHaveFocus();
    });

    it('should not focus itself on a coarse pointer', () => {
      stubPointer(false);

      renderTitle();

      expect(screen.getByRole('textbox', { name: /^Title/ })).not.toHaveFocus();
    });

    it('should not focus itself when matchMedia is missing', () => {
      renderTitle();

      expect(screen.getByRole('textbox', { name: /^Title/ })).not.toHaveFocus();
    });

    it('should not focus itself when autoFocus is off', () => {
      stubPointer(true);

      renderTitle({ autoFocus: false });

      expect(screen.getByRole('textbox', { name: /^Title/ })).not.toHaveFocus();
    });

    it('should be focusable by its engine path', () => {
      const { registry } = renderTitle();

      act(() => {
        registry().focusField('title');
      });

      expect(screen.getByRole('textbox', { name: /^Title/ })).toHaveFocus();
    });

    it('should render without a registry', () => {
      renderEditor((form) => <TitleField form={form} />);

      expect(screen.getByRole('textbox', { name: /^Title/ })).toBeInTheDocument();
    });
  });
});
