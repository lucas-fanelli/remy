import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { RecipeSubmitError } from '@/lib/errors/RecipeSubmitError';
import FormStatus, { DRAFT_SAVED_FADE_MS, FormStatusForm, FormStatusProps } from '../FormStatus';
import { RecipeIssue } from '../types';

const COVER: RecipeIssue = {
  path: 'imageUrl',
  section: 'presentation',
  label: 'cover photo',
  message: 'Add a cover photo (JPG, PNG, WebP or GIF)',
};
const COOK: RecipeIssue = {
  path: 'cookingTime',
  section: 'basics',
  label: 'cook time',
  message: 'Cook time: whole minutes between 1 and 720',
};
const STEP: RecipeIssue = {
  path: 'steps.s2.description',
  section: 'steps',
  label: 'step 2',
  message: 'Step 2 is empty - write it or remove it',
};

const makeForm = (overrides: Partial<FormStatusForm> = {}): FormStatusForm => ({
  mode: 'create',
  issues: [],
  publishAttempted: false,
  uploadsInFlight: 0,
  isDirty: true,
  ...overrides,
});

const renderStatus = (
  formOverrides: Partial<FormStatusForm> = {},
  props: Partial<FormStatusProps> = {}
) => {
  const goTo = jest.fn();
  const view = render(<FormStatus form={makeForm(formOverrides)} goTo={goTo} {...props} />);
  const rerenderStatus = (
    nextForm: Partial<FormStatusForm> = {},
    nextProps: Partial<FormStatusProps> = {}
  ) => view.rerender(<FormStatus form={makeForm(nextForm)} goTo={goTo} {...nextProps} />);
  return { goTo, rerenderStatus, user: userEvent.setup() };
};

