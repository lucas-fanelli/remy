import { act, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { useRef, useState } from 'react';
import { RowFocusOptions, useRowFocus } from '../useRowFocus';

type FocusRow = (rowId: string, field: string, options?: RowFocusOptions) => void;

let focusRow: FocusRow;
let addRow: () => void;
let rerender: () => void;

function Rows() {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [rows, setRows] = useState(['a']);
  const [, setTick] = useState(0);
  focusRow = useRowFocus(containerRef);
  addRow = () => setRows((current) => [...current, 'b']);
  rerender = () => setTick((tick) => tick + 1);

  return (
    <div ref={containerRef}>
      {rows.map((id) => (
        <div key={id} data-row-id={id}>
          <input data-field="name" aria-label={`Name ${id}`} defaultValue="Flour" />
          <button type="button" data-field="remove">
            Remove {id}
          </button>
        </div>
      ))}
    </div>
  );
}

describe('useRowFocus', () => {
  it('should focus a mounted row at once', () => {
    render(<Rows />);

    act(() => focusRow('a', 'name'));

    expect(screen.getByLabelText('Name a')).toHaveFocus();
  });

  it('should put the caret after the text when asked', () => {
    render(<Rows />);

    act(() => focusRow('a', 'name', { caretAtEnd: true }));

    expect((screen.getByLabelText('Name a') as HTMLInputElement).selectionStart).toBe(5);
  });

  it('should ignore the caret option on a control without text', () => {
    render(<Rows />);

    act(() => focusRow('a', 'remove', { caretAtEnd: true }));

    expect(screen.getByRole('button', { name: 'Remove a' })).toHaveFocus();
  });

  it('should focus a row that mounts with the next commit', () => {
    render(<Rows />);

    act(() => {
      addRow();
      focusRow('b', 'name');
    });

    expect(screen.getByLabelText('Name b')).toHaveFocus();
  });

  it('should wait for the commit when asked, even if the row is mounted', () => {
    render(<Rows />);

    act(() => focusRow('a', 'name', { afterCommit: true }));
    expect(screen.getByLabelText('Name a')).not.toHaveFocus();
    act(() => rerender());

    expect(screen.getByLabelText('Name a')).toHaveFocus();
  });

  it('should give up after one commit so a stale request never steals focus', () => {
    render(<Rows />);

    act(() => {
      focusRow('b', 'name');
      rerender();
    });
    act(() => addRow());

    expect(screen.getByLabelText('Name b')).not.toHaveFocus();
  });
});
