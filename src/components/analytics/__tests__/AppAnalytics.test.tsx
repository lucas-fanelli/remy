import { render } from '@testing-library/react';
import React from 'react';
import AppAnalytics, { redactAnalyticsEvent } from '../AppAnalytics';

// Capture the props the real <Analytics /> would receive
const mockAnalytics = jest.fn((_props: unknown) => null);
jest.mock('@vercel/analytics/next', () => ({
  Analytics: (props: unknown) => mockAnalytics(props),
}));

const RAW = 'RAW_TOKEN_VALUE';

describe('AppAnalytics', () => {
  beforeEach(() => {
    mockAnalytics.mockClear();
  });

  it('should render Vercel Analytics with the redacting beforeSend hook', () => {
    render(<AppAnalytics />);

    expect(mockAnalytics).toHaveBeenCalledWith({ beforeSend: redactAnalyticsEvent });
  });

  it('should remove the reset token from the page view URL', () => {
    const event = {
      type: 'pageview' as const,
      url: `https://remy-recipes.com/auth/reset-password?token=${RAW}`,
    };

    const result = redactAnalyticsEvent(event);

    expect(result.url).toBe('https://remy-recipes.com/auth/reset-password?token=[redacted]');
    expect(JSON.stringify(result)).not.toContain(RAW);
  });

  it('should keep the event type and leave other URLs untouched', () => {
    const event = { type: 'pageview' as const, url: 'https://remy-recipes.com/recipe/42?page=2' };

    expect(redactAnalyticsEvent(event)).toEqual(event);
  });
});
