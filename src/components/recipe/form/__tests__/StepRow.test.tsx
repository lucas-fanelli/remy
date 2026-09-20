import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import StepRow, { StepRowProps } from '../StepRow';
import { renderWithTheme } from './editorHarness';

const renderRow = (props: Partial<StepRowProps> = {}) => {
  const handlers = {
    onChange: jest.fn(),
    onRowBlur: jest.fn(),
    onRemove: jest.fn(),
    onMove: jest.fn(),
    onAddAfter: jest.fn(),
    onUploadingChange: jest.fn(),
  };
  renderWithTheme(
    <StepRow
      row={{ id: 's2', description: 'Rest the dough', image: '' }}
      index={1}
      isFirst={false}
      isLast={false}
      {...handlers}
      {...props}
    />
  );
  return { ...handlers, user: userEvent.setup() };
};

describe('StepRow', () => {
  it('should name its controls after its position', () => {
    renderRow();

    expect(screen.getByRole('group', { name: 'Step 2' })).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'Step 2' })).toHaveValue('Rest the dough');
    expect(screen.getByRole('button', { name: 'Move step 2 up' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Move step 2 down' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Remove step 2' })).toBeEnabled();
  });

  it('should carry its row id in the DOM for the focus hand-off', () => {
    renderRow();

    expect(screen.getByRole('group', { name: 'Step 2' })).toHaveAttribute('data-row-id', 's2');
  });

  it('should report edits as patches addressed by row id', async () => {
    const { user, onChange } = renderRow({ row: { id: 's2', description: '', image: '' } });

    await user.type(screen.getByRole('textbox', { name: 'Step 2' }), 'R');

    expect(onChange).toHaveBeenCalledWith('s2', { description: 'R' });
  });

  it('should ask for the next step on Ctrl+Enter only', async () => {
    const { user, onAddAfter } = renderRow();
    await user.click(screen.getByRole('textbox', { name: 'Step 2' }));

    await user.keyboard('{Enter}');
    expect(onAddAfter).not.toHaveBeenCalled();
    await user.keyboard('{Control>}{Enter}{/Control}');

    expect(onAddAfter).toHaveBeenCalledWith('s2');
  });

  it('should report moves with their direction', async () => {
    const { user, onMove } = renderRow();

    await user.click(screen.getByRole('button', { name: 'Move step 2 up' }));
    await user.click(screen.getByRole('button', { name: 'Move step 2 down' }));

    expect(onMove.mock.calls).toEqual([
      ['s2', -1],
      ['s2', 1],
    ]);
  });

  it('should report the row blur once, when focus leaves the row', async () => {
    const { user, onRowBlur } = renderRow();
    await user.click(screen.getByRole('textbox', { name: 'Step 2' }));
    await user.tab();
    expect(onRowBlur).not.toHaveBeenCalled();

    await user.click(document.body);

    expect(onRowBlur).toHaveBeenCalledTimes(1);
    expect(onRowBlur).toHaveBeenCalledWith('s2');
  });

  it('should show its error under the text', () => {
    renderRow({ descriptionError: 'Step 2 is empty - write it or remove it' });

    expect(screen.getByRole('textbox', { name: 'Step 2' })).toHaveAccessibleDescription(
      'Step 2 is empty - write it or remove it'
    );
  });
});
