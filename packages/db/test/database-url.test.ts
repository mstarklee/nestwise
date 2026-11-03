import { describe, expect, it } from 'vitest';
import { databaseUrl, migrationUrl, testDatabaseUrl } from '../src/database-url';

const parts = { DB_HOST: 'localhost', DB_PORT: '5432', DB_NAME: 'nestwise', DB_USER: 'postgres', DB_PASSWORD: 'p@ss:w/rd#1' };

describe('databaseUrl', () => {
  it('builds the URL from the DB_* parts, encoding the password', () => {
    const url = new URL(databaseUrl(parts));
    expect(url.hostname).toBe('localhost');
    expect(url.port).toBe('5432');
    expect(url.pathname).toBe('/nestwise');
    expect(url.username).toBe('postgres');
    expect(decodeURIComponent(url.password)).toBe('p@ss:w/rd#1');
  });

  it('prefers a full DATABASE_URL', () => {
    expect(databaseUrl({ ...parts, DATABASE_URL: 'postgres://a:b@h:1/d' })).toBe('postgres://a:b@h:1/d');
  });

  it('names every missing part', () => {
    expect(() => databaseUrl({ DB_HOST: 'h' })).toThrow(/DB_PORT, DB_NAME, DB_USER, DB_PASSWORD/);
  });
});

describe('testDatabaseUrl', () => {
  it('uses the same server with the nestwise_test database by default', () => {
    expect(new URL(testDatabaseUrl(parts)).pathname).toBe('/nestwise_test');
    expect(new URL(testDatabaseUrl({ ...parts, TEST_DB_NAME: 'other_test' })).pathname).toBe('/other_test');
  });

  it('prefers TEST_DATABASE_URL', () => {
    expect(testDatabaseUrl({ ...parts, TEST_DATABASE_URL: 'postgres://t:t@h:1/t' })).toBe('postgres://t:t@h:1/t');
  });

  it('refuses to point tests at the main database or at production', () => {
    expect(() => testDatabaseUrl({ ...parts, TEST_DB_NAME: 'nestwise' })).toThrow(/same database/);
    expect(() => testDatabaseUrl({ ...parts, VERCEL_ENV: 'production' })).toThrow(/production/);
  });
});

describe('migrationUrl', () => {
  const prodUrl = 'postgres://p:p@prod:5432/postgres';

  it('development uses DIRECT_DATABASE_URL, or the DB_* database', () => {
    expect(migrationUrl('dev', { ...parts, DIRECT_DATABASE_URL: 'postgres://d:d@h:1/d' })).toBe('postgres://d:d@h:1/d');
    expect(new URL(migrationUrl('dev', parts)!).pathname).toBe('/nestwise');
  });

  it('by hand for production uses PROD_DIRECT_DATABASE_URL only', () => {
    expect(migrationUrl('prod', { ...parts, DATABASE_URL: 'postgres://pool:6543/x', PROD_DIRECT_DATABASE_URL: prodUrl })).toBe(prodUrl);
    expect(() => migrationUrl('prod', { ...parts, DATABASE_URL: 'postgres://pool:6543/x' })).toThrow(/PROD_DIRECT_DATABASE_URL/);
  });

  it('a production deploy uses PROD_DIRECT_DATABASE_URL and fails the deploy without it', () => {
    expect(migrationUrl('deploy', { VERCEL_ENV: 'production', PROD_DIRECT_DATABASE_URL: prodUrl })).toBe(prodUrl);
    expect(() => migrationUrl('deploy', { VERCEL_ENV: 'production', DATABASE_URL: 'postgres://pool:6543/x' })).toThrow(/PROD_DIRECT_DATABASE_URL/);
  });

  it('preview deploys and local builds skip, even when a production URL is present', () => {
    expect(migrationUrl('deploy', { VERCEL_ENV: 'preview', PROD_DIRECT_DATABASE_URL: prodUrl })).toBeNull();
    expect(migrationUrl('deploy', { ...parts, PROD_DIRECT_DATABASE_URL: prodUrl })).toBeNull();
  });
});
