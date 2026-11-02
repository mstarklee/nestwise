import 'server-only';
import { randomUUID } from 'node:crypto';
import type { IdGenerator } from '@nestwise/domain/shared';

export const uuidIds: IdGenerator = { next: () => randomUUID() };
