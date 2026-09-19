import {
  FORM_ENTER_DURATION,
  FORM_ENTER_EASE,
  FORM_EXIT_DURATION,
  FORM_EXIT_EASE,
  FORM_SLIDE_PX,
  PUBLISH_GUARD_MS,
  fadeMotion,
  formEnterTransition,
  formExitTransition,
  panelMotion,
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

  it('should slide a panel in from the right by 16px when moving forward', () => {
    const preset = panelMotion(1);

    expect(FORM_SLIDE_PX).toBe(16);
    expect(preset.initial).toEqual({ opacity: 0, x: 16 });
    expect(preset.animate).toEqual({ opacity: 1, x: 0, transition: formEnterTransition });
    expect(preset.exit).toEqual({ opacity: 0, x: -16, transition: formExitTransition });
  });

  it('should mirror the slide when moving back', () => {
    const preset = panelMotion(-1);

    expect(preset.initial.x).toBe(-16);
    expect(preset.exit.x).toBe(16);
  });

  it('should default the panel direction to forward', () => {
    expect(panelMotion()).toEqual(panelMotion(1));
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
