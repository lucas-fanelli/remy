import { render, screen } from '@testing-library/react';
import React from 'react';
import SlideUp from '../SlideUp';

describe('SlideUp', () => {
  it('should render its child when it is in', () => {
    render(
      <SlideUp in>
        <div>Sheet</div>
      </SlideUp>
    );

    expect(screen.getByText('Sheet')).toBeVisible();
  });

  it('should forward the ref to the child element', () => {
    const ref = React.createRef<HTMLDivElement>();

    render(
      <SlideUp in ref={ref}>
        <div>Sheet</div>
      </SlideUp>
    );

    expect(ref.current).toBe(screen.getByText('Sheet'));
  });
});
