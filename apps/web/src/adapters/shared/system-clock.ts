import 'server-only';
import type { Clock } from '@nestwise/domain/shared';

export const systemClock: Clock = { now: () => new Date() };
