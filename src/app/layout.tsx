import type { Metadata } from 'next';
import { AppRouterCacheProvider } from '@mui/material-nextjs/v14-appRouter';
import { ThemeProvider } from '@/contexts/ThemeContext';
import { AuthProvider } from '@/contexts/AuthContext';
import { ToastProvider } from '@/contexts/ToastContext';
import LayoutWrapper from '@/components/LayoutWrapper';
import InstallPrompt from '@/components/pwa/InstallPrompt';
import { PwaProvider } from '@/contexts/PwaContext';
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
    icon: [
      { url: '/icon.png', type: 'image/png' },
      { url: '/chef-logo.png', type: 'image/png' },
    ],
    shortcut: '/icon.png',
    apple: '/apple-icon.png',
  },
  manifest: '/manifest.json',
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
        <meta name="theme-color" content="#000000" />
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover" />
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                try {
                  // Add initial-load class to prevent transitions during initial render
                  document.documentElement.classList.add('initial-load');
                  document.documentElement.classList.add('loading');

                  var mode = localStorage.getItem('themeMode');
                  if (mode === 'dark') {
                    document.documentElement.classList.add('dark-mode');
                    document.documentElement.style.colorScheme = 'dark';
                    document.documentElement.style.backgroundColor = '#1E1E1E';
                  } else {
                    document.documentElement.style.backgroundColor = '#FAFAFA';
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
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                // Google Translate DOM Mutation Patch
                // Prevents React from crashing when Google Translate modifies the DOM
                try {
                  // Store original methods
                  var originalRemoveChild = Node.prototype.removeChild;
                  var originalInsertBefore = Node.prototype.insertBefore;

                  // Patch removeChild to handle Google Translate mutations
                  Node.prototype.removeChild = function(child) {
                    // Check if the child is actually a child of this node
                    if (this.contains(child)) {
                      try {
                        return originalRemoveChild.call(this, child);
                      } catch (e) {
                        // If removal fails, log it but don't crash
                        if (e.name !== 'NotFoundError') {
                          console.warn('removeChild failed:', e);
                        }
                        return child;
                      }
                    }
                    // If not a child, just return the node without crashing
                    return child;
                  };

                  // Patch insertBefore to handle Google Translate mutations
                  Node.prototype.insertBefore = function(newNode, referenceNode) {
                    // If referenceNode is null, append to end
                    if (!referenceNode) {
                      return originalInsertBefore.call(this, newNode, null);
                    }

                    // Check if referenceNode is actually a child of this node
                    if (this.contains(referenceNode)) {
                      try {
                        return originalInsertBefore.call(this, newNode, referenceNode);
                      } catch (e) {
                        // If insertion fails, log it but don't crash
                        if (e.name !== 'NotFoundError') {
                          console.warn('insertBefore failed:', e);
                        }
                        // Fallback: append to end
                        return originalInsertBefore.call(this, newNode, null);
                      }
                    }

                    // If referenceNode is not a child, append to end
                    return originalInsertBefore.call(this, newNode, null);
                  };

                  // Log successful patch (only in development)
                  if (typeof window !== 'undefined' && window.location.hostname === 'localhost') {
                    console.info('Google Translate DOM patch applied successfully');
                  }
                } catch (e) {
                  console.error('Failed to apply Google Translate DOM patch:', e);
                }
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
                <PwaProvider>
                  <LayoutWrapper>
                    {children}
                  </LayoutWrapper>
                  <InstallPrompt />
                </PwaProvider>
              </AuthProvider>
            </ToastProvider>
          </ThemeProvider>
        </AppRouterCacheProvider>
      </body>
    </html>
  );
}
