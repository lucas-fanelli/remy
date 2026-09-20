import { getTranslations } from 'next-intl/server';
import AuthPageShell from '@/components/auth/AuthPageShell';
import ForgotPasswordForm from '@/components/auth/ForgotPasswordForm';
import type { Metadata } from 'next';

// The title follows the request's language, so it has to be built per request
export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('auth');

  return {
    title: t('metadata.forgotPassword'),
    robots: { index: false, follow: false },
  };
}

export default function ForgotPasswordPage() {
  return (
    <AuthPageShell>
      <ForgotPasswordForm />
    </AuthPageShell>
  );
}
