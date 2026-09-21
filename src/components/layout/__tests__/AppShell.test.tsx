import { ThemeProvider, createTheme } from '@mui/material/styles';
import { render, screen } from '@testing-library/react';
import React from 'react';
import AppShell from '../AppShell';
import '@testing-library/jest-dom';

/**
 * The frame, guarded.
 *
 * Every page used to build its own: 19 set `minHeight: '100vh'`, seven rendered an empty
 * `<Toolbar />` to clear the fixed header, one used padding, six did neither. The `100vh`
 * is what kept the footer below the fold — on the 404, whose content is three lines, the
 * footer sat at exactly one viewport down.
 */

const show = (ui: React.ReactElement) =>
  render(<ThemeProvider theme={createTheme()}>{ui}</ThemeProvider>);

describe('AppShell', () => {
  it('gives the page a main landmark', () => {
    // There was exactly one <main> in the whole app, on the auth pages. Everywhere else
    // a screen reader had no content landmark to jump to.
    show(
      <AppShell header={<div>nav</div>} footer={<div>footer</div>}>
        <p>content</p>
      </AppShell>
    );

    expect(screen.getByRole('main')).toBeInTheDocument();
  });

  it('arranges header, content and footer in one column', () => {
    show(
      <AppShell header={<div data-testid="nav">nav</div>} footer={<div>footer</div>}>
        <p>content</p>
      </AppShell>
    );

    const column = screen.getByTestId('nav').parentElement!;
    expect(column).toHaveStyle({ display: 'flex', flexDirection: 'column' });
  });

  it('lets the content take the slack, which is what pushes the footer down', () => {
    // The Footer has carried `mt: 'auto'` all along. It never did anything because there
    // was no flex column for it to sit at the bottom of.
    show(
      <AppShell header={<div>nav</div>} footer={<div>footer</div>}>
        <p>content</p>
      </AppShell>
    );

    expect(screen.getByRole('main')).toHaveStyle({ flexGrow: '1' });
  });

  it('renders one spacer for the fixed header, not one per page', () => {
    const { container } = show(
      <AppShell header={<div>nav</div>} footer={<div>footer</div>}>
        <p>content</p>
      </AppShell>
    );

    expect(container.querySelectorAll('.MuiToolbar-root')).toHaveLength(1);
  });

  it('skips the spacer when there is no header to clear', () => {
    // The auth pages hide the navigation; a spacer there would be a gap at the top of
    // an otherwise centred card.
    const { container } = show(
      <AppShell>
        <p>content</p>
      </AppShell>
    );

    expect(container.querySelectorAll('.MuiToolbar-root')).toHaveLength(0);
  });

  it('styles the content differently when a fixed bottom bar is on screen', () => {
    // The bar is 58px tall and the footer does not render on small screens, so without
    // clearance the last row of every page sits underneath it. The measured value is
    // 72px at phone width — jsdom does not resolve Emotion's media queries, so this
    // checks that the prop reaches the styles at all, and the browser check covers the
    // number.
    const withBar = show(
      <AppShell header={<div>nav</div>} footer={<div>footer</div>}>
        <p>content</p>
      </AppShell>
    );
    const barClass = withBar.getByRole('main').className;
    withBar.unmount();

    const withoutBar = show(
      <AppShell header={<div>nav</div>} footer={<div>footer</div>} hasBottomBar={false}>
        <p>content</p>
      </AppShell>
    );

    expect(withoutBar.getByRole('main').className).not.toBe(barClass);
  });
});
