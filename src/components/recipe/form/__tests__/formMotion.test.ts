import {
  FORM_ENTER_DURATION,
  FORM_ENTER_EASE,
  FORM_EXIT_DURATION,
  FORM_EXIT_EASE,
  PUBLISH_GUARD_MS,
  fadeMotion,
  formEnterTransition,
  formExitTransition,
  rowMotion,
} from '../formMotion';

describe('formMotion', () => {
  it('should export the 400ms publish guard', () => {
    expect(PUBLISH_GUARD_MS).toBe(400);
  });

  it('should expose the approved enter and exit timings', () => {
    expect(formEnterTransition).toEqual({ duration: 0.18, ease: [0.4, 0, 0.2, 1] });
    expect(formExitTransition).toEqual({ duration: 0.1, ease: [0.4, 0, 1, 1] });
    expect(FORM_ENTER_DURATION).toBe(0.18);
    expect(FORM_EXIT_DURATION).toBe(0.1);
    expect(FORM_ENTER_EASE).toHaveLength(4);
    expect(FORM_EXIT_EASE).toHaveLength(4);
  });

  it('should cross-fade with the shared transitions', () => {
    expect(fadeMotion.initial).toEqual({ opacity: 0 });
    expect(fadeMotion.animate).toEqual({ opacity: 1, transition: formEnterTransition });
    expect(fadeMotion.exit).toEqual({ opacity: 0, transition: formExitTransition });
  });

  it('should collapse rows from height 0 to auto with clipped overflow', () => {
    expect(rowMotion.initial).toEqual({ height: 0, opacity: 0 });
    expect(rowMotion.animate).toEqual({
      height: 'auto',
      opacity: 1,
      transition: formEnterTransition,
    });
    expect(rowMotion.exit).toEqual({ height: 0, opacity: 0, transition: formExitTransition });
    expect(rowMotion.style).toEqual({ overflow: 'hidden' });
  });
});
