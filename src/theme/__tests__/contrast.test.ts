import { darkTokens, lightTokens, tokensFor, type ColorTokens } from '../tokens';

/**
 * The palette, measured rather than asserted.
 *
 * Dark mode shipped with a brand at 3.97:1 and dividers at 1.35:1 — numbers nobody had
 * ever computed, because computing them by hand for 522 colour decisions is not something
 * anyone does twice. These run in CI instead.
 *
 * Thresholds are WCAG 2.1 AA: 4.5:1 for body text, 3:1 for large text and for the
 * boundary of a UI element.
 */

type Rgb = [number, number, number];

function parse(color: string): { rgb: Rgb; alpha: number } {
  const hex = color.match(/^#([0-9a-f]{6})$/i);
  if (hex) {
    const n = parseInt(hex[1], 16);
    return { rgb: [(n >> 16) & 255, (n >> 8) & 255, n & 255], alpha: 1 };
  }
  const rgba = color.match(/^rgba?\(([^)]+)\)$/);
  if (rgba) {
    const parts = rgba[1].split(',').map((p) => parseFloat(p.trim()));
    return { rgb: [parts[0], parts[1], parts[2]], alpha: parts.length > 3 ? parts[3] : 1 };
  }
  throw new Error(`Cannot parse colour: ${color}`);
}

/** Lay a possibly-transparent colour over an opaque one and get what the eye sees. */
function composite(over: string, base: string): Rgb {
  const top = parse(over);
  const bottom = parse(base);
  if (bottom.alpha !== 1) throw new Error(`Base colour must be opaque: ${base}`);
  return top.rgb.map((c, i) => Math.round(c * top.alpha + bottom.rgb[i] * (1 - top.alpha))) as Rgb;
}

