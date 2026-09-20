/**
 * Every colour Remy uses, named by what it means.
 *
 * Before this there was no colour layer at all: one 303-line `createTheme()` call lived
 * inside a React context, hand-copied into `globals.css`, the boot script in `layout.tsx`
 * and `site.webmanifest`. Four copies, drifting. Components reached past it for greys the
 * theme never declared — 32 distinct neutral fills rendered in dark mode against 2
 * declared surfaces — because there was no `surface.sunken` or `border.strong` to ask for.
 *
 * Two rules hold this together:
 *
 * 1. **A token is a role, not a colour.** `border.subtle` is "the quietest line that is
 *    still a line". What hex that is depends on the mode, and nothing outside this file
 *    gets to decide.
 * 2. **Both modes are the same brand.** Light was purple and gold; dark was teal and more
 *    teal, with no gold at all. They were two different products. The purple carries
 *    across now, retuned for each background rather than replaced.
 *
 * Contrast figures in the comments are measured against that mode's `surface.base`.
 */

export interface ColorTokens {
  surface: {
    /** The page behind everything. */
    base: string;
    /** Cards, sheets, menus — anything sitting on the page. */
    raised: string;
    /** Wells and inset panels: search fields, code blocks, empty states. */
    sunken: string;
    /** Scrims over photos and behind dialogs. Deliberately the same in both modes. */
    overlay: string;
  };
  border: {
    /** Dividers and card edges. Quiet, but it must be visible — the old one was 1.35:1. */
    subtle: string;
    /** When the border is the only thing defining an element. */
    strong: string;
    /** Focus rings. Never the brand colour alone — it has to work on brand fills too. */
    focus: string;
  };
  text: {
    primary: string;
    secondary: string;
    disabled: string;
    /** On a brand-coloured fill. */
    onBrand: string;
    /** On a photo or a scrim, in either mode. */
    onOverlay: string;
  };
  brand: {
    main: string;
    hover: string;
    /** Tinted backgrounds: selected rows, active nav, subtle badges. */
    subtle: string;
  };
  state: {
    success: string;
    warning: string;
    danger: string;
    info: string;
    /** Ink for text or icons sitting on a filled state colour. */
    onSuccess: string;
    onWarning: string;
    onDanger: string;
    onInfo: string;
  };
  accent: {
    /** Stars and highlights. It existed only in light mode before. */
    gold: string;
  };
  shadow: {
    card: string;
    overlay: string;
  };
}

/**
 * Light mode keeps the brand it already had — #673AB7 at 8.59:1 on #FAFAFA.
 */
export const lightTokens: ColorTokens = {
  surface: {
    base: '#FAFAFA',
    raised: '#FFFFFF',
    sunken: '#F1F0F4',
    overlay: 'rgba(0, 0, 0, 0.62)',
  },
  border: {
    subtle: 'rgba(27, 21, 36, 0.22)',
    strong: 'rgba(27, 21, 36, 0.50)',
    focus: '#673AB7',
  },
  text: {
    primary: '#1B1524',
    secondary: '#554C63',
    disabled: '#918A9B',
    onBrand: '#FFFFFF',
    onOverlay: '#FFFFFF',
  },
  brand: {
    main: '#673AB7',
    hover: '#512DA8',
    subtle: 'rgba(103, 58, 183, 0.10)',
  },
  state: {
    success: '#2E7D32',
    warning: '#A85400',
    danger: '#C62828',
    info: '#0270A8',
    // Dark ink on the lighter fills, because white on amber was 2.2:1.
    onSuccess: '#FFFFFF',
    onWarning: '#FFFFFF',
    onDanger: '#FFFFFF',
    onInfo: '#FFFFFF',
  },
  accent: {
    gold: '#B26A00',
  },
  shadow: {
    card: 'rgba(23, 18, 32, 0.10)',
    overlay: 'rgba(23, 18, 32, 0.22)',
  },
};

/**
 * Dark mode, now the same brand as light.
 *
 * `brand.main` #BD9CF6 measures 7.34:1 on #16131B, against 5.56:1 for the teal it
 * replaces. Surfaces step up rather than relying on MUI's elevation overlay, which used
 * to invent eight greys nobody wrote. Borders are white at 22% — the old 12% composited
 * to 1.35:1, which is why they read as invisible.
 */
export const darkTokens: ColorTokens = {
  surface: {
    base: '#16131B',
    raised: '#211D29',
    sunken: '#0F0D13',
    overlay: 'rgba(0, 0, 0, 0.62)',
  },
  border: {
    subtle: 'rgba(255, 255, 255, 0.22)',
    strong: 'rgba(255, 255, 255, 0.38)',
    focus: '#D7C2FF',
  },
  text: {
    primary: '#EDE9F2',
    secondary: '#B3AAC0',
    disabled: '#7C7489',
    // Purple this light needs dark ink, not white.
    onBrand: '#1B1524',
    onOverlay: '#FFFFFF',
  },
  brand: {
    main: '#BD9CF6',
    hover: '#D3BCFF',
    subtle: 'rgba(189, 156, 246, 0.16)',
  },
  state: {
    success: '#7BC97F',
    warning: '#F0A44A',
    danger: '#F2726F',
    info: '#5FC2F5',
    // Every one of these fills is light enough that white text fails AA on it. The six
    // files hardcoding `color: 'white'` over difficulty chips were 2.16:1 to 3.49:1.
    onSuccess: '#10240F',
    onWarning: '#2A1800',
    onDanger: '#2E0D0C',
    onInfo: '#04202E',
  },
  accent: {
    gold: '#F3C969',
  },
  shadow: {
    // Black on a dark page is invisible, so elevation leans on a lifted surface and a
    // ring of light instead of a drop shadow pretending to be one.
    card: 'rgba(0, 0, 0, 0.55)',
    overlay: 'rgba(0, 0, 0, 0.70)',
  },
};

export const tokensFor = (mode: 'light' | 'dark'): ColorTokens =>
  mode === 'dark' ? darkTokens : lightTokens;

/**
 * What the browser chrome should match — the address bar on Android, the status bar on
 * an installed PWA. It was `#000000` in both the manifest and a single static meta tag,
 * matching neither mode and never following the toggle.
 */
export const browserThemeColor = (mode: 'light' | 'dark'): string => tokensFor(mode).surface.base;
