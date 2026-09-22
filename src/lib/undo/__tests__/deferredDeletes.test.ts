import { QueryClient } from '@tanstack/react-query';
import {
  UNDO_WINDOW_MS,
  deferDelete,
  isHidden,
  isWaiting,
  keepDeletesHidden,
  sendWaitingDelete,
  undoDelete,
  whenAnswered,
  type DeferredDelete,
} from '../deferredDeletes';

/**
 * A delete that waits, so that "Deshacer" can take it back without anything to rebuild —
 * Lucas's choice, made because a recipe's delete takes its photo and comments with it.
 */

/** An entry whose every effect is recorded, and whose commit the test answers. */
function entry(key: string, answer: () => Promise<void> = () => Promise.resolve()) {
  const log: string[] = [];
  const commit = jest.fn((options: { keepalive: boolean }) => {
    log.push(`commit${options.keepalive ? ':keepalive' : ''}`);
    return answer();
  });
  const deletion: DeferredDelete = {
    key,
    hide: () => log.push('hide'),
    restore: () => log.push('restore'),
    commit,
    onCommitted: () => log.push('committed'),
    onFailed: () => log.push('failed'),
    onSettled: () => log.push('settled'),
  };
  return { deletion, log, commit };
}

/** Let the commit's promise chain run. */
const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

describe('deferred deletes', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it('hides at once and sends only when the Undo window has passed', async () => {
    const { deletion, log, commit } = entry('pantry:1');

    deferDelete(deletion);
    expect(log).toEqual(['hide']);
    expect(isWaiting('pantry:1')).toBe(true);

    jest.advanceTimersByTime(UNDO_WINDOW_MS - 1);
    expect(commit).not.toHaveBeenCalled();

    jest.advanceTimersByTime(1);
    jest.useRealTimers();
    await settle();

    expect(log).toEqual(['hide', 'settled', 'commit', 'hide', 'committed']);
    expect(isHidden('pantry:1')).toBe(false);
  });

  it('puts it back and never sends it when undone', () => {
    const { deletion, log, commit } = entry('pantry:1');
    deferDelete(deletion);

    expect(undoDelete('pantry:1')).toBe(true);
    jest.advanceTimersByTime(UNDO_WINDOW_MS * 2);

    expect(log).toEqual(['hide', 'settled', 'restore']);
    expect(commit).not.toHaveBeenCalled();
    expect(isHidden('pantry:1')).toBe(false);
  });

  it('cannot undo what has already been sent', () => {
    const { deletion } = entry('pantry:1', () => new Promise(() => {}));
    deferDelete(deletion);
    jest.advanceTimersByTime(UNDO_WINDOW_MS);

    expect(undoDelete('pantry:1')).toBe(false);
    // Still off the screen until the server has answered.
    expect(isHidden('pantry:1')).toBe(true);
  });

  it('sends the one waiting at once when another delete starts', () => {
    // Its toast is about to be covered, and an Undo nobody can see is not one.
    const first = entry('pantry:1');
    const second = entry('pantry:2');

    deferDelete(first.deletion);
    deferDelete(second.deletion);

    expect(first.commit).toHaveBeenCalledWith({ keepalive: false });
    expect(second.commit).not.toHaveBeenCalled();
    expect(isWaiting('pantry:2')).toBe(true);
  });

  it('puts it back and reports when the server refuses', async () => {
    const { deletion, log } = entry('recipe:1', () => Promise.reject(new Error('500')));
    deferDelete(deletion);

    sendWaitingDelete();
    jest.useRealTimers();
    await settle();

    expect(log).toEqual(['hide', 'settled', 'commit', 'restore', 'failed']);
    expect(isHidden('recipe:1')).toBe(false);
  });

  it.each([
    ['the page goes away', () => window.dispatchEvent(new Event('pagehide'))],
    [
      'the tab goes to the background',
      () => {
        Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'hidden' });
        document.dispatchEvent(new Event('visibilitychange'));
        Object.defineProperty(document, 'visibilityState', {
          configurable: true,
          value: 'visible',
        });
      },
    ],
  ])('sends it straight away, and outliving the page, when %s', (_, leave) => {
    // A closed tab, or a phone that never brings the tab back, would otherwise lose it.
    const { deletion, commit } = entry('pantry:1');
    deferDelete(deletion);

    leave();

    expect(commit).toHaveBeenCalledWith({ keepalive: true });
  });

  it('hides it again after every read while it waits and while it is on its way', async () => {
    // The server still has it: a read of the list would bring it back.
    jest.useRealTimers();
    const client = new QueryClient();
    const stop = keepDeletesHidden(client);
    let answer: () => void = () => {};
    const { deletion, log } = entry('pantry:1', () => new Promise((done) => (answer = done)));
    deferDelete(deletion);

    await client.fetchQuery({ queryKey: ['pantry'], queryFn: async () => ['carrot'] });
    expect(log.filter((step) => step === 'hide')).toHaveLength(2);

    sendWaitingDelete();
    await client.fetchQuery({
      queryKey: ['pantry'],
      queryFn: async () => ['carrot'],
      staleTime: 0,
    });
    expect(log.filter((step) => step === 'hide')).toHaveLength(3);

    answer();
    await settle();
    const hidesWhenAnswered = log.filter((step) => step === 'hide').length;
    await client.fetchQuery({ queryKey: ['pantry'], queryFn: async () => [], staleTime: 0 });
    expect(log.filter((step) => step === 'hide')).toHaveLength(hidesWhenAnswered);
    stop();
  });

  it('is not set off by its own writes to the cache', () => {
    // A hide writes to the cache; if that counted as a read it would never stop.
    jest.useRealTimers();
    const client = new QueryClient();
    const stop = keepDeletesHidden(client);
    const hide = jest.fn(() => client.setQueryData(['pantry'], []));
    deferDelete({ ...entry('pantry:1').deletion, hide });

    expect(hide).toHaveBeenCalledTimes(1);
    stop();
  });

  it('tells a later write when the delete on its way has been answered', async () => {
    // Saving a recipe again while its removal is in flight must reach the server after it.
    jest.useRealTimers();
    let answer: () => void = () => {};
    const { deletion } = entry('save:1', () => new Promise((done) => (answer = done)));
    deferDelete(deletion);
    sendWaitingDelete();

    const after = jest.fn();
    void whenAnswered('save:1').then(after);
    await settle();
    expect(after).not.toHaveBeenCalled();

    answer();
    await settle();
    expect(after).toHaveBeenCalled();
  });
});
