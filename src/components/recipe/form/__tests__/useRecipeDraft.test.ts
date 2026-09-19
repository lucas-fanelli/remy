import { act, renderHook } from '@testing-library/react';
import { RecipeFormValues } from '../types';
import {
  clearRecipeDraft,
  DraftStorage,
  getDefaultDraftStorage,
  isBlankDraft,
  parseRecipeDraft,
  readRecipeDraft,
  RECIPE_DRAFT_DEBOUNCE_MS,
  recipeDraftKey,
  RecipeDraft,
  toDraftValues,
  useRecipeDraft,
  UseRecipeDraftOptions,
  useUnsavedChangesWarning,
  writeRecipeDraft,
} from '../useRecipeDraft';
import { useRecipeForm } from '../useRecipeForm';
import { makeValues, STEP_URL } from './fixtures';

const USER_KEY = 'remy:recipe-draft:v1:user-1';
const SAVED_AT = 1_700_000_000_000;

/** In-memory Storage: the boundary the hook talks to */
const createStorage = (initial: Record<string, string> = {}) => {
  const data = new Map(Object.entries(initial));
  return {
    data,
    getItem: jest.fn((key: string) => data.get(key) ?? null),
    setItem: jest.fn((key: string, value: string) => {
      data.set(key, value);
    }),
    removeItem: jest.fn((key: string) => {
      data.delete(key);
    }),
  };
};

const throwingStorage = (): DraftStorage => ({
  getItem: jest.fn(() => {
    throw new Error('SecurityError');
  }),
  setItem: jest.fn(() => {
    throw new Error('QuotaExceededError');
  }),
  removeItem: jest.fn(() => {
    throw new Error('SecurityError');
  }),
});

const blankValues = (): RecipeFormValues =>
  makeValues({
    title: '',
    description: '',
    imageUrl: '',
    caption: '',
    prepTime: '',
    cookingTime: '',
    servings: 4,
    difficulty: 'medium',
    ingredients: [{ id: 'i1', name: '', amount: '', unit: '' }],
    steps: [{ id: 's1', description: '', image: '' }],
  });

const storedDraft = (overrides: Partial<RecipeDraft> = {}): string =>
  JSON.stringify({
    v: 1,
    savedAt: SAVED_AT,
    section: 'steps',
    values: toDraftValues(makeValues()),
    ...overrides,
  });

const renderDraft = (
  options: Partial<UseRecipeDraftOptions> & { storage: DraftStorage | null }
) => {
  const initialProps: UseRecipeDraftOptions = {
    userId: 'user-1',
    values: blankValues(),
    now: () => SAVED_AT,
    ...options,
  };
  return renderHook((props: UseRecipeDraftOptions) => useRecipeDraft(props), { initialProps });
};

const savedIn = (storage: ReturnType<typeof createStorage>, key = USER_KEY) =>
  JSON.parse(storage.data.get(key) ?? 'null');

describe('toDraftValues', () => {
  it('should strip row ids and trailing blank rows', () => {
    const draft = toDraftValues(makeValues());

    expect(draft.ingredients).toEqual([
      { name: 'Chocolinas', amount: '500', unit: 'g' },
      { name: 'Dulce de leche', amount: '400', unit: 'g' },
    ]);
    expect(draft.steps[0]).toEqual({ description: 'Mix the filling', image: '' });
  });

  it('should never keep a blob: URL', () => {
    const values = makeValues({
      imageUrl: 'blob:http://localhost/cover',
      steps: [{ id: 's1', description: 'Mix', image: 'blob:http://localhost/step' }],
    });

    const draft = toDraftValues(values);

    expect(draft.imageUrl).toBe('');
    expect(draft.steps).toEqual([{ description: 'Mix', image: '' }]);
  });

  it('should keep finished Cloudinary uploads', () => {
    const draft = toDraftValues(makeValues());

    expect(draft.steps[1].image).toBe(STEP_URL);
  });

  it('should serialise to strings and numbers only', () => {
    const roundTrip = JSON.parse(JSON.stringify(toDraftValues(makeValues())));

    expect(roundTrip).toEqual(toDraftValues(makeValues()));
  });
});

describe('isBlankDraft', () => {
  it('should treat the prefilled servings and difficulty as nothing typed', () => {
    expect(isBlankDraft(toDraftValues(blankValues()))).toBe(true);
  });

  it.each([
    ['a title', { title: 'Flan' }],
    ['a description', { description: 'Sweet' }],
    ['a cover', { imageUrl: STEP_URL }],
    ['a closing note', { caption: 'Enjoy' }],
    ['a prep time', { prepTime: 0 }],
    ['a cook time', { cookingTime: 30 }],
    ['an ingredient', { ingredients: [{ id: 'i1', name: 'Milk', amount: '', unit: '' }] }],
    ['a step', { steps: [{ id: 's1', description: 'Boil', image: '' }] }],
  ] as const)('should see %s as content', (_name, overrides) => {
    const values = { ...blankValues(), ...overrides } as RecipeFormValues;

    expect(isBlankDraft(toDraftValues(values))).toBe(false);
  });
});

