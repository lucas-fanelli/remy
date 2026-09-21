import fs from 'fs';
import path from 'path';
import { darkTokens, lightTokens } from '../tokens';

/**
 * The palette used to live in four places — the theme, `globals.css`, the boot script in
 * `layout.tsx` and `site.webmanifest` — each hand-kept, and they had already drifted: the
 * manifest said `#000000`, which matched neither mode.
 *
 * Three of those still need a literal, because they paint before any JavaScript that
 * could read a token. These check the copies against the source.
 */

const read = (...parts: string[]) => fs.readFileSync(path.join(process.cwd(), ...parts), 'utf8');

const hexes = (text: string) => (text.match(/#[0-9a-f]{6}/gi) ?? []).map((h) => h.toLowerCase());

describe('globals.css', () => {
  const css = read('src', 'app', 'globals.css');

  it('paints the pre-hydration page with the token surfaces', () => {
    // These two run before React, so they cannot be read from tokens.ts at runtime.
    expect(hexes(css)).toContain(lightTokens.surface.base.toLowerCase());
    expect(hexes(css)).toContain(darkTokens.surface.base.toLowerCase());
  });

  it('leaves the body colour to the theme', () => {
    // A plain `body` rule here set the background and won on cascade order, so changing
    // `background.default` in the theme did not move the page.
    const bodyRules = css.match(/(^|\n)body\s*\{[^}]*\}/g) ?? [];
    for (const rule of bodyRules) {
      expect(rule).not.toMatch(/background-color:/);
      expect(rule).not.toMatch(/(^|[^-])\bcolor:/);
    }
  });

  it('holds no colour the tokens do not know about', () => {
    const known = new Set(
      [lightTokens.surface.base, darkTokens.surface.base].map((h) => h.toLowerCase())
    );
    // Greys for the WebKit scrollbar are the one exception, and they are mode-neutral.
    const scrollbarGreys = new Set(['#f1f1f1', '#888888', '#555555', '#888', '#555']);
    const stray = hexes(css).filter((h) => !known.has(h) && !scrollbarGreys.has(h));

    expect(stray).toEqual([]);
  });
});

describe('the boot script', () => {
  const layout = read('src', 'app', 'layout.tsx');

  it('reads its colours from the tokens rather than repeating them', () => {
    expect(layout).toContain("tokensFor('dark').surface.base");
    expect(layout).toContain("tokensFor('light').surface.base");
  });

  it('follows the operating system when the reader has not chosen', () => {
    // It defaulted everyone to light and never consulted the preference.
    expect(layout).toContain('prefers-color-scheme: dark');
  });

  it('gives the browser chrome a colour for each mode', () => {
    const themeColors = layout.match(/<meta name="theme-color"[^/]*\/>/g) ?? [];
    expect(themeColors).toHaveLength(2);
    expect(themeColors.join(' ')).toContain(lightTokens.surface.base);
    expect(themeColors.join(' ')).toContain(darkTokens.surface.base);
  });
});

describe('the web manifest', () => {
  const manifest = JSON.parse(read('public', 'site.webmanifest'));

  it('matches a surface the app actually renders', () => {
    // It was #000000 — neither the light page nor the dark one.
    expect(manifest.theme_color).toBe(darkTokens.surface.base);
    expect(manifest.background_color).toBe(darkTokens.surface.base);
  });
});
