import { render, screen } from '@testing-library/react';
import React from 'react';
import { renderWithLocale } from '@/i18n/testing';
import CookingLog from '../CookingLog';

/**
 * Dates follow Madrid, where most readers are. They used to follow Buenos Aires, four to
 * five hours behind, so a dinner cooked in Spain after midnight was logged as the day
 * before. Both instants below are 00:30 in Madrid: one in winter time (UTC+1), one in
 * summer time (UTC+2). In Buenos Aires both are still the previous evening.
 */

const mockFetch = global.fetch as jest.Mock;

const cookedAt = (iso: string) => ({
  ok: true,
  json: async () => ({
    cookedRecipes: [
      {
        id: 'cooked-1',
        cookedAt: iso,
        post: { id: 'post-1', title: 'Milanesas', imageUrl: '', user: null },
      },
    ],
    totalPages: 1,
  }),
});

describe('CookingLog dates', () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  it('should date a dinner cooked after midnight in Madrid on the day it was cooked, in winter', async () => {
    mockFetch.mockResolvedValueOnce(cookedAt('2026-03-14T23:30:00.000Z'));

    renderWithLocale(render, 'es', <CookingLog />);

    expect(await screen.findByText('15 de marzo de 2026')).toBeInTheDocument();
  });

  it('should date a dinner cooked after midnight in Madrid on the day it was cooked, in summer', async () => {
    mockFetch.mockResolvedValueOnce(cookedAt('2026-07-14T22:30:00.000Z'));

    renderWithLocale(render, 'es', <CookingLog />);

    expect(await screen.findByText('15 de julio de 2026')).toBeInTheDocument();
  });
});
