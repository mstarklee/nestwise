import { SerwistProvider } from '@serwist/turbopack/react';
import type { Metadata, Viewport } from 'next';
import { NextIntlClientProvider } from 'next-intl';
import messages from '../messages/en.json';
import './globals.css';

export const metadata: Metadata = {
  title: messages.app.name,
  description: messages.app.description,
  appleWebApp: { capable: true, title: messages.app.name, statusBarStyle: 'default' },
  icons: { apple: [{ url: '/pwa-icon/180', sizes: '180x180', type: 'image/png' }] },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: '#14532d',
};

export default function RootLayout({ children }: LayoutProps<'/'>) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full bg-zinc-50 text-zinc-900">
        <NextIntlClientProvider locale="en" messages={messages} timeZone="Asia/Kolkata">
          <SerwistProvider swUrl="/serwist/sw.js">{children}</SerwistProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
