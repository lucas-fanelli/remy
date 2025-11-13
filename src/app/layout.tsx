import type { Metadata } from 'next';
import { AppRouterCacheProvider } from '@mui/material-nextjs/v14-appRouter';
import { ThemeProvider } from '@/contexts/ThemeContext';
import { AuthProvider } from '@/contexts/AuthContext';
import { ToastProvider } from '@/contexts/ToastContext';
import LayoutWrapper from '@/components/LayoutWrapper';
import { BRANDING } from '@/config/branding';
import './globals.css';

export const metadata: Metadata = {
  title: `${BRANDING.name} - ${BRANDING.tagline}`,
  description: BRANDING.description,
  keywords: ['recipes', 'cooking', 'food', 'AI recipes', 'recipe sharing', 'meal planning'],
  authors: [{ name: BRANDING.name }],
  creator: BRANDING.name,
  publisher: BRANDING.name,
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'),
  openGraph: {
    type: 'website',
    locale: 'en_US',
    url: '/',
    siteName: BRANDING.name,
    title: `${BRANDING.name} - ${BRANDING.tagline}`,
    description: BRANDING.description,
    images: [
      {
        url: '/og-image.png',
        width: 1200,
        height: 630,
        alt: `${BRANDING.name} - Share and discover amazing recipes`,
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: `${BRANDING.name} - ${BRANDING.tagline}`,
    description: BRANDING.description,
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
    icon: BRANDING.icon,
    apple: BRANDING.icon,
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                try {
                  var mode = localStorage.getItem('themeMode');
                  if (mode === 'dark') {
                    document.documentElement.classList.add('dark-mode');
                    document.documentElement.style.colorScheme = 'dark';
                  }
                } catch (e) {}
              })();
            `,
          }}
        />
      </head>
      <body suppressHydrationWarning>
        <AppRouterCacheProvider>
          <ThemeProvider>
            <ToastProvider>
              <AuthProvider>
                <LayoutWrapper>
                  {children}
                </LayoutWrapper>
              </AuthProvider>
            </ToastProvider>
          </ThemeProvider>
        </AppRouterCacheProvider>
      </body>
    </html>
  );
}
