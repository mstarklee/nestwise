/// <reference lib="webworker" />
import { defaultCache } from '@serwist/turbopack/worker';
import type { PrecacheEntry, SerwistGlobalConfig } from 'serwist';
import { NetworkFirst, NetworkOnly, Serwist } from 'serwist';

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
    // The API is never cached: money figures must be live.
    { matcher: ({ url }) => url.pathname.startsWith('/api/'), handler: new NetworkOnly() },
    // Pages: always the newest from the network when online; the last copy seen when offline.
    { matcher: ({ request }) => request.mode === 'navigate', handler: new NetworkFirst({ cacheName: 'pages', networkTimeoutSeconds: 5 }) },
    ...defaultCache,
  ],
});

interface PushPayload {
  title?: string;
  body?: string;
  url?: string;
}

self.addEventListener('push', (event) => {
  let payload: PushPayload = {};
  try {
    payload = event.data?.json() ?? {};
  } catch {
    payload = { body: event.data?.text() };
  }
  event.waitUntil(
    self.registration.showNotification(payload.title ?? 'NestWise', {
      body: payload.body ?? '',
      icon: '/pwa-icon/192',
      badge: '/pwa-icon/192',
      data: { url: payload.url ?? '/home' },
    }),
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = (event.notification.data as { url?: string } | undefined)?.url ?? '/home';
  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      const open = windows[0];
      if (open) {
        await open.focus();
        await open.navigate(url);
      } else {
        await self.clients.openWindow(url);
      }
    })(),
  );
});

serwist.addEventListeners();
