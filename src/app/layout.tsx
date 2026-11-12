import { AppRouterCacheProvider } from '@mui/material-nextjs/v14-appRouter';
import { Nunito } from 'next/font/google';
import { cookies, headers } from 'next/headers';
import { NextIntlClientProvider } from 'next-intl';
import { getTranslations } from 'next-intl/server';
import AppAnalytics from '@/components/analytics/AppAnalytics';
import LayoutWrapper from '@/components/LayoutWrapper';
import InstallPrompt from '@/components/pwa/InstallPrompt';
import { BRANDING } from '@/config/branding';
import { AuthProvider } from '@/contexts/AuthContext';
import { CreateRecipeProvider } from '@/contexts/CreateRecipeContext';
import { MotionProvider } from '@/contexts/MotionContext';
import { PwaProvider } from '@/contexts/PwaContext';
import { ThemeProvider } from '@/contexts/ThemeContext';
import { ToastProvider } from '@/contexts/ToastContext';
import { OPEN_GRAPH_LOCALES } from '@/i18n/config';
import { getServerLocale } from '@/i18n/locale';
import { getMessages } from '@/i18n/messages';
import { COOKIE_NAME } from '@/lib/utils/cookies';
import QueryProvider from '@/providers/QueryProvider';
import { tokensFor } from '@/theme/tokens';
import type { Metadata } from 'next';
import './globals.css';

// Nunito - Rounded, friendly typography
const nunito = Nunito({
  subsets: ['latin'],
  weight: ['300', '400', '500', '600', '700', '800'],
  display: 'swap',
  variable: '--font-nunito',
});

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getServerLocale();
  const t = await getTranslations('metadata');

  const title = t('title', { name: BRANDING.name });
  const description = t('description');

  return {
    title,
    description,
    keywords: t('keywords')
      .split(',')
      .map((keyword) => keyword.trim()),
    authors: [{ name: BRANDING.name }],
    creator: BRANDING.name,
    publisher: BRANDING.name,
    metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'),
    openGraph: {
      type: 'website',
      locale: OPEN_GRAPH_LOCALES[locale],
      url: '/',
      siteName: BRANDING.name,
      title,
      description,
      images: [
        {
          url: '/og-image.png',
          width: 1200,
          height: 630,
          alt: t('ogImageAlt', { name: BRANDING.name }),
        },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: ['/og-image.png'],
    },
    robots: {
      index: true,
      follow: true,
      googleBot: {
        index: true,
        follow: true,
        'max-video-preview': -1,
        'max-image-preview': 'large',
        'max-snippet': -1,
      },
    },
    icons: {
      icon: '/favicon.ico',
      shortcut: '/favicon.ico',
      apple: '/rat-apple-icon-v3.png',
    },
    manifest: '/site.webmanifest',
    appleWebApp: {
      capable: true,
      statusBarStyle: 'black-translucent',
      title: BRANDING.name,
    },
    formatDetection: {
      telephone: false,
    },
    other: {
      'mobile-web-app-capable': 'yes',
      // The app translates itself now; Chrome's auto-translate must not translate it AGAIN
      // on top (that second pass is what made the words jump on every refresh).
      google: 'notranslate',
    },
  };
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const nonce = (await headers()).get('x-nonce') ?? undefined;
  // Resolved from the cookie on the server, so this first HTML is already in the right
  // language - logged in or out, before and after login, with no flash and no re-render.
  const locale = await getServerLocale();
  // Only whether a session cookie came with the request, not whether it is valid: enough
  // for a page to keep room for what a signed-in reader will see instead of making the
  // public part wait for /api/auth/me. See AuthProvider's sessionLikely.
  const sessionHint = (await cookies()).has(COOKIE_NAME);

  return (
    <html
      lang={locale}
      // The app owns its translations now. Without this Chrome would auto-translate the
      // already-translated page and swap words around on every refresh.
      translate="no"
      suppressHydrationWarning
      className={nunito.variable}
    >
      <head>
        {/* Both modes, so the browser chrome follows the page instead of sitting on a
            black that matched neither. The in-app toggle updates these at runtime. */}
        <meta name="theme-color" media="(prefers-color-scheme: light)" content="#FAFAFA" />
        <meta name="theme-color" media="(prefers-color-scheme: dark)" content="#1C1825" />
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
        {/* Browsers blank the nonce attribute in the DOM once parsed (nonce hiding), so
            hydration always sees nonce="" here. The mismatch is expected and harmless. */}
        <script
          nonce={nonce}
          suppressHydrationWarning
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                try {
                  // Add initial-load class to prevent transitions during initial render
                  document.documentElement.classList.add('initial-load');
                  document.documentElement.classList.add('loading');

                  // No stored choice means follow the operating system. It used to mean
                  // light for everyone, whatever they had asked their OS for.
                  var stored = localStorage.getItem('themeMode');
                  var mode = stored || (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
                  if (mode === 'dark') {
                    document.documentElement.classList.add('dark-mode');
                    document.documentElement.style.colorScheme = 'dark';
                    document.documentElement.style.backgroundColor = '${tokensFor('dark').surface.base}';
                  } else {
                    document.documentElement.style.backgroundColor = '${tokensFor('light').surface.base}';
                    // Light mode doesn't need loading class
                    document.documentElement.classList.remove('loading');
                    document.documentElement.classList.add('theme-ready');
                  }

                  // Remove initial-load class after a brief delay to enable transitions
                  setTimeout(function() {
                    document.documentElement.classList.remove('initial-load');
                  }, 100);
                } catch (e) {}
              })();
            `,
          }}
        />
      </head>
      <body>
        {/* Outermost provider: every client component below can call useTranslations(),
            and the messages travel with the first HTML so nothing re-renders to translate */}
        <NextIntlClientProvider locale={locale} messages={getMessages(locale)}>
          <AppRouterCacheProvider options={{ key: 'mui', nonce }}>
            <QueryProvider>
              <ThemeProvider>
                <ToastProvider>
                  <AuthProvider sessionHint={sessionHint}>
                    <PwaProvider>
                      <MotionProvider>
                        <CreateRecipeProvider>
                          <LayoutWrapper>{children}</LayoutWrapper>
                          <InstallPrompt />
                        </CreateRecipeProvider>
                      </MotionProvider>
                    </PwaProvider>
                  </AuthProvider>
                </ToastProvider>
              </ThemeProvider>
            </QueryProvider>
          </AppRouterCacheProvider>
        </NextIntlClientProvider>
        <AppAnalytics />
      </body>
    </html>
  );
}
