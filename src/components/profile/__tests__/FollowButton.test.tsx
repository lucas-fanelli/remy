import { fireEvent, render, screen, waitForElementToBeRemoved } from '@testing-library/react';
import React from 'react';
import FollowButton, { type FollowButtonProps } from '../FollowButton';

/**
 * The follow button everywhere people are followed: the profile header and both lists.
 * What it shows for each state, what a tap on it means, and the one tap that asks first.
 * FollowButton.i18n.test.tsx has the same in Spanish.
 */

const onAction = jest.fn();

const renderButton = (props: Partial<FollowButtonProps> = {}) =>
  render(<FollowButton state="none" isPrivate={false} name="ana" onAction={onAction} {...props} />);

describe('FollowButton', () => {
  beforeEach(() => onAction.mockReset());

  describe('what it shows', () => {
    it.each([
      ['none', 'Follow', 'contained'],
      ['requested', 'Requested', 'outlined'],
      ['following', 'Following', 'outlined'],
    ] as const)('%s reads "%s", %s', (state, label, variant) => {
      renderButton({ state });

      const button = screen.getByRole('button', { name: label });
      expect(button).toHaveClass(`MuiButton-${variant}`);
    });

    it('fills in only the call to action', () => {
      // Two outlined states and one filled: the filled one is the only one asking for a tap.
      renderButton({ state: 'none', isPrivate: true });

      expect(screen.getByRole('button', { name: 'Follow' })).toHaveClass('MuiButton-contained');
    });
  });

  describe('what a tap means', () => {
    it.each([
      ['none', false, 'follow'],
      ['none', true, 'request'],
      ['requested', true, 'cancel'],
      ['following', false, 'unfollow'],
    ] as const)('%s on a private=%s account: %s, at once', (state, isPrivate, action) => {
      renderButton({ state, isPrivate });

      fireEvent.click(screen.getByRole('button'));

      expect(onAction).toHaveBeenCalledTimes(1);
      expect(onAction).toHaveBeenCalledWith(action);
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    it('does nothing while disabled', () => {
      renderButton({ disabled: true });

      const button = screen.getByRole('button', { name: 'Follow' });
      expect(button).toBeDisabled();
      fireEvent.click(button);
      expect(onAction).not.toHaveBeenCalled();
    });

    it('keeps keyboard focus when the state changes under it', () => {
      // The button it replaced was keyed on the state, so every change remounted it and
      // dropped focus to the page.
      const { rerender } = renderButton({ state: 'none' });
      const button = screen.getByRole('button', { name: 'Follow' });
      button.focus();

      fireEvent.click(button);
      rerender(<FollowButton state="following" isPrivate={false} name="ana" onAction={onAction} />);

      expect(screen.getByRole('button', { name: 'Following' })).toBe(button);
      expect(button).toHaveFocus();
    });
  });

  describe('unfollowing a private account', () => {
    it('asks first, naming the person, and says what it will cost', () => {
      renderButton({ state: 'following', isPrivate: true });

      fireEvent.click(screen.getByRole('button', { name: 'Following' }));

      const dialog = screen.getByRole('dialog', { name: 'Unfollow ana?' });
      expect(dialog).toHaveTextContent(
        "This account is private: to see their recipes again you'll have to send another request."
      );
      expect(onAction).not.toHaveBeenCalled();
    });

    it('unfollows once confirmed', async () => {
      renderButton({ state: 'following', isPrivate: true });

      fireEvent.click(screen.getByRole('button', { name: 'Following' }));
      fireEvent.click(screen.getByRole('button', { name: 'Unfollow' }));

      expect(onAction).toHaveBeenCalledTimes(1);
      expect(onAction).toHaveBeenCalledWith('unfollow');
      await waitForElementToBeRemoved(() => screen.queryByRole('dialog'));
    });

    it('stays following when the reader thinks better of it', async () => {
      renderButton({ state: 'following', isPrivate: true });

      fireEvent.click(screen.getByRole('button', { name: 'Following' }));
      fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

      await waitForElementToBeRemoved(() => screen.queryByRole('dialog'));
      expect(onAction).not.toHaveBeenCalled();
    });

    it('sends nothing if the follow ended while the question was open', () => {
      // Unfollowed in another tab, or the owner removed the reader, meanwhile.
      const { rerender } = renderButton({ state: 'following', isPrivate: true });
      fireEvent.click(screen.getByRole('button', { name: 'Following' }));

      rerender(<FollowButton state="none" isPrivate={true} name="ana" onAction={onAction} />);
      fireEvent.click(screen.getByRole('button', { name: 'Unfollow' }));

      expect(onAction).not.toHaveBeenCalled();
    });

    it('does not ask before taking back a request, which loses nothing', () => {
      renderButton({ state: 'requested', isPrivate: true });

      fireEvent.click(screen.getByRole('button', { name: 'Requested' }));

      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      expect(onAction).toHaveBeenCalledWith('cancel');
    });
  });
});
