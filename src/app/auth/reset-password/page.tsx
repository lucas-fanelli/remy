import { getTranslations } from 'next-intl/server';
import AuthPageShell from '@/components/auth/AuthPageShell';
import ResetPasswordForm from '@/components/auth/ResetPasswordForm';
import type { Metadata } from 'next';

// The title follows the request's language, so it has to be built per request
export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('auth');

  return {
    title: t('metadata.resetPassword'),
    robots: { index: false, follow: false },
    // The URL of this page carries the reset token: never send it as a Referer
    referrer: 'no-referrer',
  };
}

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
