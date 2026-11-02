import tseslint from 'typescript-eslint';

// The core (packages/domain) may not import frameworks, I/O libraries or outside shapes.
const bannedInDomain = [
  { name: 'next', message: 'packages/domain is framework-free.' },
  { name: 'react', message: 'packages/domain is framework-free.' },
  { name: 'react-dom', message: 'packages/domain is framework-free.' },
  { name: 'server-only', message: 'packages/domain is framework-free.' },
  { name: 'postgres', message: 'Database access belongs in an adapter in apps/web.' },
  { name: 'web-push', message: 'Push belongs in an adapter in apps/web.' },
  { name: 'nodemailer', message: 'Email belongs in an adapter in apps/web.' },
  { name: '@nestwise/db', message: 'The Drizzle schema is an outside shape.' },
  { name: '@nestwise/api-contract', message: 'Zod request/response shapes are outside shapes.' },
];
const bannedPatternsInDomain = [
  { group: ['next/*', 'react/*', 'react-dom/*'], message: 'packages/domain is framework-free.' },
  { group: ['drizzle-orm', 'drizzle-orm/*'], message: 'Database access belongs in an adapter in apps/web.' },
  { group: ['@supabase/*'], message: 'Supabase belongs in an adapter in apps/web.' },
  { group: ['@anthropic-ai/*'], message: 'The Claude SDK belongs in an adapter in apps/web.' },
  { group: ['@nestwise/db/*', '@nestwise/api-contract/*'], message: 'Outside shapes are not allowed in the core.' },
];

export default tseslint.config(
  { ignores: ['**/node_modules/**', '**/.next/**', '**/dist/**', 'spikes/**', '**/next-env.d.ts', '.superpowers/**'] },
  {
    files: ['**/*.{ts,tsx,mts,cts}'],
    extends: [tseslint.configs.recommended],
  },
  {
    files: ['packages/domain/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': ['error', { paths: bannedInDomain, patterns: bannedPatternsInDomain }],
    },
  },
  {
    files: ['packages/domain/test/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-properties': [
        'error',
        { object: 'vi', property: 'mock', message: 'Use an in-memory fake, not a mock.' },
        { object: 'vi', property: 'fn', message: 'Use an in-memory fake, not a mock.' },
        { object: 'vi', property: 'spyOn', message: 'Use an in-memory fake, not a mock.' },
      ],
    },
  },
);
