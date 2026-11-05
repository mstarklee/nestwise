import { withSerwist } from '@serwist/turbopack';
import type { NextConfig } from 'next';
import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');

const nextConfig: NextConfig = {
  // The browser test sets this so it can run beside a dev server already using .next.
  distDir: process.env.NEXT_DIST_DIR ?? '.next',
  // In the browser test the dev badge (bottom left) would sit on top of the bar's Home button.
  ...(process.env.NEXT_DIST_DIR ? { devIndicators: false as const } : {}),
  cacheComponents: true,
  partialPrefetching: true,
  transpilePackages: ['@nestwise/domain', '@nestwise/api-contract', '@nestwise/db'],
  turbopack: {
    rules: {
      '*.css': {
        loaders: ['@tailwindcss/turbopack'],
        as: '*.css',
      },
    },
  },
};

export default withSerwist(withNextIntl(nextConfig));