describe('parseRecipeDraft', () => {
  it('should accept a v1 draft', () => {
    expect(parseRecipeDraft(storedDraft())).toEqual({
      v: 1,
      savedAt: SAVED_AT,
      section: 'steps',
      values: toDraftValues(makeValues()),
    });
  });

  it.each([
    ['nothing stored', null],
    ['an empty string', ''],
    ['text that is not JSON', '{not json'],
    ['a JSON primitive', '42'],
    ['a JSON array', '[]'],
    ['another version', storedDraft({ v: 2 as never })],
    ['a missing savedAt', storedDraft({ savedAt: undefined as never })],
    ['a savedAt that is not finite', storedDraft({ savedAt: 'yesterday' as never })],
    ['values that are not an object', storedDraft({ values: 'oops' as never })],
  ])('should discard %s', (_name, raw) => {
    expect(parseRecipeDraft(raw)).toBeNull();
  });

  it.each([
    ['a title that is not a string', { title: 7 }],
    ['a cook time that is a string', { cookingTime: '30' }],
    ['a prep time that is not finite', { prepTime: null }],
    ['an unknown difficulty', { difficulty: 'extreme' }],
    ['a difficulty that is not a string', { difficulty: 3 }],
    ['ingredients that are not an array', { ingredients: {} }],
    ['steps that are not an array', { steps: 'none' }],
    ['an ingredient row of the wrong shape', { ingredients: [{ name: 'Milk', amount: 1 }] }],
    ['an ingredient row that is not an object', { ingredients: ['Milk'] }],
    ['a step row of the wrong shape', { steps: [{ description: 'Boil' }] }],
    ['a step row that is not an object', { steps: [null] }],
  ])('should discard a draft with %s', (_name, badValues) => {
    const values = { ...toDraftValues(makeValues()), ...badValues };

    expect(parseRecipeDraft(storedDraft({ values: values as never }))).toBeNull();
  });

  it('should discard a draft with nothing in it', () => {
    const raw = storedDraft({ values: toDraftValues(blankValues()) });

    expect(parseRecipeDraft(raw)).toBeNull();
  });

  it('should fall back to the first section when the stored one is unknown', () => {
    const raw = storedDraft({ section: 'review-step-of-another-branch' });

    expect(parseRecipeDraft(raw)?.section).toBe('basics');
  });

  it('should fall back to the first section when the stored one is not a string', () => {
    const raw = storedDraft({ section: 3 as never });

    expect(parseRecipeDraft(raw)?.section).toBe('basics');
  });

  it('should accept the section vocabulary of the caller', () => {
    const raw = storedDraft({ section: 'review' });

    expect(parseRecipeDraft(raw, ['write', 'review'])?.section).toBe('review');
  });

  it('should drop unknown keys written by another build', () => {
    const values = { ...toDraftValues(makeValues()), mood: 'hungry' };
    const raw = storedDraft({ values: values as never });

    expect(parseRecipeDraft(raw)?.values).not.toHaveProperty('mood');
  });

  it('should drop images that are not finished uploads', () => {
    const values = { ...toDraftValues(makeValues()), imageUrl: 'blob:http://localhost/1' };
    const raw = storedDraft({ values });

    expect(parseRecipeDraft(raw)?.values.imageUrl).toBe('');
  });
});

