import type { MetadataRoute } from 'next';
import messages from '../messages/en.json';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: messages.app.name,
    short_name: messages.app.name,
    description: messages.app.description,
    start_url: '/home',
    scope: '/',
    display: 'standalone',
    background_color: '#ECF3F4',
    theme_color: '#00566E',
    icons: [
      { src: '/pwa-icon/192', sizes: '192x192', type: 'image/png' },
      { src: '/pwa-icon/512', sizes: '512x512', type: 'image/png' },
      { src: '/pwa-icon/512', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };
}
