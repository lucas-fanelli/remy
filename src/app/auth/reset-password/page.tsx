import AuthPageShell from '@/components/auth/AuthPageShell';
import ResetPasswordForm from '@/components/auth/ResetPasswordForm';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Choose a new password',
  robots: { index: false, follow: false },
  // The URL of this page carries the reset token: never send it as a Referer
  referrer: 'no-referrer',
};

interface ResetPasswordPageProps {
  searchParams: Promise<{ token?: string | string[] }>;
}

export default async function ResetPasswordPage({ searchParams }: ResetPasswordPageProps) {
  const { token } = await searchParams;

  return (
    <AuthPageShell>
      <ResetPasswordForm token={typeof token === 'string' && token ? token : null} />
    </AuthPageShell>
  );
}