describe('storage helpers', () => {
  it('should build one key per user', () => {
    expect(recipeDraftKey('user-1')).toBe(USER_KEY);
  });

  it('should read a stored draft', () => {
    const storage = createStorage({ [USER_KEY]: storedDraft() });

    expect(readRecipeDraft(USER_KEY, storage)?.savedAt).toBe(SAVED_AT);
  });

  it('should read nothing when storage throws', () => {
    expect(readRecipeDraft(USER_KEY, throwingStorage())).toBeNull();
  });

  it('should read nothing when there is no storage', () => {
    expect(readRecipeDraft(USER_KEY, null)).toBeNull();
  });

  it('should report a failed write when storage throws', () => {
    const draft = parseRecipeDraft(storedDraft()) as RecipeDraft;

    expect(writeRecipeDraft(USER_KEY, draft, throwingStorage())).toBe(false);
  });

  it('should report a failed write when there is no storage', () => {
    const draft = parseRecipeDraft(storedDraft()) as RecipeDraft;

    expect(writeRecipeDraft(USER_KEY, draft, null)).toBe(false);
  });

  it('should write a draft that reads back', () => {
    const storage = createStorage();
    const draft = parseRecipeDraft(storedDraft()) as RecipeDraft;

    const written = writeRecipeDraft(USER_KEY, draft, storage);

    expect(written).toBe(true);
    expect(readRecipeDraft(USER_KEY, storage)).toEqual(draft);
  });

  it('should clear a stored draft, as logout does', () => {
    const storage = createStorage({ [USER_KEY]: storedDraft() });

    const cleared = clearRecipeDraft(USER_KEY, storage);

    expect(cleared).toBe(true);
    expect(storage.data.has(USER_KEY)).toBe(false);
  });

  it('should not throw when clearing fails', () => {
    expect(clearRecipeDraft(USER_KEY, throwingStorage())).toBe(false);
  });

  it('should report nothing cleared when there is no storage', () => {
    expect(clearRecipeDraft(USER_KEY, null)).toBe(false);
  });

  it('should default to window.localStorage', () => {
    expect(getDefaultDraftStorage()).toBe(window.localStorage);
  });

  it('should have no default storage when reading window.localStorage throws', () => {
    const original = Object.getOwnPropertyDescriptor(window, 'localStorage');
    Object.defineProperty(window, 'localStorage', {
      configurable: true,
      get: () => {
        throw new Error('SecurityError');
      },
    });

    const storage = getDefaultDraftStorage();

    if (original) Object.defineProperty(window, 'localStorage', original);
    expect(storage).toBeNull();
  });

  it('should have no default storage when the window has no localStorage', () => {
    const original = Object.getOwnPropertyDescriptor(window, 'localStorage');
    Object.defineProperty(window, 'localStorage', { configurable: true, get: () => undefined });

    const storage = getDefaultDraftStorage();

    if (original) Object.defineProperty(window, 'localStorage', original);
    expect(storage).toBeNull();
  });

  it('should write to and clear the default storage when none is passed', () => {
    const draft = parseRecipeDraft(storedDraft()) as RecipeDraft;

    const written = writeRecipeDraft(USER_KEY, draft);
    const stored = window.localStorage.getItem(USER_KEY);
    const cleared = clearRecipeDraft(USER_KEY);

    expect(written).toBe(true);
    expect(stored).toBe(JSON.stringify(draft));
    expect(cleared).toBe(true);
    expect(window.localStorage.getItem(USER_KEY)).toBeNull();
  });

  it('should use the default storage when none is passed', () => {
    window.localStorage.setItem(USER_KEY, storedDraft());

    const draft = readRecipeDraft(USER_KEY);

    window.localStorage.removeItem(USER_KEY);
    expect(draft?.savedAt).toBe(SAVED_AT);
  });
});

