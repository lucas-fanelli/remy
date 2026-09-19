import {
  focusNextField,
  focusRowField,
  getFormFields,
  isBackspaceOnEmpty,
  isModEnter,
  isPlainEnter,
  neighbourRowId,
} from '../keyboard';
import type { KeyboardEvent as ReactKeyboardEvent } from 'react';

const key = (name: string, modifiers: Partial<KeyboardEventInit> = {}) => ({
  key: name,
  shiftKey: false,
  ctrlKey: false,
  metaKey: false,
  altKey: false,
  ...modifiers,
});

/** The slice of a React keyboard event that focusNextField reads */
const keyDownOn = (target: HTMLElement, init: Partial<KeyboardEventInit> = {}) => {
  const event = {
    ...key('Enter', init),
    target,
    defaultPrevented: false,
    nativeEvent: { isComposing: false },
    preventDefault: jest.fn(() => {
      event.defaultPrevented = true;
    }),
  };
  return event as unknown as ReactKeyboardEvent<HTMLElement> & { preventDefault: jest.Mock };
};

const mount = (html: string): HTMLElement => {
  document.body.innerHTML = html;
  return document.body;
};

afterEach(() => {
  document.body.innerHTML = '';
});

describe('key predicates', () => {
  it('should recognise Enter on its own', () => {
    expect(isPlainEnter(key('Enter'))).toBe(true);
  });

  it.each([{ shiftKey: true }, { ctrlKey: true }, { metaKey: true }, { altKey: true }])(
    'should not treat Enter with %p as plain',
    (modifiers) => {
      expect(isPlainEnter(key('Enter', modifiers))).toBe(false);
    }
  );

  it('should not treat the Enter that confirms an IME composition as a command', () => {
    expect(isPlainEnter({ ...key('Enter'), nativeEvent: { isComposing: true } })).toBe(false);
  });

  it('should read isComposing from a native event too', () => {
    expect(isPlainEnter({ ...key('Enter'), isComposing: true })).toBe(false);
  });

  it('should not treat another key as Enter', () => {
    expect(isPlainEnter(key('a'))).toBe(false);
  });

  it.each([{ ctrlKey: true }, { metaKey: true }])(
    'should recognise Enter with %p as the add shortcut',
    (modifiers) => {
      expect(isModEnter(key('Enter', modifiers))).toBe(true);
    }
  );

  it('should not treat plain Enter as the add shortcut', () => {
    expect(isModEnter(key('Enter'))).toBe(false);
  });

  it('should recognise Backspace in an empty control', () => {
    const target = document.createElement('input');

    expect(isBackspaceOnEmpty({ ...key('Backspace'), target })).toBe(true);
  });

  it('should not treat Backspace in a control with text as a removal', () => {
    const target = document.createElement('input');
    target.value = '2';

    expect(isBackspaceOnEmpty({ ...key('Backspace'), target })).toBe(false);
  });

  it('should not treat Backspace with a modifier as a removal', () => {
    const target = document.createElement('input');

    expect(isBackspaceOnEmpty({ ...key('Backspace', { ctrlKey: true }), target })).toBe(false);
  });

  it('should not treat Backspace without a target as a removal', () => {
    expect(isBackspaceOnEmpty({ ...key('Backspace'), target: null })).toBe(false);
  });
});

describe('getFormFields', () => {
  it('should list the fields a keyboard user can land on, in DOM order', () => {
    const scope = mount(`
      <form>
        <input id="title" />
        <input id="hidden" type="hidden" />
        <input id="file" type="file" />
        <input id="disabled" disabled />
        <input id="skipped" tabindex="-1" />
        <textarea id="shadow" aria-hidden="true"></textarea>
        <div hidden><input id="in-hidden-panel" /></div>
        <fieldset disabled><input id="in-disabled-fieldset" /></fieldset>
        <textarea id="description"></textarea>
        <select id="unit"></select>
        <div id="chip" data-form-field tabindex="0"></div>
        <button id="publish" type="button">Publish</button>
      </form>
    `);

    const ids = getFormFields(scope).map((element) => element.id);

    expect(ids).toEqual(['title', 'description', 'unit', 'chip']);
  });
});

