import { bigint, pgSchema } from 'drizzle-orm/pg-core';

/** Every NestWise table lives in schema `app`, which is not exposed by the Supabase Data API. */
export const app = pgSchema('app');

/** Money: integer minor units, read as a JS number (safe-integer checked by the domain). */
export const money = () => bigint({ mode: 'number' });
