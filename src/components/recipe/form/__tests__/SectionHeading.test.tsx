import { screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { createRef } from 'react';
import SectionHeading from '../SectionHeading';
import { renderWithTheme } from './editorHarness';

describe('SectionHeading', () => {
  it('should render a level 2 heading by default', () => {
    renderWithTheme(<SectionHeading>Ingredients</SectionHeading>);

    expect(screen.getByRole('heading', { level: 2, name: 'Ingredients' })).toBeInTheDocument();
  });

  it('should render a level 3 heading when asked', () => {
    renderWithTheme(<SectionHeading component="h3">Steps</SectionHeading>);

    expect(screen.getByRole('heading', { level: 3, name: 'Steps' })).toBeInTheDocument();
  });

  it('should take focus from a script without being a tab stop', () => {
    const ref = createRef<HTMLHeadingElement>();
    renderWithTheme(<SectionHeading ref={ref}>Basics</SectionHeading>);

    ref.current?.focus();

    expect(screen.getByRole('heading', { name: 'Basics' })).toHaveFocus();
    expect(screen.getByRole('heading', { name: 'Basics' })).toHaveAttribute('tabindex', '-1');
  });

  it('should leave 16px above itself when scrolled into view', () => {
    renderWithTheme(<SectionHeading>Basics</SectionHeading>);

    expect(screen.getByRole('heading', { name: 'Basics' })).toHaveStyle({
      scrollMarginTop: '16px',
    });
  });

  it('should leave the room the shell asks for under a pinned header', () => {
    renderWithTheme(<SectionHeading scrollMarginTop={72}>Basics</SectionHeading>);

    expect(screen.getByRole('heading', { name: 'Basics' })).toHaveStyle({
      scrollMarginTop: '72px',
    });
  });

  it('should merge an sx object from the shell', () => {
    renderWithTheme(<SectionHeading sx={{ marginBottom: '8px' }}>Basics</SectionHeading>);

    expect(screen.getByRole('heading', { name: 'Basics' })).toHaveStyle({
      marginBottom: '8px',
      scrollMarginTop: '16px',
    });
  });

  it('should merge an sx array from the shell', () => {
    renderWithTheme(
      <SectionHeading sx={[{ marginBottom: '8px' }, { marginTop: '4px' }]}>Basics</SectionHeading>
    );

    expect(screen.getByRole('heading', { name: 'Basics' })).toHaveStyle({
      marginBottom: '8px',
      marginTop: '4px',
    });
  });

  it('should pass other props to the heading', () => {
    renderWithTheme(<SectionHeading id="ingredients-heading">Ingredients</SectionHeading>);

    expect(screen.getByRole('heading', { name: 'Ingredients' })).toHaveAttribute(
      'id',
      'ingredients-heading'
    );
  });
});
