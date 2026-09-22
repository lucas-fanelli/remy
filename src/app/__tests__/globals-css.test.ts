/**
 * @jest-environment node
 *
 * Guards the layout-stability rules in globals.css. They look like cosmetic one-liners,
 * so they are easy to "tidy up" back into the bug: clipping the page horizontally turns
 * <body> into a scroll container, MUI's scroll lock stops working, and every Dialog,
 * Menu, Select and Drawer squeezes the page by the scrollbar's width and releases it on
 * close — the shift that used to happen all over the app.
 */
import fs from 'fs';
import path from 'path';
import { createTheme } from '@mui/material/styles';

const css = fs.readFileSync(path.join(__dirname, '..', 'globals.css'), 'utf8');

/** The file without its comments, so the explanations do not trip the checks */
const rules = css.replace(/\/\*[\s\S]*?\*\//g, '');

describe('globals.css layout stability', () => {
  it('should keep the vertical scrollbar always present so the page never changes width', () => {
    expect(rules).toMatch(/html\s*\{[^}]*overflow-y:\s*scroll/);
  });

  it('should never clip the page horizontally', () => {
    // Clipping hides overflow instead of fixing it, and breaks the scroll lock with it.
    expect(rules).not.toMatch(/overflow-x:\s*hidden/);
  });

  it('should not reserve a scrollbar gutter as well', () => {
    // scrollbar-gutter keeps the gutter while the lock hides the scrollbar, so MUI's
    // compensation becomes a net gain: the same shift with the opposite sign.
    expect(rules).not.toMatch(/scrollbar-gutter/);
  });

  it('should not size html or body against 100vw, which includes the scrollbar', () => {
    expect(rules).not.toMatch(/(?:html|body)[^{]*\{[^}]*(?:max-)?width:\s*100vw/);
  });
});

describe('globals.css scroll padding', () => {
  // Scrolls to an element stop this far down: under the fixed header plus 16px of air.
  // The header is MUI's toolbar, so these numbers are its heights — a hand-kept copy,
  // which is what this test is for.
  const AIR = 16;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- MUI types it as CSS
  const toolbar = createTheme().mixins.toolbar as Record<string, any>;

  /** The first scroll-padding-top declared after `marker`. */
  function paddingAfter(marker: string): number {
    const from = rules.indexOf(marker);
    if (from < 0) throw new Error(`globals.css has no "${marker}"`);
    return Number(rules.slice(from).match(/scroll-padding-top:\s*(\d+)px/)?.[1]);
  }

  it('clears the header at its default height', () => {
    // The first declaration is the one outside any media query.
    expect(paddingAfter('scroll-padding-top')).toBe(toolbar.minHeight + AIR);
  });

  it('clears the shorter header of a narrow screen held sideways', () => {
    const landscape =
      toolbar['@media (min-width:0px)']['@media (orientation: landscape)'].minHeight;

    expect(paddingAfter('@media (min-width: 0px) and (orientation: landscape)')).toBe(
      landscape + AIR
    );
  });

  it('clears the taller header from 600px up, winning over landscape there as MUI does', () => {
    const wide = toolbar['@media (min-width:600px)'].minHeight;

    expect(paddingAfter('@media (min-width: 600px)')).toBe(wide + AIR);
    expect(rules.indexOf('@media (min-width: 600px)')).toBeGreaterThan(
      rules.indexOf('(orientation: landscape)')
    );
  });
});
