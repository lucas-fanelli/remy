import { defaultCache } from '@serwist/next/worker';
import { NetworkOnly, Serwist } from 'serwist';
import { isResetPasswordPath } from './lib/utils/resetLinkPrivacy';
import type { PrecacheEntry, SerwistGlobalConfig } from 'serwist';

// Declare globals for Serwist
declare global {
  interface WorkerGlobalScope extends SerwistGlobalConfig {
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined;
  }
}

declare const self: ServiceWorkerGlobalScope;

const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  skipWaiting: true,
  clientsClaim: true,
  navigationPreload: true,
  runtimeCaching: [
    // The reset page's URL carries the token: defaultCache would store the
    // document (and its RSC payloads) under that URL for a day. First match wins.
    {
      matcher: ({ url, sameOrigin }) => sameOrigin && isResetPasswordPath(url.pathname),
      handler: new NetworkOnly(),
    },
    // API responses are per-user — the feed says which recipes YOU liked, /auth/me says who
    // you are — but defaultCache's `apis` entry keys them by URL alone and keeps them for a
    // day. On a shared device the next person to open the app was served the previous
    // person's answers, hearts and all, from a cache that logging out never touched.
    // Nothing here is cacheable across readers, so nothing here is cached.
    {
      matcher: ({ url, sameOrigin }) => sameOrigin && url.pathname.startsWith('/api/'),
      handler: new NetworkOnly(),
    },
    ...defaultCache,
  ],
  fallbacks: {
    entries: [
      {
        url: '/offline',
        matcher({ request }) {
          return request.destination === 'document';
        },
      },
    ],
  },
});

serwist.addEventListeners();
