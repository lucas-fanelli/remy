import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { PUBLISH_GUARD_MS } from '../formMotion';
import PublishButton from '../PublishButton';

const MOUNTED_AT = 1_000_000;

describe('PublishButton', () => {
  let now: jest.SpyInstance<number, []>;

  beforeEach(() => {
    now = jest.spyOn(Date, 'now').mockReturnValue(MOUNTED_AT);
  });

  afterEach(() => {
    now.mockRestore();
  });

  const renderButton = (props: Partial<React.ComponentProps<typeof PublishButton>> = {}) => {
    const onPublish = jest.fn();
    render(<PublishButton mode="create" onPublish={onPublish} {...props} />);
    return { onPublish, user: userEvent.setup() };
  };

  it("should be labelled 'Publish recipe' when creating", () => {
    renderButton();

    expect(screen.getByRole('button', { name: 'Publish recipe' })).toBeInTheDocument();
  });

  it("should be labelled 'Save changes' when editing", () => {
    renderButton({ mode: 'edit' });

    expect(screen.getByRole('button', { name: 'Save changes' })).toBeInTheDocument();
  });

  it('should never submit a form by itself', () => {
    renderButton();

    expect(screen.getByRole('button', { name: 'Publish recipe' })).toHaveAttribute(
      'type',
      'button'
    );
  });

  it('should ignore a click that lands inside the guard after it mounts', async () => {
    const { onPublish, user } = renderButton();
    now.mockReturnValue(MOUNTED_AT + PUBLISH_GUARD_MS - 1);

    await user.click(screen.getByRole('button', { name: 'Publish recipe' }));

    expect(onPublish).not.toHaveBeenCalled();
  });

  it('should publish on a click after the guard has passed', async () => {
    const { onPublish, user } = renderButton();
    now.mockReturnValue(MOUNTED_AT + PUBLISH_GUARD_MS);

    await user.click(screen.getByRole('button', { name: 'Publish recipe' }));

    expect(onPublish).toHaveBeenCalledTimes(1);
  });

  it('should publish from the keyboard with Enter', async () => {
    const { onPublish, user } = renderButton();
    now.mockReturnValue(MOUNTED_AT + PUBLISH_GUARD_MS);
    screen.getByRole('button', { name: 'Publish recipe' }).focus();

    await user.keyboard('{Enter}');

    expect(onPublish).toHaveBeenCalledTimes(1);
  });

  it('should apply the guard to the keyboard too', async () => {
    const { onPublish, user } = renderButton();
    screen.getByRole('button', { name: 'Publish recipe' }).focus();

    await user.keyboard(' ');

    expect(onPublish).not.toHaveBeenCalled();
  });

  it("should show 'Publishing...' and a spinner while pending", () => {
    renderButton({ pending: true });

    const button = screen.getByRole('button', { name: 'Publishing...' });
    expect(button).toHaveAttribute('aria-busy', 'true');
    expect(screen.getByRole('progressbar')).toBeInTheDocument();
  });

  it("should show 'Saving...' while an edit is pending", () => {
    renderButton({ mode: 'edit', pending: true });

    expect(screen.getByRole('button', { name: 'Saving...' })).toBeInTheDocument();
  });

  it('should ignore activation while pending but stay focusable', async () => {
    const { onPublish, user } = renderButton({ pending: true });
    now.mockReturnValue(MOUNTED_AT + PUBLISH_GUARD_MS);
    const button = screen.getByRole('button', { name: 'Publishing...' });

    await user.click(button);

    expect(onPublish).not.toHaveBeenCalled();
    expect(button).toBeEnabled();
    expect(button).toHaveAttribute('aria-disabled', 'true');
  });

  it('should be disabled, and described by the status, while photos are uploading', () => {
    renderButton({ disabled: true, 'aria-describedby': 'form-status' });

    const button = screen.getByRole('button', { name: 'Publish recipe' });
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute('aria-describedby', 'form-status');
  });

  it('should keep the minimum width and accept extra sx', () => {
    renderButton({ sx: [{ marginLeft: '8px' }] });

    expect(screen.getByRole('button', { name: 'Publish recipe' })).toHaveStyle({
      minWidth: '168px',
      marginLeft: '8px',
    });
  });
});
