import { execSync } from 'child_process';
import { readFileSync } from 'fs';

/**
 * No screen hands the card a hard-coded `viewer={null}`.
 *
 * `null` is a real value — it means "signed out", and the card renders a signed-out heart
 * for it. Written as a literal it almost never means that. Two screens were doing it:
 *
 *   MatchedRecipes    passed `viewer={null}` beside a comment claiming the match route
 *                     carried no viewer. The route sent `viewer: viewerState(recipe.id)`
 *                     on every result.
 *   profile page      passed `viewer={null}` on both tabs. The route attaches `viewer` and
 *                     carries a comment saying it does so the card "takes the same props as
 *                     the card anywhere else".
 *
 * Both came from the same mistake: a client-side interface that declared fewer fields than
 * the route sent, taken as the truth about the payload. On your own profile, your own liked
 * recipes rendered with empty hearts.
 *
 * `viewer` is required on the card and deliberately has no default, so that forgetting it
 * fails the build. A literal `null` is the one way to satisfy the compiler without thinking
 * about it, which makes it the one spelling worth forbidding. Tests are exempt: rendering a
 * signed-out card on purpose is their job.
 */

function clientFiles(): string[] {
  const out = execSync('git ls-files "src/**/*.tsx"', { encoding: 'utf8' });
  return out
    .split('\n')
    .map((f) => f.trim())
    .filter(Boolean)
    .filter((f) => !f.includes('__tests__'));
}

describe('no screen discards the viewer it was sent', () => {
  it('never passes a literal viewer={null} to a card', () => {
    const offenders = clientFiles().filter((file) =>
      /viewer=\{\s*null\s*\}/.test(readFileSync(file, 'utf8'))
    );

    expect(offenders).toEqual([]);
  });

  it('actually scans the screens it is guarding', () => {
    // A guard reading an empty file list passes forever.
    const withCards = clientFiles().filter((file) =>
      readFileSync(file, 'utf8').includes('<RecipeCard')
    );

    expect(withCards.length).toBeGreaterThanOrEqual(4);
  });
});
