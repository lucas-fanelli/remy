import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import PublishButton from '../PublishButton';

// The documented way for a shell's tests to switch the guard off
jest.mock('@/components/recipe/form/formMotion', () => ({
  ...jest.requireActual('@/components/recipe/form/formMotion'),
  PUBLISH_GUARD_MS: 0,
}));

describe('PublishButton with PUBLISH_GUARD_MS mocked to 0', () => {
  it('should publish on a click right after it mounts', async () => {
    const onPublish = jest.fn();
    const user = userEvent.setup();
    render(<PublishButton mode="create" onPublish={onPublish} />);

    await user.click(screen.getByRole('button', { name: 'Publish recipe' }));

    expect(onPublish).toHaveBeenCalledTimes(1);
  });
});