function relativeLuminance([r, g, b]: Rgb): number {
  const channel = (value: number) => {
    const v = value / 255;
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

/** Contrast ratio of `over` (composited onto `base`) against `base`. */
export function contrast(over: string, base: string): number {
  const a = relativeLuminance(composite(over, base));
  const b = relativeLuminance(parse(base).rgb);
  const [light, dark] = a > b ? [a, b] : [b, a];
  return (light + 0.05) / (dark + 0.05);
}

const round = (n: number) => Math.round(n * 100) / 100;

describe('contrast() itself', () => {
  it('measures the extremes correctly', () => {
    expect(round(contrast('#FFFFFF', '#000000'))).toBe(21);
    expect(round(contrast('#000000', '#000000'))).toBe(1);
  });

  it('accounts for transparency instead of measuring the raw colour', () => {
    // The old divider was white at 12% on #1E1E1E. Measured as opaque white it looks
    // like 15:1; composited, which is what a reader sees, it is about 1.5:1.
    const asWritten = contrast('#FFFFFF', '#1E1E1E');
    const asSeen = contrast('rgba(255, 255, 255, 0.12)', '#1E1E1E');

    expect(asWritten).toBeGreaterThan(14);
    expect(asSeen).toBeLessThan(1.7);
  });
});

describe.each([
  ['light', lightTokens],
  ['dark', darkTokens],
] as const)('%s palette', (mode, tokens: ColorTokens) => {
  const surfaces = [
    ['surface.base', tokens.surface.base],
    ['surface.raised', tokens.surface.raised],
    ['surface.sunken', tokens.surface.sunken],
  ] as const;

  describe.each(surfaces)('text on %s', (_name, surface) => {
    it('reads body text at AA', () => {
      expect(contrast(tokens.text.primary, surface)).toBeGreaterThanOrEqual(4.5);
    });

    it('reads secondary text at AA', () => {
      expect(contrast(tokens.text.secondary, surface)).toBeGreaterThanOrEqual(4.5);
    });

    it('shows the brand clearly enough to be a link or a filled icon', () => {
      expect(contrast(tokens.brand.main, surface)).toBeGreaterThanOrEqual(3);
    });

    // A subtle border is a refinement, not the structure. Cards separate because
    // `surface.raised` is lighter than the page — see "a card separates on its own"
    // below — so this only has to be perceptible at the edge.
    //
    // It was 1.5:1 here, which forced a bright line, and a bright line on a dark page
    // reads as a neon outline: every card became a drawn rectangle. Loud borders and
    // invisible ones are both wrong; the surface is what should carry the shape.
    it('draws a subtle border that can be perceived at an edge', () => {
      expect(contrast(tokens.border.subtle, surface)).toBeGreaterThanOrEqual(1.2);
    });

    // This one genuinely is the only thing defining its element — a text field's
    // outline, an outlined button — so WCAG's 3:1 for a component boundary applies.
    it('draws a strong border that can carry an element on its own', () => {
      expect(contrast(tokens.border.strong, surface)).toBeGreaterThanOrEqual(3);
    });

    it('shows a focus ring', () => {
      expect(contrast(tokens.border.focus, surface)).toBeGreaterThanOrEqual(3);
    });

    it('shows the gold accent, which dark mode did not have at all', () => {
      expect(contrast(tokens.accent.gold, surface)).toBeGreaterThanOrEqual(3);
    });
  });

  it('keeps disabled text legible even though it is muted', () => {
    // Muted is not the same as unreadable; 3:1 is the floor.
    expect(contrast(tokens.text.disabled, tokens.surface.base)).toBeGreaterThanOrEqual(3);
  });

  it('puts readable ink on a brand fill', () => {
    expect(contrast(tokens.text.onBrand, tokens.brand.main)).toBeGreaterThanOrEqual(4.5);
  });

  describe.each([
    ['success', tokens.state.success, tokens.state.onSuccess],
    ['warning', tokens.state.warning, tokens.state.onWarning],
    ['danger', tokens.state.danger, tokens.state.onDanger],
    ['info', tokens.state.info, tokens.state.onInfo],
  ] as const)('%s', (_name, fill, ink) => {
    it('is visible as a fill against the page', () => {
      expect(contrast(fill, tokens.surface.base)).toBeGreaterThanOrEqual(3);
    });

    it('carries readable ink', () => {
      // Six files hardcoded `color: 'white'` over these. On dark-mode warning that was
      // 2.16:1 and on success 2.36:1 — this is the rule that forbids it.
      expect(contrast(ink, fill)).toBeGreaterThanOrEqual(4.5);
    });
  });

  it('shows text laid over a photo scrim', () => {
    const scrimOverWorstCasePhoto = composite(tokens.surface.overlay, '#FFFFFF');
    const asHex = `#${scrimOverWorstCasePhoto.map((c) => c.toString(16).padStart(2, '0')).join('')}`;

    expect(contrast(tokens.text.onOverlay, asHex)).toBeGreaterThanOrEqual(4.5);
  });
});

describe('dark mode separates by surface, not by outline', () => {
  // Light mode does this with a drop shadow, which works on a light page and is not a
  // contrast question. On a dark page a black shadow is invisible, so the surface has to
  // do it — and when it did not, a bright border stood in and every card turned into a
  // drawn rectangle.
  it('lifts a card clear of the page on its own', () => {
    expect(contrast(darkTokens.surface.raised, darkTokens.surface.base)).toBeGreaterThanOrEqual(
      1.2
    );
  });

  it('sinks a well clear of the surface above it', () => {
    expect(contrast(darkTokens.surface.sunken, darkTokens.surface.raised)).toBeGreaterThanOrEqual(
      1.2
    );
  });

  it('keeps the border quieter than the surface step it decorates', () => {
    // The border is a refinement. If it out-shouts the lift it becomes the structure
    // again, which is the look being removed.
    const lift = contrast(darkTokens.surface.raised, darkTokens.surface.base);
    const line = contrast(darkTokens.border.subtle, darkTokens.surface.raised);

    expect(line).toBeLessThan(lift * 1.6);
  });
});

describe('the two modes are one brand', () => {
  it('uses a purple in both, not a purple and a teal', () => {
    // Light was purple and gold; dark was teal and more teal, with no gold at all. They
    // were two different products wearing one name.
    const hue = (hex: string) => {
      const { rgb } = parse(hex);
      const [r, g, b] = rgb.map((c) => c / 255);
      const max = Math.max(r, g, b);
      const min = Math.min(r, g, b);
      if (max === min) return 0;
      const d = max - min;
      const h =
        max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
      return h * 60;
    };

    // Purple sits around 260-280 degrees; the teal it replaced was near 174.
    expect(hue(lightTokens.brand.main)).toBeGreaterThan(240);
    expect(hue(lightTokens.brand.main)).toBeLessThan(300);
    expect(hue(darkTokens.brand.main)).toBeGreaterThan(240);
    expect(hue(darkTokens.brand.main)).toBeLessThan(300);
  });

  it('gives both modes the gold accent', () => {
    expect(lightTokens.accent.gold).toBeTruthy();
    expect(darkTokens.accent.gold).toBeTruthy();
    expect(darkTokens.accent.gold).not.toBe(lightTokens.accent.gold);
  });

  it('hands out the right set for a mode', () => {
    expect(tokensFor('dark')).toBe(darkTokens);
    expect(tokensFor('light')).toBe(lightTokens);
  });
});
