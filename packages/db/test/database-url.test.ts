import { describe, expect, it } from 'vitest';
import { databaseUrl, testDatabaseUrl } from '../src/database-url';

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
