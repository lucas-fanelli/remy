import { readdirSync } from 'fs';
import { join } from 'path';
import { parse } from '@formatjs/icu-messageformat-parser';
import { LOCALES, type Locale } from '../config';
import { ALL_MESSAGES, NAMESPACES, type Namespace } from '../messages';

/**
 * The gate that catches a half-translated namespace after the parallel migrations are merged.
 *
 * TypeScript already refuses a Spanish catalogue that is MISSING an English key (messages.ts
 * annotates it), so what is left for this test is everything structural typing cannot see:
 * extra keys, empty strings, ICU arguments that were renamed on one side only, and the
 * classic "copied the English and forgot to translate it".
 *
 * The ICU parser comes from @formatjs/icu-messageformat-parser, which is what use-intl -
 * and therefore next-intl - parses messages with at runtime. Using the same grammar means a
 * message that passes here really is a message the app can format.
 */

const MESSAGES_DIR = join(__dirname, '..', 'messages');

/** Key paths whose English and Spanish text is IDENTICAL on purpose. */
const SAME_IN_BOTH_LANGUAGES: Record<string, string> = {
  'common.actions.no': 'the word for "no" is "no" in Spanish',
  'common.form.characterCount': 'digits and a slash, no words',
  'common.time.hoursShort': 'the "h" symbol is the same in both',
  'common.time.minutesShort': 'the "min" symbol is the same in both',
  'nav.menu.youtube': 'brand name',
  'units.label.g': 'unit symbol',
  'units.label.kg': 'unit symbol',
  'units.label.L': 'unit symbol',
  'units.label.lb': 'unit symbol',
  'units.label.mL': 'unit symbol',
  'units.label.oz': 'unit symbol',
  'units.option': 'a label, a dash and a name - no words of its own',
};

type MessageTree = { [key: string]: string | MessageTree };

/** Every leaf of a namespace, as 'some.nested.key' -> text. */
function flatten(tree: MessageTree, prefix = ''): Map<string, string> {
  const leaves = new Map<string, string>();

  for (const [key, value] of Object.entries(tree)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (typeof value === 'string') {
      leaves.set(path, value);
    } else {
      for (const [nested, text] of flatten(value, path)) leaves.set(nested, text);
    }
  }

  return leaves;
}

/**
 * The names a message expects to be given: plain arguments, plurals, selects, dates and
 * numbers, plus the tag names t.rich has to be handed. Order does not matter, presence does.
 */
function icuArguments(message: string): string[] {
  const names = new Set<string>();

  const walk = (elements: ReturnType<typeof parse>): void => {
    for (const element of elements) {
      // 0 is a literal and 7 is the '#' inside a plural: neither is an argument
      if ('value' in element && typeof element.value === 'string' && element.type !== 0) {
        names.add(element.value);
      }
      if ('children' in element && Array.isArray(element.children)) walk(element.children);
      if ('options' in element && element.options) {
        for (const option of Object.values(element.options)) walk(option.value);
      }
    }
  };

  walk(parse(message));
  return [...names].sort();
}

const messagesFor = (locale: Locale, namespace: Namespace): Map<string, string> =>
  flatten(ALL_MESSAGES[locale][namespace] as MessageTree);

describe('message catalogues', () => {
  it('should register every namespace that exists on disk', () => {
    const onDisk = readdirSync(join(MESSAGES_DIR, 'en'))
      .filter((file) => file.endsWith('.json'))
      .map((file) => file.replace(/\.json$/, ''))
      .sort();

    expect(onDisk).toEqual([...NAMESPACES].sort());
  });

  it('should ship the same namespaces for every locale', () => {
    const english = readdirSync(join(MESSAGES_DIR, 'en')).sort();

    for (const locale of LOCALES) {
      expect(readdirSync(join(MESSAGES_DIR, locale)).sort()).toEqual(english);
    }
  });

  describe.each(NAMESPACES)('%s', (namespace) => {
    const english = messagesFor('en', namespace);
    const spanish = messagesFor('es', namespace);

    it('should have exactly the same keys in English and Spanish', () => {
      expect([...spanish.keys()].sort()).toEqual([...english.keys()].sort());
    });

    it('should have no empty message in either language', () => {
      const empty = [...english, ...spanish]
        .filter(([, text]) => text.trim() === '')
        .map(([key]) => key);

      expect(empty).toEqual([]);
    });

    it('should expect the same ICU arguments in English and Spanish', () => {
      const mismatched = [...english]
        .filter(([key, text]) => {
          const translation = spanish.get(key);
          if (translation === undefined) return false; // the key test reports this one
          return icuArguments(text).join(',') !== icuArguments(translation).join(',');
        })
        .map(([key]) => key);

      expect(mismatched).toEqual([]);
    });

    it('should not leave an English message sitting in the Spanish catalogue', () => {
      const untranslated = [...english]
        .filter(([key, text]) => {
          const path = `${namespace}.${key}`;
          if (path in SAME_IN_BOTH_LANGUAGES) return false;
          return spanish.get(key) === text;
        })
        .map(([key]) => `${namespace}.${key}`);

      expect(untranslated).toEqual([]);
    });
  });

  it('should not allow a stale entry in the identical-on-purpose list', () => {
    const stale = Object.keys(SAME_IN_BOTH_LANGUAGES).filter((path) => {
      const [namespace, ...rest] = path.split('.');
      const key = rest.join('.');
      const source = messagesFor('en', namespace as Namespace).get(key);
      // Stale means: the key is gone, or the two languages now differ and the exemption
      // is just noise that would hide a future regression.
      return source === undefined || messagesFor('es', namespace as Namespace).get(key) !== source;
    });

    expect(stale).toEqual([]);
  });
});