describe('focusNextField', () => {
  it('should move focus to the next field on Enter', () => {
    mount('<form><input id="a" /><input id="b" /></form>');
    const event = keyDownOn(document.getElementById('a')!);

    const handled = focusNextField(event);

    expect(handled).toBe(true);
    expect(document.activeElement?.id).toBe('b');
  });

  it('should prevent the default so Enter can never submit', () => {
    mount('<form><input id="a" /><input id="b" /></form>');
    const event = keyDownOn(document.getElementById('a')!);

    focusNextField(event);

    expect(event.preventDefault).toHaveBeenCalledTimes(1);
  });

  it('should still swallow Enter on the last field', () => {
    mount('<form><input id="a" /><button id="publish" type="button">Publish</button></form>');
    const last = document.getElementById('a')!;
    last.focus();
    const event = keyDownOn(last);

    const handled = focusNextField(event);

    expect(handled).toBe(true);
    expect(event.preventDefault).toHaveBeenCalledTimes(1);
    expect(document.activeElement?.id).toBe('a');
  });

  it('should stay inside the form of the field', () => {
    mount('<form><input id="a" /></form><input id="outside" />');
    const event = keyDownOn(document.getElementById('a')!);

    focusNextField(event);

    expect(document.activeElement?.id).not.toBe('outside');
  });

  it('should walk the document when the field is not inside a form', () => {
    mount('<input id="a" /><input id="b" />');
    const event = keyDownOn(document.getElementById('a')!);

    focusNextField(event);

    expect(document.activeElement?.id).toBe('b');
  });

  it('should leave Enter alone in a textarea, where it is a newline', () => {
    mount('<form><textarea id="a"></textarea><input id="b" /></form>');
    const event = keyDownOn(document.getElementById('a')!);

    const handled = focusNextField(event);

    expect(handled).toBe(false);
    expect(event.preventDefault).not.toHaveBeenCalled();
  });

  it('should leave Enter to an open combobox, where it picks the option', () => {
    mount('<form><input id="a" role="combobox" aria-expanded="true" /><input id="b" /></form>');
    const event = keyDownOn(document.getElementById('a')!);

    expect(focusNextField(event)).toBe(false);
  });

  it('should ignore an event somebody already handled', () => {
    mount('<form><input id="a" /><input id="b" /></form>');
    const event = keyDownOn(document.getElementById('a')!);
    event.preventDefault();

    expect(focusNextField(event)).toBe(false);
  });

  it('should ignore Enter with a modifier', () => {
    mount('<form><input id="a" /><input id="b" /></form>');
    const event = keyDownOn(document.getElementById('a')!, { ctrlKey: true });

    expect(focusNextField(event)).toBe(false);
  });

  it('should not move focus from a target that is not one of the fields', () => {
    mount('<form><div id="a" role="button" tabindex="0"></div><input id="b" /></form>');
    const event = keyDownOn(document.getElementById('a')!);

    focusNextField(event);

    expect(document.activeElement?.id).not.toBe('b');
  });
});

describe('focusRowField', () => {
  const rows = `
    <div id="list">
      <div data-row-id="r1"><input data-field="amount" id="r1-amount" /></div>
      <div data-row-id="r2">
        <div data-field="name"><input id="r2-name" /></div>
        <div data-field="empty"></div>
        <button data-field="chip" id="r2-chip" type="button">to taste</button>
      </div>
    </div>`;

  it('should focus a control that carries the data-field itself', () => {
    const container = mount(rows);

    const focused = focusRowField(container, 'r1', 'amount');

    expect(focused).toBe(true);
    expect(document.activeElement?.id).toBe('r1-amount');
  });

  it('should focus the input inside a wrapper that carries the data-field', () => {
    const container = mount(rows);

    focusRowField(container, 'r2', 'name');

    expect(document.activeElement?.id).toBe('r2-name');
  });

  it('should focus a button that carries the data-field', () => {
    const container = mount(rows);

    focusRowField(container, 'r2', 'chip');

    expect(document.activeElement?.id).toBe('r2-chip');
  });

  it('should report a row that is not in the DOM', () => {
    expect(focusRowField(mount(rows), 'missing', 'amount')).toBe(false);
  });

  it('should report a field that is not in the row', () => {
    expect(focusRowField(mount(rows), 'r1', 'name')).toBe(false);
  });

  it('should report a wrapper without a control', () => {
    expect(focusRowField(mount(rows), 'r2', 'empty')).toBe(false);
  });

  it('should report a missing container', () => {
    expect(focusRowField(null, 'r1', 'amount')).toBe(false);
  });
});

describe('neighbourRowId', () => {
  const rows = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];

  it('should pick the next row', () => {
    expect(neighbourRowId(rows, 'b')).toBe('c');
  });

  it('should pick the previous row when the last one is removed', () => {
    expect(neighbourRowId(rows, 'c')).toBe('b');
  });

  it('should return null when the only row is removed', () => {
    expect(neighbourRowId([{ id: 'a' }], 'a')).toBeNull();
  });

  it('should return null for a row that is not in the list', () => {
    expect(neighbourRowId(rows, 'missing')).toBeNull();
  });
});
