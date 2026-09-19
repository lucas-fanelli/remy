import { useTranslations } from 'next-intl';
import { useCallback } from 'react';
import type { Messages } from './messages';

/**
 * How a PURE function hands user-facing text back to the UI.
 *
 * Several helpers in this app produce sentences: the recipe form's validateRecipe, the
 * free-text parser's "check this" reasons, RecipeSubmitError, the image upload messages.
 * They must not return English any more - they cannot, because they have no locale and no
 * hooks. They return a DESCRIPTOR instead: which message, and what to fill it with. The
 * component that renders the result turns it into text.
 *
 * ```ts
 * // the pure function, in a plain .ts module with no React in sight
 * if (title.trim() === '') {
 *   issues.push({ path: 'title', text: text('recipeForm.issues.titleRequired') });
 * } else if (title.length > RECIPE_LIMITS.title) {
 *   issues.push({
 *     path: 'title',
 *     text: text('recipeForm.issues.titleTooLong', { max: RECIPE_LIMITS.title }),
 *   });
 * }
 * ```
 * ```tsx
 * // the component
 * const render = useTextDescriptor();
 * return <FormHelperText>{render(issue.text)}</FormHelperText>;
 * ```
 *
 * The key is the FULL path, namespace included, because the function producing it has no
 * namespace of its own. It is checked against the English catalogue like any other key.
 */

/** Every dotted path that leads to a message, built from the shape of the catalogue. */
type NestedKeyOf<T> = T extends object
  ? {
      [K in keyof T & string]: T[K] extends string ? K : `${K}.${NestedKeyOf<T[K]>}`;
    }[keyof T & string]
  : never;

/**
 * Any key of the merged catalogue, 'namespace.some.key'. A typo is a compile error.
 *
 * It comes from the catalogue and NOT from `Parameters<ReturnType<typeof useTranslations>>`:
 * that parameter is namespace-RELATIVE ('actions.save'), because the hook is normally bound
 * to a namespace. A descriptor carries the full path instead - the pure function that built
 * it has no namespace - and `useTextDescriptor` resolves it against the root translator.
 */
export type MessageKey = NestedKeyOf<Messages>;

/**
 * Compile-time proof of that contract, in a module `tsconfig.check.json` actually reads: the
 * keys below are real full paths, and `npm run typecheck` fails the day `MessageKey` drifts
 * back to relative keys. The negative half (a typo is rejected) is the `@ts-expect-error` in
 * src/i18n/__tests__/helpers.test.tsx, which `tsconfig.i18n.json` typechecks.
 */
type AssertMessageKey<K extends MessageKey> = K;
export type FullPathMessageKeys = AssertMessageKey<
  'common.actions.save' | 'errors.unknown' | 'nav.items.home'
>;

/** The values an ICU message can be given. Rich text is a component's job, not a descriptor's. */
export type MessageValues = Record<string, string | number | Date>;

export interface TextDescriptor {
  key: MessageKey;
  values?: MessageValues;
}

/** Builds a descriptor. Exists so call sites read as one short expression. */
export function text(key: MessageKey, values?: MessageValues): TextDescriptor {
  return values ? { key, values } : { key };
}

/**
 * Turns descriptors into text in the current language. One hook per component, then call
 * the returned function as many times as there are descriptors to render.
 */
export function useTextDescriptor(): (descriptor: TextDescriptor) => string {
  const t = useTranslations();

  return useCallback(
    (descriptor: TextDescriptor) =>
      // The key is only known at runtime, so the per-message argument types cannot be
      // checked here; `text()` above is where the key itself is validated.
      (t as (key: MessageKey, values?: MessageValues) => string)(descriptor.key, descriptor.values),
    [t]
  );
}
