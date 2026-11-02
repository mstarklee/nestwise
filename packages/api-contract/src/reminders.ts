import { z } from 'zod';

/** The browser's PushSubscription.toJSON(), shape only; the https rule lives in the domain. */
export const PushSubscribeRequest = z.object({
  endpoint: z.string().max(2000),
  keys: z.object({ p256dh: z.string().max(500), auth: z.string().max(500) }),
});
export type PushSubscribeRequest = z.infer<typeof PushSubscribeRequest>;
