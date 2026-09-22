import { render, screen } from '@testing-library/react';
import React from 'react';
import PantryLoading from '../loading';

/**
 * A route's loading.tsx is what shows the moment it is opened. The pantry's returned null,
 * and a loading boundary replaces the page at once, so opening the pantry blanked the main
 * area until the page arrived.
 */

describe('the pantry route while it loads', () => {
  it('shows a skeleton of the page, announced as loading, instead of nothing', () => {
    const { container } = render(<PantryLoading />);

    expect(container).not.toBeEmptyDOMElement();
    expect(screen.getByRole('status', { name: 'Loading...' })).toBeInTheDocument();
  });
});
