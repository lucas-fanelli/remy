'use client';
import { Analytics, type BeforeSendEvent } from '@vercel/analytics/next';
import { redactResetToken } from '@/lib/utils/resetLinkPrivacy';

// Page views report the full URL, and /auth/reset-password?token=… carries a credential
export function redactAnalyticsEvent(event: BeforeSendEvent): BeforeSendEvent {
  return { ...event, url: redactResetToken(event.url) };
}

// A client component because beforeSend is a function: the root layout is a
// server component and cannot pass one to <Analytics /> itself.
export default function AppAnalytics() {
  return <Analytics beforeSend={redactAnalyticsEvent} />;
}
