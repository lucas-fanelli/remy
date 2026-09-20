import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { text } from '@/i18n/text';
import DraftRestoredBar, { DraftRestoredBarProps, formatDraftAge } from '../DraftRestoredBar';

const NOW = Date.UTC(2026, 0, 10, 12, 0, 0);
const MINUTE = 60_000;
const HOUR = 60 * MINUTE;

const renderBar = (props: Partial<DraftRestoredBarProps> = {}) => {
  const onStartOver = jest.fn();
  const onDismiss = jest.fn();
  render(
    <DraftRestoredBar
      savedAt={NOW - 10 * MINUTE}
      now={NOW}
      onStartOver={onStartOver}
      onDismiss={onDismiss}
      {...props}
    />
  );
  return { onStartOver, onDismiss, user: userEvent.setup() };
};

// The bar has no locale of its own: it names a message and the component renders it, so
// what is asserted here is the INTENT. DraftRestoredBar's own cases below read the English.
describe('formatDraftAge', () => {
  it.each([
    [30_000, text('recipeForm.draft.ageMoment')],
    [10 * MINUTE, text('recipeForm.draft.ageMinutes', { count: 10 })],
    [HOUR, text('recipeForm.draft.ageHours', { count: 1 })],
    [5 * HOUR, text('recipeForm.draft.ageHours', { count: 5 })],
    [30 * HOUR, text('recipeForm.draft.ageYesterday')],
    [72 * HOUR, text('recipeForm.draft.ageDays', { count: 3 })],
  ])('should name the message for a draft saved %i ms ago', (age, expected) => {
    expect(formatDraftAge(NOW - age, NOW)).toEqual(expected);
  });

  it('should not print a negative age when the clock went backwards', () => {
    expect(formatDraftAge(NOW + HOUR, NOW)).toEqual(text('recipeForm.draft.ageMoment'));
  });

  it('should survive a broken timestamp', () => {
    expect(formatDraftAge(Number.NaN, NOW)).toEqual(text('recipeForm.draft.ageMoment'));
  });
});

describe('DraftRestoredBar', () => {
  it('should announce the restored draft politely, never as an alert', () => {
    renderBar();

    expect(screen.getByRole('status')).toHaveTextContent('Draft restored from 10 min ago');
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('should use the current time when no clock is injected', () => {
    renderBar({ now: undefined, savedAt: Date.now() - 1000 });

    expect(screen.getByRole('status')).toHaveTextContent('Draft restored from a moment ago');
  });

  it('should dismiss from the X without touching the draft', async () => {
    const { onDismiss, onStartOver, user } = renderBar();

    await user.click(screen.getByRole('button', { name: 'Dismiss' }));

    expect(onDismiss).toHaveBeenCalledTimes(1);
    expect(onStartOver).not.toHaveBeenCalled();
  });

  it('should ask before starting over', async () => {
    const { onStartOver, user } = renderBar();

    await user.click(screen.getByRole('button', { name: 'Start over' }));

    expect(screen.getByRole('dialog', { name: 'Start over?' })).toBeInTheDocument();
    expect(onStartOver).not.toHaveBeenCalled();
  });

  it('should keep the draft when the author backs out', async () => {
    const { onStartOver, user } = renderBar();
    await user.click(screen.getByRole('button', { name: 'Start over' }));

    await user.click(screen.getByRole('button', { name: 'Keep draft' }));

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(onStartOver).not.toHaveBeenCalled();
  });

  it('should start over once the author confirms', async () => {
    const { onStartOver, user } = renderBar();
    await user.click(screen.getByRole('button', { name: 'Start over' }));

    await user.click(
      within(screen.getByRole('dialog')).getByRole('button', { name: 'Start over' })
    );

    expect(onStartOver).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });

  it('should confirm from the keyboard', async () => {
    const { onStartOver, user } = renderBar();
    screen.getByRole('button', { name: 'Start over' }).focus();

    await user.keyboard('{Enter}');
    await screen.findByRole('dialog');
    await user.keyboard('{Enter}');

    expect(onStartOver).toHaveBeenCalledTimes(1);
  });

  it('should lock both actions while a submit is in flight', () => {
    renderBar({ disabled: true, sx: [{ marginBottom: '16px' }] });

    expect(screen.getByRole('button', { name: 'Start over' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Dismiss' })).toBeDisabled();
  });
});
