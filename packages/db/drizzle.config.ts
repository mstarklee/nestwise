import { defineConfig } from 'drizzle-kit';
import { databaseUrl } from './src/database-url';

const url = () => {
  try {
    return process.env.DIRECT_DATABASE_URL ?? databaseUrl();
  } catch {
    return ''; // `generate` needs no database
  }
};

export default defineConfig({
  dialect: 'postgresql',
  schema: './src/schema/index.ts',
  out: './migrations',
  casing: 'snake_case',
  schemaFilter: ['app'],
  dbCredentials: { url: url() },
});
