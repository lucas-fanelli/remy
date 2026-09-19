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
