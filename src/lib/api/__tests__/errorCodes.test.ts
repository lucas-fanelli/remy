import { readdirSync, readFileSync, statSync } from 'fs';
import { join } from 'path';
import { LOCALES, ALL_MESSAGES } from '@/i18n/messages';
import {
  MAX_COMMENT_LENGTH,
  MAX_DAILY_COOKS,
  MAX_DAILY_RECIPES,
  MAX_ITEM_NAME_LENGTH,
  MAX_NOTES_LENGTH,
  MAX_PANTRY_ITEMS,
  MAX_UPLOAD_SIZE,
} from '@/lib/constants';
import { API_ERROR_CODES, isApiErrorCode } from '../errorCodes';

/**
 * The two halves of the contract have to agree: a route that answers with a code the
 * catalogue does not carry would show the client a missing-key path instead of a sentence,
 * and a key nobody sends is copy that will silently rot. The parity test next to the
 * catalogues keeps English and Spanish in step; this one keeps the CODES in step with them.
 */

type MessageTree = { [key: string]: string | MessageTree };

/** The text at 'recipe.notFound' in one locale's `errors` namespace, or undefined. */
function messageAt(tree: MessageTree, path: string): string | undefined {
  const value = path
    .split('.')
    .reduce<
      string | MessageTree | undefined
    >((node, key) => (node && typeof node === 'object' ? node[key] : undefined), tree);

  return typeof value === 'string' ? value : undefined;
}

/** Every leaf of the namespace, as 'some.nested.key'. */
function leafPaths(tree: MessageTree, prefix = ''): string[] {
  return Object.entries(tree).flatMap(([key, value]) => {
    const path = prefix ? `${prefix}.${key}` : key;
    return typeof value === 'string' ? [path] : leafPaths(value, path);
  });
}

// Keys the client shows on its own - no route ever sends them as a `code`.
const CLIENT_ONLY_KEYS = ['network', 'unknown'];

describe('API_ERROR_CODES', () => {
  it.each(LOCALES)('should have a %s message for every code', (locale) => {
    const errors = ALL_MESSAGES[locale].errors as MessageTree;

    const missing = API_ERROR_CODES.filter((code) => messageAt(errors, code) === undefined);

    expect(missing).toEqual([]);
  });

  it('should not leave a message in the errors namespace no code points at', () => {
    const known = new Set<string>([...API_ERROR_CODES, ...CLIENT_ONLY_KEYS]);

    const orphans = leafPaths(ALL_MESSAGES.en.errors as MessageTree).filter(
      (path) => !known.has(path)
    );

    expect(orphans).toEqual([]);
  });

  it('should list every code exactly once', () => {
    expect(new Set(API_ERROR_CODES).size).toBe(API_ERROR_CODES.length);
  });

  it('should recognise its own codes and nothing else', () => {
    expect(isApiErrorCode('recipe.notFound')).toBe(true);
    expect(isApiErrorCode('recipe.thereIsNoSuchCode')).toBe(false);
  });
});

/**
 * Nine messages name a limit, because the English sentence they replace names it too ("Item
 * name too long (max 200 characters)"): a user told only that the name is "too long" has no
 * way to know how much to cut and retries blind.
 *
 * `t(code)` is called with no ICU values - the code is all the client has - so the number is
 * part of the text, and JSON takes no comment saying which constant it mirrors. This table is
 * that comment with teeth: move the constant and the catalogue fails here, in both languages,
 * instead of drifting quietly away from what the server says.
 */
const LIMIT_IN_MESSAGE: ReadonlyArray<[string, number]> = [
  ['pantry.nameTooLong', MAX_ITEM_NAME_LENGTH],
  ['pantry.categoryTooLong', MAX_ITEM_NAME_LENGTH],
  ['pantry.notesTooLong', MAX_NOTES_LENGTH],
  ['pantry.limitReached', MAX_PANTRY_ITEMS],
  ['comment.textTooLong', MAX_COMMENT_LENGTH],
  ['recipe.dailyLimit', MAX_DAILY_RECIPES],
  ['cooked.dailyLimit', MAX_DAILY_COOKS],
  ['upload.tooLarge', MAX_UPLOAD_SIZE / 1024 / 1024],
  // The two pantry routes spell this one out instead of reading a constant
  // ('Unit too long (max 50 characters)'), so the catalogue mirrors the literal.
  ['pantry.unitTooLong', 50],
];

describe.each(LOCALES)('the %s message of a limit', (locale) => {
  it.each(LIMIT_IN_MESSAGE)('should still say the number in %s', (code, limit) => {
    const message = messageAt(ALL_MESSAGES[locale].errors as MessageTree, code);

    expect(message).toContain(String(limit));
  });
});

/**
 * The routes answer with `NextResponse.json({ error, code })`, an object literal TypeScript
 * does not check against ApiErrorCode. A typo there would ship a code the client cannot
 * translate and the errors.json key would never be reached, so read the sources instead.
 */
describe('the codes the API actually sends', () => {
  const SOURCE_ROOT = join(__dirname, '..', '..', '..');
  const SOURCES = [
    join(SOURCE_ROOT, 'app', 'api'),
    join(SOURCE_ROOT, 'lib', 'api'),
    join(SOURCE_ROOT, 'lib', 'auth'),
    join(SOURCE_ROOT, 'lib', 'utils', 'request.ts'),
    join(SOURCE_ROOT, 'lib', 'utils', 'cloudinary-validation.ts'),
  ];

  function sourceFiles(path: string): string[] {
    if (statSync(path).isFile()) return path.endsWith('.ts') ? [path] : [];

    return readdirSync(path, { withFileTypes: true })
      .filter((entry) => entry.name !== '__tests__')
      .flatMap((entry) => sourceFiles(join(path, entry.name)));
  }

  const used = SOURCES.flatMap(sourceFiles).flatMap((file) => {
    const source = readFileSync(file, 'utf8');
    return [...source.matchAll(/\bcode: '([^']+)'/g)].map((match) => match[1]);
  });

  it('should send codes the catalogue knows', () => {
    expect(used.filter((code) => !isApiErrorCode(code))).toEqual([]);
  });

  it('should send enough of them to be worth the contract', () => {
    // A blunt guard against a refactor that quietly drops the codes again
    expect(new Set(used).size).toBeGreaterThan(80);
  });
});