describe('FormStatus', () => {
  describe('progress', () => {
    it("should say 'Start with a title' while a new recipe is untouched", () => {
      renderStatus({ isDirty: false, issues: [COVER, COOK, STEP] });

      expect(screen.getByText('Start with a title')).toBeInTheDocument();
      expect(screen.queryByRole('button')).not.toBeInTheDocument();
    });

    it('should name the missing items while there are two or fewer', () => {
      renderStatus({ issues: [COVER, COOK] });

      expect(
        screen.getByRole('button', { name: 'Missing: cover photo, cook time' })
      ).toBeInTheDocument();
    });

    it('should name an item once when two issues share its label', () => {
      renderStatus({ issues: [STEP, { ...STEP, path: 'steps.s2.image' }] });

      expect(screen.getByRole('button', { name: 'Missing: step 2' })).toBeInTheDocument();
    });

    it('should count the missing items when there are more than two', () => {
      renderStatus({ issues: [COVER, COOK, STEP] });

      expect(screen.getByRole('button', { name: 'Missing 3 things' })).toBeInTheDocument();
    });

    it("should say 'Ready to publish' politely when nothing is missing", () => {
      renderStatus();

      expect(screen.getByRole('status')).toHaveTextContent('Ready to publish');
    });

    it("should say 'Ready to save' for an edit with changes", () => {
      renderStatus({ mode: 'edit' });

      expect(screen.getByRole('status')).toHaveTextContent('Ready to save');
    });

    it("should say 'No changes yet' for an untouched edit", () => {
      renderStatus({ mode: 'edit', isDirty: false });

      expect(screen.getByRole('status')).toHaveTextContent('No changes yet');
    });

    it('should list what is missing even for an untouched edit', () => {
      renderStatus({ mode: 'edit', isDirty: false, issues: [COVER] });

      expect(screen.getByRole('button', { name: 'Missing: cover photo' })).toBeInTheDocument();
    });
  });

  describe('the issue menu', () => {
    it('should announce itself as a menu button', () => {
      renderStatus({ issues: [COVER] });

      const button = screen.getByRole('button', { name: 'Missing: cover photo' });
      expect(button).toHaveAttribute('aria-haspopup', 'menu');
      expect(button).toHaveAttribute('type', 'button');
      expect(button).not.toHaveAttribute('aria-expanded');
    });

    it('should open a menu with one entry per issue', async () => {
      const { user } = renderStatus({ issues: [COVER, COOK, STEP] });

      await user.click(screen.getByRole('button', { name: 'Missing 3 things' }));

      const items = within(screen.getByRole('menu')).getAllByRole('menuitem');
      expect(items.map((item) => item.textContent)).toEqual([
        COVER.message,
        COOK.message,
        STEP.message,
      ]);
    });

    it('should mark the button as expanded while the menu is open', async () => {
      const { user } = renderStatus({ issues: [COVER] });

      await user.click(screen.getByRole('button', { name: 'Missing: cover photo' }));

      expect(
        screen.getByRole('button', { name: 'Missing: cover photo', hidden: true })
      ).toHaveAttribute('aria-expanded', 'true');
    });

    it('should jump to the chosen issue and close', async () => {
      const { goTo, user } = renderStatus({ issues: [COVER, COOK] });
      await user.click(screen.getByRole('button', { name: /^Missing/ }));

      await user.click(screen.getByRole('menuitem', { name: COOK.message }));

      expect(goTo).toHaveBeenCalledTimes(1);
      expect(goTo).toHaveBeenCalledWith('basics', 'cookingTime');
      await waitFor(() => expect(screen.queryByRole('menu')).not.toBeInTheDocument());
    });

    it('should be operable with the keyboard alone', async () => {
      const { goTo, user } = renderStatus({ issues: [COVER, COOK, STEP] });
      screen.getByRole('button', { name: 'Missing 3 things' }).focus();

      await user.keyboard('{Enter}');
      await user.keyboard('{ArrowDown}{ArrowDown}{Enter}');

      expect(goTo).toHaveBeenCalledWith('steps', 'steps.s2.description');
    });

    it('should leave the focus on the field the shell focused', async () => {
      const goTo = jest.fn(() => screen.getByLabelText('Cook time').focus());
      const user = userEvent.setup();
      render(
        <>
          <label>
            Cook time
            <input />
          </label>
          <FormStatus form={makeForm({ issues: [COOK] })} goTo={goTo} />
        </>
      );
      await user.click(screen.getByRole('button', { name: 'Missing: cook time' }));

      await user.click(screen.getByRole('menuitem', { name: COOK.message }));

      await waitFor(() => expect(screen.queryByRole('menu')).not.toBeInTheDocument());
      expect(screen.getByLabelText('Cook time')).toHaveFocus();
    });

    it('should close on Escape without jumping and give the focus back', async () => {
      const { goTo, user } = renderStatus({ issues: [COVER] });
      await user.click(screen.getByRole('button', { name: 'Missing: cover photo' }));

      await user.keyboard('{Escape}');

      await waitFor(() => expect(screen.queryByRole('menu')).not.toBeInTheDocument());
      expect(goTo).not.toHaveBeenCalled();
      expect(screen.getByRole('button', { name: 'Missing: cover photo' })).toHaveFocus();
    });

    it('should close the menu when the line stops being a button', async () => {
      const { rerenderStatus, user } = renderStatus({ issues: [COVER] });
      await user.click(screen.getByRole('button', { name: 'Missing: cover photo' }));

      rerenderStatus({ issues: [COVER], uploadsInFlight: 1 });

      await waitFor(() => expect(screen.queryByRole('menu')).not.toBeInTheDocument());
      expect(screen.getByText('Waiting for 1 photo...')).toBeInTheDocument();
    });
  });

  describe('uploads in flight', () => {
    it('should give the reason the primary action is disabled', () => {
      renderStatus({ uploadsInFlight: 1 });

      expect(screen.getByRole('status')).toHaveTextContent('Waiting for 1 photo...');
    });

    it('should use the plural for several photos and win over the missing list', () => {
      renderStatus({ uploadsInFlight: 2, issues: [COVER] });

      expect(screen.getByRole('status')).toHaveTextContent('Waiting for 2 photos...');
      expect(screen.queryByRole('button')).not.toBeInTheDocument();
    });
  });

  describe('after a failed Publish', () => {
    it("should put 'N things to fix' in an alert and on the menu button", () => {
      renderStatus({ publishAttempted: true, isDirty: false, issues: [COVER, COOK, STEP] });

      expect(screen.getByRole('alert')).toHaveTextContent('3 things to fix');
      expect(screen.getByRole('button', { name: '3 things to fix' })).toBeInTheDocument();
    });

    it('should use the singular for one thing', () => {
      renderStatus({ publishAttempted: true, issues: [COVER] });

      expect(screen.getByRole('alert')).toHaveTextContent('1 thing to fix');
    });

    it('should not announce again while the author fixes things', () => {
      const { rerenderStatus } = renderStatus({ publishAttempted: true, issues: [COVER, COOK] });

      rerenderStatus({ publishAttempted: true, issues: [COVER] });

      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
      expect(screen.getByRole('button', { name: '1 thing to fix' })).toBeInTheDocument();
    });

    it('should stay silent when the count comes back to the announced number', () => {
      const { rerenderStatus } = renderStatus({ publishAttempted: true, issues: [COVER, COOK] });
      rerenderStatus({ publishAttempted: true, issues: [COVER] });

      rerenderStatus({ publishAttempted: true, issues: [COVER, COOK] });

      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    });

    it('should announce again, as a new alert, on the next failed attempt', () => {
      const form = { publishAttempted: true, issues: [COVER, COOK] };
      const { rerenderStatus } = renderStatus(form, { attempt: 1 });
      const firstAlert = screen.getByRole('alert');

      rerenderStatus(form, { attempt: 2 });

      expect(screen.getByRole('alert')).toHaveTextContent('2 things to fix');
      expect(screen.getByRole('alert')).not.toBe(firstAlert);
    });

    it('should drop the alert once everything is fixed', () => {
      const { rerenderStatus } = renderStatus({ publishAttempted: true, issues: [COVER] });

      rerenderStatus({ publishAttempted: true, issues: [] });

      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
      expect(screen.getByRole('status')).toHaveTextContent('Ready to publish');
    });
  });

  describe('typed submit errors', () => {
    it('should explain an expired session and link to the fixed create token', () => {
      renderStatus({}, { submitError: new RecipeSubmitError('Unauthorized', 401, 'unauthorized') });

      expect(screen.getByRole('alert')).toHaveTextContent(
        'Your session expired. Your recipe is saved as a draft on this device.'
      );
      expect(screen.getByRole('link', { name: 'Log in again' })).toHaveAttribute(
        'href',
        '/auth?next=create'
      );
    });

    it('should not promise a draft when an edit hits an expired session', () => {
      renderStatus(
        { mode: 'edit' },
        { submitError: new RecipeSubmitError('Unauthorized', 401, 'unauthorized') }
      );

      expect(screen.getByRole('alert')).toHaveTextContent(
        'Your session expired. Log in again to save your changes.'
      );
      expect(screen.getByRole('link', { name: 'Log in again' })).toHaveAttribute('href', '/auth');
    });

    it('should tell the shell when the author leaves to log in again', async () => {
      const onLogin = jest.fn();
      const { user } = renderStatus({}, { sessionExpired: true, onLogin });
      const link = screen.getByRole('link', { name: 'Log in again' });
      // jsdom can not follow a link
      link.addEventListener('click', (event) => event.preventDefault());

      await user.click(link);

      expect(onLogin).toHaveBeenCalledTimes(1);
    });

    it('should show the same message when the session disappears while editing', () => {
      renderStatus({ issues: [COVER] }, { sessionExpired: true });

      expect(screen.getByRole('alert')).toHaveTextContent(/^Your session expired\./);
    });

    it('should explain the daily limit', () => {
      renderStatus(
        {},
        { submitError: new RecipeSubmitError('Daily recipe limit', 429, 'daily_limit') }
      );

      expect(screen.getByRole('alert')).toHaveTextContent(
        'You have published 10 recipes in the last 24 hours. This one is saved as a draft - publish it tomorrow.'
      );
    });

    it('should turn the retry delay into whole minutes', () => {
      renderStatus(
        {},
        { submitError: new RecipeSubmitError('Too many requests', 429, 'rate_limited', 61) }
      );

      expect(screen.getByRole('alert')).toHaveTextContent('Too many requests - try again in 2 min');
    });

    it('should cope with a rate limit that carries no delay', () => {
      renderStatus(
        {},
        { submitError: new RecipeSubmitError('Too many requests', 429, 'rate_limited') }
      );

      expect(screen.getByRole('alert')).toHaveTextContent(
        'Too many requests - try again in a minute'
      );
    });

    it('should point at the fields when the server rejects what validation also rejects', () => {
      renderStatus(
        { publishAttempted: true, issues: [COOK] },
        { submitError: new RecipeSubmitError('Invalid cookingTime', 400, 'validation') }
      );

      expect(screen.getByRole('alert')).toHaveTextContent('1 thing to fix');
      expect(screen.queryByText('Invalid cookingTime')).not.toBeInTheDocument();
    });

    it("should fall back to the server's text for a rule the client does not know", () => {
      renderStatus({}, { submitError: new RecipeSubmitError('Invalid url', 400, 'validation') });

      expect(screen.getByRole('alert')).toHaveTextContent('Invalid url');
    });

    it('should still say something when the server sent no text', () => {
      renderStatus({}, { submitError: new RecipeSubmitError('', 400, 'validation') });

      expect(screen.getByRole('alert')).toHaveTextContent(
        'The recipe was rejected - check the fields'
      );
    });

    it('should offer to try again after a server failure', async () => {
      const onRetry = jest.fn();
      const { user } = renderStatus(
        {},
        { submitError: new RecipeSubmitError('Boom', 500, 'server'), onRetry }
      );

      await user.click(screen.getByRole('button', { name: 'Try again' }));

      expect(screen.getByRole('alert')).toHaveTextContent(
        'Could not reach Remy. Nothing was lost.'
      );
      expect(onRetry).toHaveBeenCalledTimes(1);
    });

    it('should treat a network failure like a server failure', () => {
      renderStatus({}, { submitError: new RecipeSubmitError('Failed to fetch', 0, 'network') });

      expect(screen.getByRole('alert')).toHaveTextContent(
        'Could not reach Remy. Nothing was lost.'
      );
      expect(screen.queryByRole('button', { name: 'Try again' })).not.toBeInTheDocument();
    });

    it('should treat an untyped error like a server failure', () => {
      renderStatus({}, { submitError: new TypeError('x is not a function') });

      expect(screen.getByRole('alert')).toHaveTextContent(
        'Could not reach Remy. Nothing was lost.'
      );
    });

    it('should announce a second identical failure as a new alert', () => {
      const { rerenderStatus } = renderStatus(
        {},
        { submitError: new RecipeSubmitError('Boom', 500, 'server') }
      );
      const firstAlert = screen.getByRole('alert');

      rerenderStatus({}, { submitError: new RecipeSubmitError('Boom', 500, 'server') });

      expect(screen.getByRole('alert')).not.toBe(firstAlert);
    });

    it('should win over the waiting and missing states', () => {
      renderStatus(
        { uploadsInFlight: 1, issues: [COVER] },
        { submitError: new RecipeSubmitError('Boom', 500, 'server') }
      );

      expect(screen.queryByText(/Waiting for/)).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /Missing/ })).not.toBeInTheDocument();
    });
  });

  describe('draft saved', () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('should say nothing before the first save', () => {
      renderStatus({}, { draftSavedAt: null });

      expect(screen.queryByText('Draft saved')).not.toBeInTheDocument();
    });

    it("should say 'Draft saved' politely after a save", () => {
      renderStatus({}, { draftSavedAt: 1000 });

      const note = screen.getByText('Draft saved');
      expect(note).toHaveAttribute('role', 'status');
      expect(note).toHaveStyle({ color: 'rgba(0, 0, 0, 0.6)' });
    });

    it('should fade to the disabled text colour after two seconds', () => {
      renderStatus({}, { draftSavedAt: 1000 });

      act(() => {
        jest.advanceTimersByTime(DRAFT_SAVED_FADE_MS);
      });

      expect(screen.getByText('Draft saved')).toHaveStyle({ color: 'rgba(0, 0, 0, 0.38)' });
    });

    it('should light up again on the next save', () => {
      const { rerenderStatus } = renderStatus({}, { draftSavedAt: 1000 });
      act(() => {
        jest.advanceTimersByTime(DRAFT_SAVED_FADE_MS);
      });

      rerenderStatus({}, { draftSavedAt: 2000 });

      expect(screen.getByText('Draft saved')).toHaveStyle({ color: 'rgba(0, 0, 0, 0.6)' });
    });
  });

  describe('wiring', () => {
    it('should carry the id the PublishButton describes itself with', () => {
      renderStatus(
        { uploadsInFlight: 1 },
        { id: 'recipe-form-status', sx: [{ marginTop: '4px' }] }
      );

      const root = document.getElementById('recipe-form-status');
      expect(root).toHaveTextContent('Waiting for 1 photo...');
      expect(root).toHaveStyle({ marginTop: '4px' });
    });
  });
});
