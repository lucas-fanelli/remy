import { execSync } from 'child_process';
import { readFileSync } from 'fs';
import { engagementCounts } from '../engagementCounts';

/**
 * One spelling for the counters, and a guard that keeps it that way.
 *
 * Four of seven recipe-bearing routes sent `likesCount` / `commentsCount` while the other
 * three sent `likeCount` / `commentCount`. Nothing failed: the profile page carried a
 * rename, and nobody read the counts on the pantry matches. What it cost was invisible —
 * the cache adapters patch `likeCount`, so a like given on a profile would have updated
 * nothing there.
 */

describe('engagementCounts', () => {
  it('maps Prisma counts onto the one spelling the client reads', () => {
    expect(engagementCounts({ likes: 7, comments: 2 })).toEqual({ likeCount: 7, commentCount: 2 });
  });

  it('keeps a zero a zero', () => {
    // A recipe nobody has touched is 0, not undefined — the card renders the counts
    // whenever they are present, and `undefined` would hide the engagement row.
    expect(engagementCounts({ likes: 0, comments: 0 })).toEqual({ likeCount: 0, commentCount: 0 });
  });
});

function apiRouteFiles(): string[] {
  const out = execSync('git ls-files "src/app/api/**/*.ts"', { encoding: 'utf8' });
  return out
    .split('\n')
    .map((f) => f.trim())
    .filter(Boolean)
    .filter((f) => !f.includes('__tests__'));
}

const stripComments = (source: string) =>
  source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^[ \t]*\/\/.*$/gm, '');

describe('the API speaks one spelling', () => {
  const routes = apiRouteFiles().map((file) => ({
    file,
    source: stripComments(readFileSync(file, 'utf8')),
  }));

  it('never emits a plural counter', () => {
    const plural = routes
      .filter(({ source }) => /\b(likesCount|commentsCount)\s*:/.test(source))
      .map(({ file }) => file);

    expect(plural).toEqual([]);
  });

  it('builds counters through engagementCounts rather than by hand', () => {
    // Writing `likeCount: recipe._count.likes` inline is the correct spelling today and
    // the exact habit that let four routes drift. Anything reading `_count.likes` goes
    // through the one function, so the spelling has one place to be wrong in.
    const byHand = routes
      .filter(({ source }) =>
        /\b(likeCount|commentCount)\s*:\s*[\w.]*_count\.|\b(likeCount|commentCount)\s*:\s*counts\./.test(
          source
        )
      )
      .map(({ file }) => file);

    expect(byHand).toEqual([]);
  });

  it('actually finds the routes it is guarding', () => {
    // A guard that scans an empty list passes forever. There are at least seven routes
    // that send counters; if this finds none the glob broke, not the code.
    const usingIt = routes.filter(({ source }) => source.includes('engagementCounts('));

    expect(usingIt.length).toBeGreaterThanOrEqual(7);
  });
});
