import { handle, requireUserId } from "@/lib/auth";
import { getSql } from "@/lib/db";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Idempotent: the same client id sent twice stores one row (check d).
export const POST = handle(async (request) => {
  const userId = await requireUserId(request);
  const body = (await request.json()) as { id?: unknown; note?: unknown; createdAt?: unknown };
  if (typeof body.id !== "string" || !UUID.test(body.id) || typeof body.note !== "string" || typeof body.createdAt !== "string") {
    return Response.json({ error: "bad_request" }, { status: 400 });
  }
  const sql = await getSql();
  const inserted = await sql`
    insert into public.spike_entries (id, user_id, note, client_created_at)
    values (${body.id}, ${userId}, ${body.note}, ${body.createdAt})
    on conflict (id) do nothing
    returning id`;
  return Response.json({ id: body.id, created: inserted.length === 1 }, { status: inserted.length === 1 ? 201 : 200 });
});

export const GET = handle(async (request) => {
  const userId = await requireUserId(request);
  const sql = await getSql();
  const rows = await sql<{ id: string; note: string; received_at: Date }[]>`
    select id, note, received_at from public.spike_entries where user_id = ${userId} order by received_at desc`;
  return Response.json({ count: rows.length, rows });
});

export const DELETE = handle(async (request) => {
  const userId = await requireUserId(request);
  const sql = await getSql();
  await sql`delete from public.spike_entries where user_id = ${userId}`;
  return Response.json({ cleared: true });
});
