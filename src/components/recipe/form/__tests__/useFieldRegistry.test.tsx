import { act, render, renderHook, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { useState } from 'react';
import {
  FieldRegistry,
  FocusableField,
  PENDING_FOCUS_MS,
  useFieldRef,
  useFieldRegistry,
} from '../useFieldRegistry';

const makeField = (): jest.Mocked<Required<FocusableField>> => ({
  focus: jest.fn(),
  scrollIntoView: jest.fn(),
});

const renderRegistry = () => renderHook(() => useFieldRegistry()).result;

/** Lets the microtask that honours a pending request run */
const flushMicrotasks = () => act(async () => {});

describe('useFieldRegistry', () => {
  describe('focusField', () => {
    it('should focus the registered field and scroll it to the centre', () => {
      const registry = renderRegistry();
      const field = makeField();
      registry.current.registerField('title', field);

      const focused = registry.current.focusField('title');

      expect(focused).toBe(true);
      expect(field.focus).toHaveBeenCalledTimes(1);
      expect(field.scrollIntoView).toHaveBeenCalledWith({ block: 'center' });
    });

    it('should focus a field that cannot scroll (jsdom elements)', () => {
      const registry = renderRegistry();
      const focus = jest.fn();
      registry.current.registerField('title', { focus });

      registry.current.focusField('title');

      expect(focus).toHaveBeenCalledTimes(1);
    });

    it('should fall back to the row, then to the list', () => {
      const registry = renderRegistry();
      const list = makeField();
      registry.current.registerField('steps', list);

      const focused = registry.current.focusField('steps.s1.image');

      expect(focused).toBe(true);
      expect(list.focus).toHaveBeenCalledTimes(1);
    });

    it('should prefer the most specific registered path', () => {
      const registry = renderRegistry();
      const list = makeField();
      const textarea = makeField();
      registry.current.registerField('steps', list);
      registry.current.registerField('steps.s1.description', textarea);

      registry.current.focusField('steps.s1.description');

      expect(textarea.focus).toHaveBeenCalledTimes(1);
      expect(list.focus).not.toHaveBeenCalled();
    });

    it('should return false when nothing is registered for the path', () => {
      const registry = renderRegistry();

      expect(registry.current.focusField('title')).toBe(false);
    });

    it('should not focus a field that was unregistered', () => {
      const registry = renderRegistry();
      const field = makeField();
      registry.current.registerField('title', field);
      registry.current.registerField('title', null);

      const focused = registry.current.focusField('title');

      expect(focused).toBe(false);
      expect(field.focus).not.toHaveBeenCalled();
    });
  });

  describe('pending focus', () => {
    it('should focus a field that registers after the request', async () => {
      const registry = renderRegistry();
      const field = makeField();
      registry.current.focusField('cookingTime');

      registry.current.registerField('cookingTime', field);
      await flushMicrotasks();

      expect(field.focus).toHaveBeenCalledTimes(1);
    });

    it('should wait for the most specific field of the panel that mounts', async () => {
      const registry = renderRegistry();
      const list = makeField();
      const textarea = makeField();
      registry.current.focusField('steps.s1.description');

      registry.current.registerField('steps', list);
      registry.current.registerField('steps.s1.description', textarea);
      await flushMicrotasks();

      expect(textarea.focus).toHaveBeenCalledTimes(1);
      expect(list.focus).not.toHaveBeenCalled();
    });

    it('should ignore fields that register for another path', async () => {
      const registry = renderRegistry();
      const field = makeField();
      registry.current.focusField('cookingTime');

      registry.current.registerField('title', field);
      await flushMicrotasks();

      expect(field.focus).not.toHaveBeenCalled();
    });

    it('should honour a request only once', async () => {
      const registry = renderRegistry();
      const field = makeField();
      registry.current.focusField('title');
      registry.current.registerField('title', field);
      await flushMicrotasks();

      registry.current.registerField('title', field);
      await flushMicrotasks();

      expect(field.focus).toHaveBeenCalledTimes(1);
    });

    it('should drop a request that was met by a later focusField', async () => {
      const registry = renderRegistry();
      const title = makeField();
      const servings = makeField();
      registry.current.registerField('servings', servings);
      registry.current.focusField('title');
      registry.current.focusField('servings');

      registry.current.registerField('title', title);
      await flushMicrotasks();

      expect(title.focus).not.toHaveBeenCalled();
    });

    it('should drop a request nobody answered in time', async () => {
      const now = jest.spyOn(Date, 'now').mockReturnValue(1_000);
      const registry = renderRegistry();
      const field = makeField();
      registry.current.focusField('title');

      now.mockReturnValue(1_000 + PENDING_FOCUS_MS + 1);
      registry.current.registerField('title', field);
      await flushMicrotasks();
      now.mockRestore();

      expect(field.focus).not.toHaveBeenCalled();
    });
  });

  describe('identity', () => {
    it('should keep registerField and focusField stable across renders', () => {
      const { result, rerender } = renderHook(() => useFieldRegistry());
      const first: FieldRegistry = result.current;

      rerender();

      expect(result.current).toBe(first);
    });
  });
});

describe('useFieldRef', () => {
  function Field({ registerField }: { registerField?: FieldRegistry['registerField'] }) {
    const [count, setCount] = useState(0);
    const ref = useFieldRef<HTMLInputElement>(registerField, 'title');
    return (
      <>
        <input ref={ref} aria-label="Title" />
        <button type="button" onClick={() => setCount(count + 1)}>
          Rerender {count}
        </button>
      </>
    );
  }

  it('should register the element under its path on mount', () => {
    const registerField = jest.fn();

    render(<Field registerField={registerField} />);

    expect(registerField).toHaveBeenCalledWith('title', screen.getByLabelText('Title'));
  });

  it('should not register again when the component re-renders', () => {
    const registerField = jest.fn();
    render(<Field registerField={registerField} />);

    act(() => screen.getByRole('button').click());

    expect(registerField).toHaveBeenCalledTimes(1);
  });

  it('should unregister the path on unmount', () => {
    const registerField = jest.fn();
    const { unmount } = render(<Field registerField={registerField} />);

    unmount();

    expect(registerField).toHaveBeenLastCalledWith('title', null);
  });

  it('should do nothing without a registry', () => {
    render(<Field />);

    expect(screen.getByLabelText('Title')).toBeInTheDocument();
  });
});