describe('useRecipeDraft', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  const typeAndWait = (
    rerender: (props: UseRecipeDraftOptions) => void,
    props: UseRecipeDraftOptions
  ) => {
    rerender(props);
    act(() => {
      jest.advanceTimersByTime(RECIPE_DRAFT_DEBOUNCE_MS);
    });
  };

  describe('restore', () => {
    it('should expose the draft found in storage', () => {
      const storage = createStorage({ [USER_KEY]: storedDraft() });

      const { result } = renderDraft({ storage });

      expect(result.current.draft).toMatchObject({ savedAt: SAVED_AT, section: 'steps' });
    });

    it('should read the draft of the current user only', () => {
      const storage = createStorage({ 'remy:recipe-draft:v1:someone-else': storedDraft() });

      const { result } = renderDraft({ storage });

      expect(result.current.draft).toBeNull();
      expect(storage.getItem).toHaveBeenCalledWith(USER_KEY);
    });

    it('should use an injected key as it is', () => {
      const storage = createStorage({ 'custom-key': storedDraft() });

      const { result } = renderDraft({ storage, storageKey: 'custom-key' });

      expect(result.current.draft).not.toBeNull();
    });

    it('should discard a draft of another version silently', () => {
      const storage = createStorage({ [USER_KEY]: storedDraft({ v: 2 as never }) });

      const { result } = renderDraft({ storage });

      expect(result.current.draft).toBeNull();
    });

    it('should discard a draft of another shape silently', () => {
      const storage = createStorage({
        [USER_KEY]: JSON.stringify({ v: 1, savedAt: 1, values: 3 }),
      });

      const { result } = renderDraft({ storage });

      expect(result.current.draft).toBeNull();
    });

    it('should not throw when reading storage throws', () => {
      const { result } = renderDraft({ storage: throwingStorage() });

      expect(result.current.draft).toBeNull();
    });

    it('should be inert without a user', () => {
      const storage = createStorage();

      const { result } = renderDraft({ storage, userId: null });

      expect(result.current.draft).toBeNull();
      expect(storage.getItem).not.toHaveBeenCalled();
    });

    it('should read again when the user changes', () => {
      const storage = createStorage({ 'remy:recipe-draft:v1:user-2': storedDraft() });
      const { result, rerender } = renderDraft({ storage });

      rerender({ userId: 'user-2', values: blankValues(), storage });

      expect(result.current.draft).not.toBeNull();
    });

    it('should fall back to window.localStorage when no storage is injected', () => {
      window.localStorage.setItem(USER_KEY, storedDraft());

      const { result } = renderHook(() =>
        useRecipeDraft({ userId: 'user-1', values: blankValues() })
      );

      window.localStorage.removeItem(USER_KEY);
      expect(result.current.draft).not.toBeNull();
    });
  });

  describe('autosave', () => {
    it('should write the draft once typing pauses for the debounce time', () => {
      const storage = createStorage();
      const { rerender } = renderDraft({ storage });

      rerender({ userId: 'user-1', values: makeValues(), section: 'ingredients', storage });
      act(() => {
        jest.advanceTimersByTime(RECIPE_DRAFT_DEBOUNCE_MS - 1);
      });
      const beforeTheDebounce = storage.setItem.mock.calls.length;
      act(() => {
        jest.advanceTimersByTime(1);
      });

      expect(beforeTheDebounce).toBe(0);
      expect(storage.setItem).toHaveBeenCalledTimes(1);
    });

    it('should store { v, savedAt, section, values } without ids', () => {
      const storage = createStorage();
      const { rerender } = renderDraft({ storage });

      typeAndWait(rerender, {
        userId: 'user-1',
        values: makeValues(),
        section: 'ingredients',
        storage,
        now: () => SAVED_AT,
      });

      expect(savedIn(storage)).toEqual({
        v: 1,
        savedAt: SAVED_AT,
        section: 'ingredients',
        values: toDraftValues(makeValues()),
      });
      expect(storage.data.get(USER_KEY)).not.toContain('"id"');
    });

    it('should write only once for a burst of changes', () => {
      const storage = createStorage();
      const { rerender } = renderDraft({ storage });

      rerender({ userId: 'user-1', values: makeValues({ title: 'C' }), storage });
      rerender({ userId: 'user-1', values: makeValues({ title: 'Ch' }), storage });
      typeAndWait(rerender, { userId: 'user-1', values: makeValues({ title: 'Cho' }), storage });

      expect(storage.setItem).toHaveBeenCalledTimes(1);
      expect(savedIn(storage).values.title).toBe('Cho');
    });

    it('should report when the draft was saved', () => {
      const storage = createStorage();
      const { result, rerender } = renderDraft({ storage });

      typeAndWait(rerender, {
        userId: 'user-1',
        values: makeValues(),
        storage,
        now: () => SAVED_AT,
      });

      expect(result.current.savedAt).toBe(SAVED_AT);
      expect(result.current.saveFailed).toBe(false);
    });

    it('should not write anything for an untouched blank form', () => {
      const storage = createStorage();
      renderDraft({ storage });

      act(() => {
        jest.advanceTimersByTime(RECIPE_DRAFT_DEBOUNCE_MS * 2);
      });

      expect(storage.setItem).not.toHaveBeenCalled();
      expect(storage.removeItem).not.toHaveBeenCalled();
    });

    it('should not wipe a stored draft while the blank form waits for the restore', () => {
      const storage = createStorage({ [USER_KEY]: storedDraft() });
      renderDraft({ storage });

      act(() => {
        jest.advanceTimersByTime(RECIPE_DRAFT_DEBOUNCE_MS * 2);
      });

      expect(storage.data.has(USER_KEY)).toBe(true);
    });

    it('should not refresh savedAt when the restored draft is loaded into the form', () => {
      const storage = createStorage({ [USER_KEY]: storedDraft() });
      const { rerender } = renderDraft({ storage });

      typeAndWait(rerender, { userId: 'user-1', values: makeValues(), storage, now: () => 999 });

      expect(storage.setItem).not.toHaveBeenCalled();
      expect(savedIn(storage).savedAt).toBe(SAVED_AT);
    });

    it('should not write when the shell goes to the section of the restored draft', () => {
      const storage = createStorage({ [USER_KEY]: storedDraft() });
      const { rerender } = renderDraft({ storage });
      const values = makeValues();

      typeAndWait(rerender, { userId: 'user-1', values, section: 'steps', storage });

      expect(storage.setItem).not.toHaveBeenCalled();
    });

    it('should remember that the author moved on, even with nothing else changed', () => {
      const storage = createStorage({ [USER_KEY]: storedDraft() });
      const { rerender } = renderDraft({ storage });
      const values = makeValues();
      typeAndWait(rerender, { userId: 'user-1', values, section: 'steps', storage });

      typeAndWait(rerender, { userId: 'user-1', values, section: 'presentation', storage });

      expect(savedIn(storage).section).toBe('presentation');
    });

    it('should not write again for the section it has just stored', () => {
      const storage = createStorage();
      const { rerender } = renderDraft({ storage });
      const values = makeValues();
      typeAndWait(rerender, { userId: 'user-1', values, section: 'steps', storage });

      typeAndWait(rerender, { userId: 'user-1', values: { ...values }, section: 'steps', storage });

      expect(storage.setItem).toHaveBeenCalledTimes(1);
    });

    it('should save again once the author edits the restored draft', () => {
      const storage = createStorage({ [USER_KEY]: storedDraft() });
      const { rerender } = renderDraft({ storage });
      rerender({ userId: 'user-1', values: makeValues(), storage });

      typeAndWait(rerender, { userId: 'user-1', values: makeValues({ title: 'Flan' }), storage });

      expect(savedIn(storage).values.title).toBe('Flan');
    });

    it('should never delete the stored draft because the form went blank', () => {
      const storage = createStorage({ [USER_KEY]: storedDraft() });
      const { rerender } = renderDraft({ storage });
      rerender({ userId: 'user-1', values: makeValues(), storage });

      typeAndWait(rerender, { userId: 'user-1', values: blankValues(), storage });

      expect(storage.removeItem).not.toHaveBeenCalled();
      expect(savedIn(storage).savedAt).toBe(SAVED_AT);
    });

    it('should not write a blank form over the stored draft', () => {
      const storage = createStorage({ [USER_KEY]: storedDraft() });
      const { rerender } = renderDraft({ storage });
      rerender({ userId: 'user-1', values: makeValues(), storage });

      typeAndWait(rerender, { userId: 'user-1', values: blankValues(), storage });

      expect(storage.setItem).not.toHaveBeenCalled();
    });

    it('should not overwrite a stored draft with values the author has not touched', () => {
      const storage = createStorage({ [USER_KEY]: storedDraft() });
      renderDraft({ storage, values: makeValues({ title: 'Prefilled elsewhere' }) });

      act(() => {
        jest.advanceTimersByTime(RECIPE_DRAFT_DEBOUNCE_MS * 2);
      });

      expect(storage.setItem).not.toHaveBeenCalled();
    });

    it('should not write while disabled', () => {
      const storage = createStorage();
      const { rerender } = renderDraft({ storage, enabled: false });

      typeAndWait(rerender, { userId: 'user-1', values: makeValues(), storage, enabled: false });

      expect(storage.setItem).not.toHaveBeenCalled();
    });

    it('should not write without a user', () => {
      const storage = createStorage();
      const { rerender } = renderDraft({ storage, userId: undefined });

      typeAndWait(rerender, { userId: undefined, values: makeValues(), storage });

      expect(storage.setItem).not.toHaveBeenCalled();
    });

    it('should flag a failed write and keep working when storage throws', () => {
      const storage = throwingStorage();
      const { result, rerender } = renderDraft({ storage });

      typeAndWait(rerender, { userId: 'user-1', values: makeValues(), storage });

      expect(result.current.saveFailed).toBe(true);
      expect(result.current.savedAt).toBeNull();
    });

    it('should flag a failed write when persistence is switched off with a null storage', () => {
      const { result, rerender } = renderDraft({ storage: null });

      typeAndWait(rerender, { userId: 'user-1', values: makeValues(), storage: null });

      expect(result.current.saveFailed).toBe(true);
    });

    it('should write the pending draft on flush without waiting', () => {
      const storage = createStorage();
      const { result, rerender } = renderDraft({ storage });
      rerender({ userId: 'user-1', values: makeValues(), storage });

      act(() => result.current.flush());

      expect(storage.setItem).toHaveBeenCalledTimes(1);
    });

    it('should do nothing on flush when nothing is pending', () => {
      const storage = createStorage();
      const { result } = renderDraft({ storage });

      act(() => result.current.flush());

      expect(storage.setItem).not.toHaveBeenCalled();
    });

    it('should write the last keystrokes when the editor closes inside the debounce window', () => {
      const storage = createStorage();
      const { rerender, unmount } = renderDraft({ storage });
      rerender({ userId: 'user-1', values: makeValues({ title: 'Closing soon' }), storage });

      unmount();

      expect(savedIn(storage).values.title).toBe('Closing soon');
    });
  });

  describe('a form that is reset in place', () => {
    type EditorProps = { resetKey: string; userId: string | null };
    const OPEN: EditorProps = { resetKey: 'create:true', userId: 'user-1' };
    const CLOSED: EditorProps = { resetKey: 'create:false', userId: 'user-1' };

    // A dialog that stays mounted: closing it only flips the resetKey both hooks receive,
    // and useRecipeForm answers with blank values in that same render
    const renderEditor = (storage: DraftStorage, { passResetKey = true } = {}) =>
      renderHook(
        ({ resetKey, userId }: EditorProps) => {
          const form = useRecipeForm({ resetKey });
          const draft = useRecipeDraft({
            userId,
            values: form.values,
            resetKey: passResetKey ? resetKey : undefined,
            storage,
            now: () => SAVED_AT,
          });
          return { form, draft };
        },
        { initialProps: OPEN }
      );

    const wait = (ms: number) =>
      act(() => {
        jest.advanceTimersByTime(ms);
      });

    it('should keep the stored draft when the dialog closes and the form goes blank', () => {
      const storage = createStorage();
      const { result, rerender } = renderEditor(storage);
      act(() => result.current.form.setField('title', 'Chocotorta'));
      wait(RECIPE_DRAFT_DEBOUNCE_MS);

      rerender(CLOSED);
      wait(RECIPE_DRAFT_DEBOUNCE_MS * 2);

      expect(result.current.form.values.title).toBe('');
      expect(savedIn(storage).values.title).toBe('Chocotorta');
    });

    it('should keep the stored draft even when the shell does not pass the resetKey', () => {
      const storage = createStorage();
      const { result, rerender } = renderEditor(storage, { passResetKey: false });
      act(() => result.current.form.setField('title', 'Chocotorta'));
      wait(RECIPE_DRAFT_DEBOUNCE_MS);

      rerender(CLOSED);
      wait(RECIPE_DRAFT_DEBOUNCE_MS * 2);

      expect(savedIn(storage).values.title).toBe('Chocotorta');
    });

    it('should keep the stored draft when reset() blanks the form', () => {
      const storage = createStorage();
      const { result } = renderEditor(storage);
      act(() => result.current.form.setField('title', 'Chocotorta'));
      wait(RECIPE_DRAFT_DEBOUNCE_MS);

      act(() => result.current.form.reset());
      wait(RECIPE_DRAFT_DEBOUNCE_MS * 2);

      expect(savedIn(storage).values.title).toBe('Chocotorta');
    });

    it('should offer the draft written in this session when the dialog reopens', () => {
      const storage = createStorage();
      const { result, rerender } = renderEditor(storage);
      act(() => result.current.form.setField('title', 'Chocotorta'));
      wait(RECIPE_DRAFT_DEBOUNCE_MS);
      rerender(CLOSED);

      rerender(OPEN);

      expect(result.current.draft.draft?.values.title).toBe('Chocotorta');
    });

    it('should write the keystrokes of the debounce window before the form is reset', () => {
      const storage = createStorage();
      const { result, rerender } = renderEditor(storage);
      act(() => result.current.form.setField('title', 'Closing right away'));

      rerender(CLOSED);

      expect(savedIn(storage).values.title).toBe('Closing right away');
      expect(result.current.draft.draft?.values.title).toBe('Closing right away');
    });

    it('should not save again when the restored draft is loaded after reopening', () => {
      const storage = createStorage();
      const { result, rerender } = renderEditor(storage);
      act(() => result.current.form.setField('title', 'Chocotorta'));
      wait(RECIPE_DRAFT_DEBOUNCE_MS);
      rerender(CLOSED);
      rerender(OPEN);
      storage.setItem.mockClear();

      act(() => result.current.form.load(result.current.draft.draft!.values));
      wait(RECIPE_DRAFT_DEBOUNCE_MS * 2);

      expect(result.current.form.values.title).toBe('Chocotorta');
      expect(storage.setItem).not.toHaveBeenCalled();
    });

    it('should forget Draft saved once the form is reset', () => {
      const storage = createStorage();
      const { result, rerender } = renderEditor(storage);
      act(() => result.current.form.setField('title', 'Chocotorta'));
      wait(RECIPE_DRAFT_DEBOUNCE_MS);
      const savedBeforeClosing = result.current.draft.savedAt;

      rerender(CLOSED);

      expect(savedBeforeClosing).toBe(SAVED_AT);
      expect(result.current.draft.savedAt).toBeNull();
    });

    it('should forget a failed write once the form is reset', () => {
      const { result, rerender } = renderEditor(throwingStorage());
      act(() => result.current.form.setField('title', 'Chocotorta'));
      wait(RECIPE_DRAFT_DEBOUNCE_MS);
      const failedBeforeClosing = result.current.draft.saveFailed;

      rerender(CLOSED);

      expect(failedBeforeClosing).toBe(true);
      expect(result.current.draft.saveFailed).toBe(false);
    });

    it('should not write a pending autosave back after logout cleared the draft', () => {
      const storage = createStorage({ [USER_KEY]: storedDraft() });
      const { result, rerender } = renderEditor(storage);
      act(() => result.current.form.setField('title', 'Typed just before logging out'));
      clearRecipeDraft(USER_KEY, storage);

      rerender({ resetKey: 'create:true', userId: null });
      wait(RECIPE_DRAFT_DEBOUNCE_MS * 2);

      expect(storage.data.has(USER_KEY)).toBe(false);
    });
  });

  describe('an editor that stays mounted while the user changes', () => {
    const OTHER_KEY = 'remy:recipe-draft:v1:user-2';
    const written = makeValues({ title: 'Secret recipe of user 1' });

    it("should never write what the last user left on screen under the next user's key", () => {
      const storage = createStorage();
      const { rerender } = renderDraft({ storage });
      typeAndWait(rerender, { userId: 'user-1', values: written, storage });
      clearRecipeDraft(USER_KEY, storage);
      rerender({ userId: null, values: written, storage });

      typeAndWait(rerender, { userId: 'user-2', values: written, storage });

      expect(storage.data.has(OTHER_KEY)).toBe(false);
    });

    it('should not bring back a draft that logout cleared when the same user logs in again', () => {
      const storage = createStorage();
      const { rerender } = renderDraft({ storage });
      typeAndWait(rerender, { userId: 'user-1', values: written, storage });
      clearRecipeDraft(USER_KEY, storage);
      rerender({ userId: null, values: written, storage });

      typeAndWait(rerender, { userId: 'user-1', values: written, storage });

      expect(storage.data.has(USER_KEY)).toBe(false);
    });

    it('should not bring a published recipe back as a draft after a logout and a login', () => {
      const storage = createStorage();
      const { result, rerender } = renderDraft({ storage });
      typeAndWait(rerender, { userId: 'user-1', values: written, storage });
      act(() => result.current.clearDraft());
      rerender({ userId: null, values: written, storage });

      typeAndWait(rerender, { userId: 'user-1', values: written, storage });

      expect(storage.data.has(USER_KEY)).toBe(false);
    });

    it('should not write them when the author only moves to another section', () => {
      const storage = createStorage();
      const { rerender } = renderDraft({ storage, values: written });

      typeAndWait(rerender, { userId: 'user-2', values: written, section: 'steps', storage });

      expect(storage.data.has(OTHER_KEY)).toBe(false);
    });

    it('should save for the new user from the first real edit on', () => {
      const storage = createStorage();
      const { rerender } = renderDraft({ storage, values: written });
      rerender({ userId: 'user-2', values: written, storage });

      typeAndWait(rerender, {
        userId: 'user-2',
        values: makeValues({ title: 'Written by user 2' }),
        storage,
      });

      expect(savedIn(storage, OTHER_KEY).values.title).toBe('Written by user 2');
    });
  });

  describe('clearDraft', () => {
    it('should remove the stored draft and forget the restored one', () => {
      const storage = createStorage({ [USER_KEY]: storedDraft() });
      const { result } = renderDraft({ storage });

      act(() => result.current.clearDraft());

      expect(storage.data.has(USER_KEY)).toBe(false);
      expect(result.current.draft).toBeNull();
    });

    it('should cancel a pending write', () => {
      const storage = createStorage();
      const { result, rerender } = renderDraft({ storage });
      rerender({ userId: 'user-1', values: makeValues(), storage });

      act(() => result.current.clearDraft());
      act(() => {
        jest.advanceTimersByTime(RECIPE_DRAFT_DEBOUNCE_MS);
      });

      expect(storage.setItem).not.toHaveBeenCalled();
    });

    it('should not write the published recipe back when the form re-renders or closes', () => {
      const storage = createStorage();
      const { result, rerender, unmount } = renderDraft({ storage });
      typeAndWait(rerender, { userId: 'user-1', values: makeValues(), storage });
      act(() => result.current.clearDraft());

      typeAndWait(rerender, { userId: 'user-1', values: makeValues(), section: 'steps', storage });
      unmount();

      expect(storage.data.has(USER_KEY)).toBe(false);
    });

    it('should save again when the author keeps typing after clearing', () => {
      const storage = createStorage();
      const { result, rerender } = renderDraft({ storage });
      typeAndWait(rerender, { userId: 'user-1', values: makeValues(), storage });
      act(() => result.current.clearDraft());

      typeAndWait(rerender, { userId: 'user-1', values: makeValues({ title: 'Next' }), storage });

      expect(savedIn(storage).values.title).toBe('Next');
    });

    it('should not throw when storage throws', () => {
      const { result } = renderDraft({ storage: throwingStorage() });

      expect(() => act(() => result.current.clearDraft())).not.toThrow();
    });

    it('should do nothing without a user', () => {
      const storage = createStorage();
      const { result } = renderDraft({ storage, userId: null });

      act(() => result.current.clearDraft());

      expect(storage.removeItem).not.toHaveBeenCalled();
    });
  });
});

