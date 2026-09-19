import { createEvent, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import FormDialog, { FormDialogProps } from '../FormDialog';

const renderDialog = (props: Partial<FormDialogProps> = {}, ref?: React.Ref<HTMLDivElement>) => {
  const onClose = jest.fn();
  render(
    <FormDialog
      ref={ref}
      open
      title="New recipe"
      onClose={onClose}
      actions={<button type="button">Publish recipe</button>}
      {...props}
    >
      <label>
        Title
        <input name="title" />
      </label>
    </FormDialog>
  );
  return { onClose, user: userEvent.setup() };
};

// Emotion inserts rules through the CSSOM, so the text lives in cssRules, not in <style>
const getInjectedCss = () =>
  Array.from(document.styleSheets)
    .flatMap((sheet) => Array.from(sheet.cssRules))
    .map((rule) => rule.cssText)
    .join(' ');

const getContainer = () => document.querySelector('.MuiDialog-container') as HTMLElement;

// MUI's theme.breakpoints.down('sm')
const mockViewport = (isPhone: boolean) => {
  window.matchMedia = jest.fn().mockImplementation((query: string) => ({
    matches: isPhone && query.includes('max-width:599.95px'),
    media: query,
    onchange: null,
    addListener: jest.fn(),
    removeListener: jest.fn(),
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    dispatchEvent: jest.fn(),
  }));
};

describe('FormDialog', () => {
  const originalMatchMedia = window.matchMedia;

  afterEach(() => {
    window.matchMedia = originalMatchMedia;
  });

  describe('structure (the pinned footer)', () => {
    it('should make the Paper itself the form', () => {
      renderDialog();

      const dialog = screen.getByRole('dialog', { name: 'New recipe' });
      expect(dialog.tagName).toBe('FORM');
      expect(dialog).toHaveClass('MuiDialog-paper');
    });

    it('should keep no other form between the Paper and its zones', () => {
      renderDialog();

      expect(document.querySelectorAll('form')).toHaveLength(1);
    });

    it('should lay the Paper out as a column whose only growing child is the content', () => {
      renderDialog();

      const dialog = screen.getByRole('dialog');
      const content = dialog.querySelector('.MuiDialogContent-root') as HTMLElement;
      expect(dialog).toHaveStyle({ display: 'flex', flexDirection: 'column' });
      expect(content).toHaveStyle({ flex: '1 1 auto', overflowY: 'auto' });
    });

    it('should make the scrolling content a direct child of the form', () => {
      renderDialog();

      const dialog = screen.getByRole('dialog');
      const content = dialog.querySelector('.MuiDialogContent-root') as HTMLElement;
      expect(content.parentElement).toBe(dialog);
      expect(within(content).getByLabelText('Title')).toBeInTheDocument();
    });

    it('should make the actions a sibling of the scroll area, never a descendant', () => {
      renderDialog();

      const dialog = screen.getByRole('dialog');
      const content = dialog.querySelector('.MuiDialogContent-root') as HTMLElement;
      const actions = dialog.querySelector('.MuiDialogActions-root') as HTMLElement;
      expect(actions.parentElement).toBe(dialog);
      expect(content.contains(actions)).toBe(false);
      expect(content.nextElementSibling).toBe(actions);
      expect(within(actions).getByRole('button', { name: 'Publish recipe' })).toBeInTheDocument();
    });

    it('should not let the title row or the actions shrink', () => {
      renderDialog();

      const dialog = screen.getByRole('dialog');
      const actions = dialog.querySelector('.MuiDialogActions-root') as HTMLElement;
      expect(dialog.firstElementChild).toHaveStyle({ flexShrink: '0' });
      expect(actions).toHaveStyle({ flexShrink: '0' });
    });

    it('should forward the ref to the scrolling content', () => {
      const ref = React.createRef<HTMLDivElement>();

      renderDialog({}, ref);

      expect(ref.current).toBe(document.querySelector('.MuiDialogContent-root'));
    });

    it('should declare the 100vh fallback before 100dvh', () => {
      renderDialog();

      const css = getInjectedCss();
      expect(css).toContain('height: 100vh');
      expect(css).toContain('@supports (height: 100dvh)');
      expect(css.indexOf('height: 100vh')).toBeLessThan(css.indexOf('height: 100dvh'));
    });

    it('should pad the actions for the home indicator', () => {
      renderDialog();

      expect(getInjectedCss()).toContain(
        'padding-bottom: calc(12px + env(safe-area-inset-bottom))'
      );
    });
  });

  describe('zones', () => {
    it('should print the title as a level 2 heading', () => {
      renderDialog({ title: 'Edit recipe' });

      expect(screen.getByRole('heading', { level: 2, name: 'Edit recipe' })).toBeInTheDocument();
    });

    it('should render the header slot between the title row and the content', () => {
      renderDialog({ headerSlot: <nav aria-label="Sections">Sections</nav> });

      const slot = screen.getByRole('navigation', { name: 'Sections' }).parentElement;
      const content = document.querySelector('.MuiDialogContent-root');
      expect(slot?.nextElementSibling).toBe(content);
      expect(slot).toHaveStyle({ flexShrink: '0' });
    });

    it('should render no header zone when there is no header slot', () => {
      renderDialog();

      expect(screen.getByRole('dialog').children).toHaveLength(3);
    });

    it('should render nothing while closed', () => {
      renderDialog({ open: false });

      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
  });

  describe('form behaviour', () => {
    it('should switch native validation and autocomplete off', () => {
      renderDialog();

      const form = screen.getByRole('dialog');
      expect(form).toHaveAttribute('novalidate');
      expect(form).toHaveAttribute('autocomplete', 'off');
    });

    it('should cancel a submit event, so nothing can rely on it', () => {
      renderDialog();
      const form = screen.getByRole('dialog');
      const submit = createEvent.submit(form);

      fireEvent(form, submit);

      expect(submit.defaultPrevented).toBe(true);
    });
  });

  describe('guarded close', () => {
    it('should close from the X', async () => {
      const { onClose, user } = renderDialog({ dirty: true });

      await user.click(screen.getByRole('button', { name: 'Close' }));

      expect(onClose).toHaveBeenCalledWith('closeButton');
    });

    it('should close on Escape even while dirty', async () => {
      const { onClose, user } = renderDialog({ dirty: true });
      screen.getByLabelText('Title').focus();

      await user.keyboard('{Escape}');

      expect(onClose).toHaveBeenCalledWith('escapeKeyDown');
    });

    it('should close on a backdrop click while clean', async () => {
      const { onClose, user } = renderDialog();

      await user.click(getContainer());

      expect(onClose).toHaveBeenCalledWith('backdropClick');
    });

    it('should ignore a backdrop click while dirty', async () => {
      const { onClose, user } = renderDialog({ dirty: true });

      await user.click(getContainer());

      expect(onClose).not.toHaveBeenCalled();
    });

    it('should block Escape while busy', async () => {
      const { onClose, user } = renderDialog({ busy: true });
      screen.getByLabelText('Title').focus();

      await user.keyboard('{Escape}');

      expect(onClose).not.toHaveBeenCalled();
    });

    it('should block the backdrop while busy, even when clean', async () => {
      const { onClose, user } = renderDialog({ busy: true });

      await user.click(getContainer());

      expect(onClose).not.toHaveBeenCalled();
    });

    it('should disable the X and mark the form busy while busy', () => {
      renderDialog({ busy: true });

      expect(screen.getByRole('button', { name: 'Close' })).toBeDisabled();
      expect(screen.getByRole('dialog')).toHaveAttribute('aria-busy', 'true');
    });

    it('should not mark the form busy at rest', () => {
      renderDialog();

      expect(screen.getByRole('dialog')).not.toHaveAttribute('aria-busy');
    });
  });

  describe('one breakpoint', () => {
    it('should be full screen below sm', () => {
      mockViewport(true);

      renderDialog();

      expect(screen.getByRole('dialog')).toHaveClass('MuiDialog-paperFullScreen');
    });

    it('should be a centred dialog with a max width from sm', () => {
      mockViewport(false);

      renderDialog({ maxWidth: 'sm' });

      const dialog = screen.getByRole('dialog');
      expect(dialog).not.toHaveClass('MuiDialog-paperFullScreen');
      expect(dialog).toHaveClass('MuiDialog-paperWidthSm');
    });
  });
});
