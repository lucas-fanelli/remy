import { execSync } from 'child_process';
import { readFileSync } from 'fs';

/**
 * Every card that can be liked can be saved.
 *
 * Lucas's call: the bookmark sits on every card, beside the heart. Saving used to exist on
 * one surface — inside a recipe — while four endpoints served `viewer.saved` to cards that
 * never showed it, which is why a broken save went unnoticed for so long: nothing else in
 * the app could disagree with it. A new screen that wires the heart and forgets the
 * bookmark would quietly bring that back.
 */

function screensWithCards(): { file: string; source: string }[] {
  const out = execSync('git ls-files "src/**/*.tsx"', { encoding: 'utf8' });
  return out
    .split('\n')
    .map((f) => f.trim())
    .filter(Boolean)
    .filter((f) => !f.includes('__tests__'))
    .map((file) => ({ file, source: readFileSync(file, 'utf8') }))
    .filter(({ source }) => source.includes('<RecipeCard'));
}

const count = (source: string, prop: string) =>
  (source.match(new RegExp(`\\b${prop}=\\{`, 'g')) ?? []).length;

describe('every card that can be liked can be saved', () => {
  it('passes onSave wherever it passes onLike', () => {
    const mismatched = screensWithCards()
      .map(({ file, source }) => ({ file, onLike: count(source, 'onLike'), onSave: count(source, 'onSave') }))
      .filter(({ onLike, onSave }) => onLike !== onSave);

    expect(mismatched).toEqual([]);
  });

  it('actually scans the screens it is guarding', () => {
    // A guard reading an empty file list passes forever. Feed, search, profile, matches.
    const liked = screensWithCards().filter(({ source }) => count(source, 'onLike') > 0);

    expect(liked.length).toBeGreaterThanOrEqual(4);
  });
});
