/**
 * Motion tokens for the recipe form (shared foundation S16).
 *
 * Form components import only `MotionBox` (src/components/motion.ts) and
 * `AnimatePresence`, and spread these presets into them. State changes that
 * must animate without framer-motion use MUI Collapse / Fade.
 *
 * The Jest framer-motion mock renders children straight away and never fires
 * animation callbacks, so nothing here (and nothing that uses it) may drive
 * logic - focus, scroll reset and locks live in effects on the mounted node.
 */

type CubicBezier = [number, number, number, number];

/**
 * PublishButton ignores activation for this long after it mounts, so a
 * double-click on a neighbouring control can never publish (S10). It is a
 * timestamp comparison, not an animation callback. Consumers read the import
 * binding at call time (never copy it into a module-level constant) so a test
 * can zero it:
 *   jest.mock('@/components/recipe/form/formMotion', () => ({
 *     ...jest.requireActual('@/components/recipe/form/formMotion'),
 *     PUBLISH_GUARD_MS: 0,
 *   }));
 */
export const PUBLISH_GUARD_MS = 400;

export const FORM_ENTER_DURATION = 0.18;
export const FORM_EXIT_DURATION = 0.1;
export const FORM_ENTER_EASE: CubicBezier = [0.4, 0, 0.2, 1];
export const FORM_EXIT_EASE: CubicBezier = [0.4, 0, 1, 1];
export const FORM_SLIDE_PX = 16;

export const formEnterTransition = { duration: FORM_ENTER_DURATION, ease: FORM_ENTER_EASE };
export const formExitTransition = { duration: FORM_EXIT_DURATION, ease: FORM_EXIT_EASE };

/** 1 = moving forward (content comes from the right), -1 = moving back. */
export type FormSlideDirection = 1 | -1;

/**
 * Section / panel change: fade plus a 16px slide in the direction of travel.
 * Usage: `<MotionBox key={section} {...panelMotion(direction)} />` inside
 * `<AnimatePresence mode="wait" initial={false}>`.
 */
export const panelMotion = (direction: FormSlideDirection = 1) => ({
  initial: { opacity: 0, x: direction * FORM_SLIDE_PX },
  animate: { opacity: 1, x: 0, transition: formEnterTransition },
  exit: { opacity: 0, x: -direction * FORM_SLIDE_PX, transition: formExitTransition },
});

/** Plain cross-fade for content that swaps in place. */
export const fadeMotion = {
  initial: { opacity: 0 },
  animate: { opacity: 1, transition: formEnterTransition },
  exit: { opacity: 0, transition: formExitTransition },
};

/**
 * Ingredient / step row add and remove: height 0 -> 'auto' plus opacity.
 * Usage: `<MotionBox key={row.id} {...rowMotion} />` inside
 * `<AnimatePresence initial={false}>`; `overflow: 'hidden'` is already part
 * of the preset so the collapsing row clips its content.
 */
export const rowMotion = {
  initial: { height: 0, opacity: 0 },
  animate: { height: 'auto', opacity: 1, transition: formEnterTransition },
  exit: { height: 0, opacity: 0, transition: formExitTransition },
  style: { overflow: 'hidden' as const },
};
