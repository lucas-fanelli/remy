import { render, screen } from '@testing-library/react';
import React from 'react';
import NotificationsLoading from '../notifications/loading';
import ProfileLoading from '../profile/[username]/loading';
import RecipeLoading from '../recipe/[id]/loading';
import SettingsLoading from '../settings/loading';

/**
 * A route's loading.tsx is what shows the moment it is opened, while the page is on its
 * way. Every one of these returned null, under a comment saying that kept the previous page
 * visible — it does not: a loading boundary replaces the page at once. Measured in
 * production, opening a recipe left the main area blank for ~690 ms.
 */

describe.each([
  ['recipe', RecipeLoading],
  ['profile', ProfileLoading],
  ['notifications', NotificationsLoading],
  ['settings', SettingsLoading],
])('the %s route while it loads', (_, Loading) => {
  it('shows a skeleton of the page, announced as loading, instead of nothing', () => {
    const { container } = render(<Loading />);

    expect(container).not.toBeEmptyDOMElement();
    expect(screen.getByRole('status', { name: 'Loading...' })).toBeInTheDocument();
  });
});
