import { SerwistProvider } from '@serwist/turbopack/react';
import type { Metadata, Viewport } from 'next';
import { Baloo_Thambi_2, Mukta_Malar } from 'next/font/google';
import { NextIntlClientProvider } from 'next-intl';
import messages from '../messages/en.json';
import './globals.css';

const baloo = Baloo_Thambi_2({ subsets: ['latin', 'tamil'], weight: ['600', '700', '800'], variable: '--font-baloo', display: 'swap' });
const mukta = Mukta_Malar({ subsets: ['latin', 'tamil'], weight: ['400', '500', '600', '700'], variable: '--font-mukta', display: 'swap' });

export const metadata: Metadata = {
  title: messages.app.name,
  description: messages.app.description,
  appleWebApp: { capable: true, title: messages.app.name, statusBarStyle: 'black-translucent' },
  icons: { apple: [{ url: '/pwa-icon/180', sizes: '180x180', type: 'image/png' }] },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: '#00566E',
};

export default function RootLayout({ children }: LayoutProps<'/'>) {
  return (
    <html lang="en" className={`${baloo.variable} ${mukta.variable} h-full antialiased`}>
      <body className="min-h-full bg-mist font-body text-ink">
        <NextIntlClientProvider locale="en" messages={messages} timeZone="Asia/Kolkata">
          <SerwistProvider swUrl="/serwist/sw.js">{children}</SerwistProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
