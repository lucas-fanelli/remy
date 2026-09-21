import { ThemeProvider } from '@mui/material/styles';
import { render, screen } from '@testing-library/react';
import React from 'react';
import { createAppTheme } from '@/theme/createAppTheme';
import AppShell from '../AppShell';
import PageFrame from '../PageFrame';
import '@testing-library/jest-dom';

/**
 * The frame, guarded.
 *
 * Twenty-four Containers decided width, gutters and air independently. Measured at 768px
 * that put the home page's content at 728px and search's at 712px; at 375px it stacked
 * the page's own bottom-bar clearance on top of the shell's, for 152px on the home page
 * and 168px on `/about` to clear a 58px bar.
 */

const show = (ui: React.ReactElement) =>
  render(<ThemeProvider theme={createAppTheme('light')}>{ui}</ThemeProvider>);

describe('PageFrame', () => {
  /**
   * Padding is NOT asserted here, and the reason is worth writing down.
   *
   * Every value in this component is responsive, and MUI emits even the `xs` key inside
   * `@media (min-width:0px)`, which jsdom does not match. A first draft of this file
   * asserted `paddingLeft: '16px'` and passed — but that 16px was MUI Container's own
   * default gutter, not the frame's `px`. It would have gone on passing with the `px`
   * deleted. The numbers are checked in a browser instead; what is checked here is the
   * structure, which is what a page can actually break.
   */
  it('takes the slack so a short page still fills the column', () => {
    const { container } = show(
      <PageFrame>
        <p>content</p>
      </PageFrame>
    );

    expect(container.querySelector('.MuiContainer-root')).toHaveStyle({ flexGrow: '1' });
  });

  it.each([
    ['wide', 'MuiContainer-maxWidthLg'],
    ['reading', 'MuiContainer-maxWidthMd'],
    ['narrow', 'MuiContainer-maxWidthSm'],
  ] as const)('renders %s at its own measure', (width, expected) => {
    const { container } = show(
      <PageFrame width={width}>
        <p>content</p>
      </PageFrame>
    );

    expect(container.querySelector('.MuiContainer-root')).toHaveClass(expected);
  });

  it('does not repaint the background the shell already painted', () => {
    const { container } = show(
      <PageFrame>
        <p>content</p>
      </PageFrame>
    );
    const frame = container.querySelector('.MuiContainer-root') as HTMLElement;

    // 22 places set `background.default` on top of the column that already had it.
    expect(frame.style.backgroundColor).toBe('');
  });

  it('sits inside the shell without either of them fighting for the bottom', () => {
    // Together: the shell's `<main>` carries the bar clearance, the frame carries the air.
    // They are separate elements on purpose, so neither has to know the other's number.
    show(
      <AppShell header={<div>nav</div>} footer={<div>footer</div>}>
        <PageFrame>
          <p>content</p>
        </PageFrame>
      </AppShell>
    );

    const main = screen.getByRole('main');
    const frame = main.querySelector('.MuiContainer-root');

    expect(frame).toBeInTheDocument();
    expect(main).toHaveStyle({ flexGrow: '1' });
  });
});
