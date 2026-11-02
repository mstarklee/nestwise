import webpush from "web-push";
import { handle, requireUserId } from "@/lib/auth";
import { getSql } from "@/lib/db";

export const maxDuration = 30;

interface SubscriptionJson {
  endpoint: string;
  keys: { p256dh: string; auth: string };
}

type Body =
  | { action: "subscribe"; subscription: SubscriptionJson }
  | { action: "send"; delaySeconds?: number };

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// "subscribe" saves this device's subscription; "send" pushes one test message to every device of this user,
// after an optional delay (max 15 s) so there is time to lock the phone (check c).
export const POST = handle(async (request) => {
  const userId = await requireUserId(request);
  const body = (await request.json()) as Body;
  const sql = await getSql();

  if (body.action === "subscribe") {
    const { endpoint, keys } = body.subscription;
    await sql`
      insert into public.spike_push_subscriptions (endpoint, user_id, p256dh, auth, user_agent)
      values (${endpoint}, ${userId}, ${keys.p256dh}, ${keys.auth}, ${request.headers.get("user-agent")})
      on conflict (endpoint) do update set user_id = excluded.user_id, p256dh = excluded.p256dh, auth = excluded.auth`;
    return Response.json({ saved: true });
  }

  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT!,
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
    process.env.VAPID_PRIVATE_KEY!,
  );
  const delay = Math.min(Math.max(Number(body.delaySeconds ?? 0), 0), 15);
  if (delay > 0) await sleep(delay * 1000);

  const subs = await sql<{ endpoint: string; p256dh: string; auth: string }[]>`
    select endpoint, p256dh, auth from public.spike_push_subscriptions where user_id = ${userId}`;
  const sentAt = new Date().toISOString();
  const results = await Promise.all(
    subs.map(async (s) => {
      try {
        await webpush.sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          JSON.stringify({ title: "NestWise spike", body: `Test push sent at ${sentAt}`, url: "/" }),
          { TTL: 60 },
        );
        return { ok: true as const };
      } catch (error) {
        const status = (error as { statusCode?: number }).statusCode;
        if (status === 404 || status === 410) {
          await sql`delete from public.spike_push_subscriptions where endpoint = ${s.endpoint}`;
        }
        return { ok: false as const, status };
      }
    }),
  );
  return Response.json({ devices: subs.length, sent: results.filter((r) => r.ok).length, sentAt, results });
});
