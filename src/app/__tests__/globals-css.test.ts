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
