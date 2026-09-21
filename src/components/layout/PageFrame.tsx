'use client';
import { Container } from '@mui/material';
import React from 'react';
import type { SxProps, Theme } from '@mui/material/styles';

/**
 * The horizontal frame a page's content sits in.
 *
 * `AppShell` gave every page the same vertical column — header, content, footer. This is
 * the other half: how wide the content is, how far it sits from the edges, and how much
 * air it gets above and below. Those were decided 24 separate times.
 *
 * What that cost, measured at 768px: the home page's content came out 728px wide and
 * search's 712px, because four Containers overrode `px` with a breakpoint at `md` while
 * the other twenty took MUI's default, which steps at `sm`. They agreed below 600 and
 * above 900 and disagreed in between — which is exactly the 8px that made two cards
 * rendering the identical component measure differently.
 *
 * Bottom padding was worse. The shell already clears the fixed bottom bar, but the pages
 * that used to do it themselves never stopped: at 375px the home page put 72px of shell
 * clearance under 80px of its own, and `/about` 72px under 96px — 152px and 168px of dead
 * space to clear a bar that is 58px tall. **Pages must not add bottom-bar clearance.** The
 * `pb` here is breathing room under the last element, nothing more.
 *
 * The background is not repainted either. `AppShell` paints `background.default` on the
 * column; 22 places painted it again on top.
 *
 * THREE PAGES DELIBERATELY DO NOT USE THIS, and they are not leftovers: `/auth`,
 * `error.tsx` and `not-found.tsx` centre a single card in the column rather than flowing a
 * document down it. Their `Container maxWidth="sm"` is only a width bound inside a flex
 * centring box, and this component's `flex: 1` and top padding would fight that centring —
 * the 404's in particular, which is the page the shell work was measured against. Leave
 * them; the absence is the decision.
 */

/**
 * Width is an intent, not a number.
 *
 * Pages genuinely differ — a grid of cards wants room, a recipe wants a comfortable
 * measure, a sign-in card wants neither — and that difference is real rather than drift.
 * Naming the three stops a fourth from being invented.
 */
const WIDTHS = {
  /** Grids of cards: the feed, search, a profile, the admin tables. */
  wide: 'lg',
  /** One column of prose or fields: a recipe, settings, a follower list. */
  reading: 'md',
  /** A single centred card: signing in, an error, the 404. */
  narrow: 'sm',
} as const;

export type PageWidth = keyof typeof WIDTHS;

interface PageFrameProps {
  children: React.ReactNode;
  width?: PageWidth;
  /**
   * For the rare page that needs something else. Not for `px` or for bottom-bar
   * clearance — if either looks necessary, the frame is wrong rather than the page.
   */
  sx?: SxProps<Theme>;
}

export default function PageFrame({ children, width = 'wide', sx }: PageFrameProps) {
  return (
    <Container
      maxWidth={WIDTHS[width]}
      sx={[
        {
          // MUI's own steps, which twenty of the twenty-four already used. The four that
          // overrode it were the home page, the recipe page and settings — all with the
          // identical value, which reads as one decision copied three times rather than
          // three pages that needed it.
          px: { xs: 2, sm: 3 },
          pt: { xs: 2, md: 3 },
          // Air under the last element. NOT clearance for the bottom bar: `AppShell` owns
          // that, and a page adding its own is what produced 152px of nothing.
          pb: { xs: 4, md: 6 },
          // The shell's `<main>` is a flex column; taking the slack means a short page
          // still fills it instead of collapsing and letting the footer ride up.
          flex: 1,
          width: '100%',
        },
        ...(Array.isArray(sx) ? sx : [sx]),
      ]}
    >
      {children}
    </Container>
  );
}
