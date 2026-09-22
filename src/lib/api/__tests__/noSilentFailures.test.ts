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
 * Sites still to fix, by file. Every entry is a bug, scheduled as P2's step 2.
 *
 * These counts come from the matcher below, not from a text search. A first draft of this
 * list was taken from `grep "if (response.ok)"` and said 20 across 13 files; the matcher
 * says 9 across 8, because the difference is every handler that already has an `else` —
 * including the feed's like, which the grep could not tell apart from the broken ones.
 * Two more were in `recipe/[id]/page.tsx` and are fixed in this change.
 */
const KNOWN: Record<string, number> = {
  'src/app/pantry/page.tsx': 1,
  'src/app/search/page.tsx': 1,
  'src/components/auth/ResetPasswordForm.tsx': 1,
  'src/components/recipe/CommentsSection.tsx': 1,
  'src/components/search/PersistentSearchBar.tsx': 1,
};

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

function silentOkChecks(source: string): number {
  const clean = stripComments(source);
  const pattern = /if\s*\(\s*(?:response|res|r)\.ok\s*\)\s*\{/g;
  let found = 0;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(clean)) !== null) {
    const brace = clean.indexOf('{', match.index);
    const after = endOfBlock(clean, brace);
    if (after === -1) continue;
    // An `else` immediately after means the rejection is handled.
    if (!/^\s*else\b/.test(clean.slice(after))) found++;
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
