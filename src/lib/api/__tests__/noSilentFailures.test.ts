import { execSync } from 'child_process';
import { readFileSync } from 'fs';

/**
 * No write may swallow an HTTP rejection.
 *
 * `if (response.ok) { ...success... }` with no `else` is the shape that made tapping the
 * bookmark on a recipe do nothing at all — no change, no message, not even a console line —
 * on an expired session, a rate limit or a 500. Verified in a browser by forcing the
 * endpoint to answer 500: the icon did not move and zero messages appeared. The
 * `toasts.saveFailed` string existed in both locales and was unreachable.
 *
 * `if (response.ok) { ... } else { ... }` is fine, and is what the feed's like handler does,
 * so this cannot be a text search — it matches the block's braces and checks what follows.
 *
 * KNOWN is the remaining work, not an exemption list. It may shrink and never grow: adding
 * a file to it means shipping a new silent failure, and the count is what fails the test.
 *
 * WHAT THIS CANNOT SEE, and it matters: it measures a code SHAPE, not what the reader ends
 * up experiencing. `useNotificationPolling.fetchNotifications` has an `else` and so passes
 * here, but that else only counts the failure and writes to the console — the dropdown goes
 * on saying "you have no notifications yet" until ten failures inside ten minutes trip its
 * circuit breaker, at which point the bell finally dims and offers a retry. Nine server
 * errors in a row look exactly like an empty inbox. Passing this test is a floor, not a
 * guarantee, and that gap is its own slice of P2's step 2.
 */

/**
 * Empty, and it is meant to stay that way.
 *
 * The count came down measured rather than guessed, and every number along the way was
 * wrong in an instructive direction:
 *
 *   `grep "if (response.ok)"`       20 across 13 files  — counted every handler that
 *                                                         already answers, including the
 *                                                         one correct implementation
 *   the brace matcher                9 across 8 files   — the real shape
 *   plus the early-return rule       8 across 7 files   — ResetPasswordForm was never
 *                                                         broken; it returns and then
 *                                                         handles 429 / bad token / 400
 *
 * Two were fixed in the recipe page, four in the notification path, and the last four were
 * all READS, which is the pattern worth keeping in mind: a failed write leaves a control
 * that did not move, but a failed read renders as "nothing here" — a confident claim the
 * screen has no grounds for. An unreadable pantry said "your pantry is empty" and offered
 * to help you add your first ingredient.
 *
 * An entry appearing here again means a new silent failure shipped.
 */
const KNOWN: Record<string, number> = {};

/** Comments only — a `//` inside a string literal is not worth the parser this would need. */
function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^[ \t]*\/\/.*$/gm, '');
}

/** Index just past the `}` that closes the block opening at `openBrace`. */
function endOfBlock(source: string, openBrace: number): number {
  let depth = 0;
  for (let i = openBrace; i < source.length; i++) {
    if (source[i] === '{') depth++;
    else if (source[i] === '}') {
      depth--;
      if (depth === 0) return i + 1;
    }
  }
  return -1;
}

/**
 * Does the success block hand control back, so that everything after the `if` is the
 * failure path?
 *
 * `if (ok) { navigate(); return; }` followed by an error ladder is correct — it is the
 * same shape as `if (!ok) { report(); return; }`, written the other way round. An earlier
 * version of this matcher only looked for `else` and flagged `ResetPasswordForm`, which
 * handles 429, an invalid token, a 400 and a fallback in the four statements after its
 * early return. A test that cries wolf gets its list padded with exemptions, which is how
 * a guard stops guarding.
 */
function blockExits(block: string): boolean {
  const body = stripComments(block).trim().replace(/\}$/, '').trim();
  const lastStatement =
    body
      .split('\n')
      .filter((l) => l.trim())
      .pop() ?? '';
  return /\b(return|throw)\b/.test(lastStatement);
}

function silentOkChecks(source: string): number {
  const clean = stripComments(source);
  const pattern = /if\s*\(\s*(?:response|res|r)\.ok\s*\)\s*\{/g;
  let found = 0;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(clean)) !== null) {
    const brace = clean.indexOf('{', match.index);
    const after = endOfBlock(clean, brace);
    if (after === -1) continue;

    // Either shape answers the rejection: an `else` branch, or an early return that leaves
    // the rest of the function to be the failure path.
    const handled = /^\s*else\b/.test(clean.slice(after)) || blockExits(clean.slice(brace, after));
    if (!handled) found++;
  }
  return found;
}

function clientFiles(): string[] {
  const out = execSync('git ls-files "src/**/*.ts" "src/**/*.tsx"', { encoding: 'utf8' });
  return (
    out
      .split('\n')
      .map((f) => f.trim())
      .filter(Boolean)
      .filter((f) => !f.includes('__tests__'))
      // Route handlers answer requests rather than make them.
      .filter((f) => !f.startsWith('src/app/api/'))
  );
}

describe('no write swallows an HTTP rejection', () => {
  const offenders = clientFiles()
    .map((file) => ({ file, count: silentOkChecks(readFileSync(file, 'utf8')) }))
    .filter((r) => r.count > 0);

  it('finds no silent site outside the known list', () => {
    const unexpected = offenders.filter((o) => !KNOWN[o.file]);

    expect(unexpected.map((o) => `${o.file} (${o.count})`)).toEqual([]);
  });

  it('never lets a known file grow more of them', () => {
    const grown = offenders
      .filter((o) => KNOWN[o.file] && o.count > KNOWN[o.file])
      .map((o) => `${o.file}: ${o.count} now, ${KNOWN[o.file]} recorded`);

    expect(grown).toEqual([]);
  });

  it('keeps the known list honest as they are fixed', () => {
    // A file listed here that no longer offends must come off the list, or the list stops
    // describing anything. This is the assertion that makes the count go down.
    const fixed = Object.keys(KNOWN).filter(
      (file) => !offenders.some((o) => o.file === file && o.count === KNOWN[file])
    );

    expect(fixed).toEqual([]);
  });

  it('does not flag a handler that answers the rejection', () => {
    // The feed's like handler — the one correct implementation, and the model for P2.
    expect(silentOkChecks(readFileSync('src/components/recipe/RecipeFeed.tsx', 'utf8'))).toBe(0);
  });

  it('accepts an early return, because the rest of the function is then the failure path', () => {
    const earlyReturn = `
      if (response.ok) {
        hardNavigate('/auth?reset=success');
        return;
      }
      if (response.status === 429) { setError(rateLimited); }
      else { setError(generic); }
    `;

    expect(silentOkChecks(earlyReturn)).toBe(0);
  });

  it('still catches a success block that neither branches nor exits', () => {
    const silent = `
      if (response.ok) {
        setThing(await response.json());
      }
      doSomethingUnrelated();
    `;

    expect(silentOkChecks(silent)).toBe(1);
  });

  it('reads the braces rather than the text', () => {
    const handled = `
      if (response.ok) {
        const data = await response.json();
        if (data.nested) { doThing(); }
      } else {
        report();
      }
    `;
    const silent = `
      if (response.ok) {
        const data = await response.json();
        if (data.nested) { doThing(); }
      }
    `;
    const inAComment =
      `
      // this was ` +
      '`' +
      `if (response.ok) { ... }` +
      '`' +
      ` with no else
      const x = 1;
    `;

    expect(silentOkChecks(handled)).toBe(0);
    expect(silentOkChecks(silent)).toBe(1);
    expect(silentOkChecks(inAComment)).toBe(0);
  });
});