describe('the free text stored with a draft', () => {
  const TEXT = { ingredients: '500 g harina\n2 huevos', method: 'Mezclar\n\nHornear' };

  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  const typeAndWait = (
    rerender: (props: UseRecipeDraftOptions) => void,
    props: UseRecipeDraftOptions
  ) => {
    rerender(props);
    act(() => {
      jest.advanceTimersByTime(RECIPE_DRAFT_DEBOUNCE_MS);
    });
  };

  it('should read the text of a stored draft', () => {
    const draft = parseRecipeDraft(storedDraft({ text: TEXT }));

    expect(draft?.text).toEqual(TEXT);
  });

  it.each([
    ['a string', 'harina'],
    ['a list', ['harina']],
    ['a half', { ingredients: 'harina' }],
    ['numbers', { ingredients: 1, method: 2 }],
  ])('should keep the draft and drop a text that is %s', (_label, text) => {
    const draft = parseRecipeDraft(storedDraft({ text } as unknown as Partial<RecipeDraft>));

    expect(draft).not.toBeNull();
    expect(draft).not.toHaveProperty('text');
  });

  it('should write the text next to the values', () => {
    const storage = createStorage();
    const { rerender } = renderDraft({ storage });

    typeAndWait(rerender, { userId: 'user-1', values: makeValues(), text: TEXT, storage });

    expect(savedIn(storage).text).toEqual(TEXT);
  });

  it('should write again when only the wording changed', () => {
    const storage = createStorage();
    const { rerender } = renderDraft({ storage });
    const values = makeValues();
    typeAndWait(rerender, { userId: 'user-1', values, text: TEXT, storage });

    typeAndWait(rerender, {
      userId: 'user-1',
      values,
      text: { ...TEXT, method: 'Mezclar bien\n\nHornear' },
      storage,
    });

    expect(storage.setItem).toHaveBeenCalledTimes(2);
    expect(savedIn(storage).text.method).toBe('Mezclar bien\n\nHornear');
  });

  it('should not write again for an equal text in a new object', () => {
    const storage = createStorage();
    const { rerender } = renderDraft({ storage });
    const values = makeValues();
    typeAndWait(rerender, { userId: 'user-1', values, text: TEXT, storage });

    typeAndWait(rerender, { userId: 'user-1', values, text: { ...TEXT }, storage });

    expect(storage.setItem).toHaveBeenCalledTimes(1);
  });

  it('should not rewrite a restored draft whose text is on screen again', () => {
    const storage = createStorage({ [USER_KEY]: storedDraft({ text: TEXT }) });
    const { rerender } = renderDraft({ storage });

    typeAndWait(rerender, { userId: 'user-1', values: makeValues(), text: TEXT, storage });

    expect(storage.setItem).not.toHaveBeenCalled();
  });

  it('should not save the text that was on screen when the draft was cleared', () => {
    const storage = createStorage();
    const { result, rerender } = renderDraft({ storage });
    const values = makeValues();
    typeAndWait(rerender, { userId: 'user-1', values, text: TEXT, storage });

    act(() => result.current.clearDraft());
    typeAndWait(rerender, { userId: 'user-1', values, text: { ...TEXT }, storage });

    expect(storage.data.has(USER_KEY)).toBe(false);
  });
});

describe('useUnsavedChangesWarning', () => {
  const fireBeforeUnload = () => {
    const event = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(event);
    return event;
  };

  it('should ask before leaving while active', () => {
    renderHook(() => useUnsavedChangesWarning(true));

    expect(fireBeforeUnload().defaultPrevented).toBe(true);
  });

  it('should stay out of the way while inactive', () => {
    renderHook(() => useUnsavedChangesWarning(false));

    expect(fireBeforeUnload().defaultPrevented).toBe(false);
  });

  it('should stop asking once unmounted', () => {
    const { unmount } = renderHook(() => useUnsavedChangesWarning(true));

    unmount();

    expect(fireBeforeUnload().defaultPrevented).toBe(false);
  });
});
