import Dexie, { type EntityTable } from "dexie";

export interface OutboxEntry {
  id: string; // UUID v7, made on the phone so a resend is recognised by the server
  note: string;
  createdAt: string;
}

const db = new Dexie("nestwise-spike") as Dexie & {
  outbox: EntityTable<OutboxEntry, "id">;
  sent: EntityTable<OutboxEntry, "id">;
};
db.version(1).stores({ outbox: "id, createdAt", sent: "id, createdAt" });

/** UUID v7: 48-bit millisecond timestamp, then random bits, with version and variant set. */
export function uuidv7(now = Date.now()): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  let ts = now;
  for (let i = 5; i >= 0; i--) {
    bytes[i] = ts & 0xff;
    ts = Math.floor(ts / 256);
  }
  bytes[6] = (bytes[6]! & 0x0f) | 0x70;
  bytes[8] = (bytes[8]! & 0x3f) | 0x80;
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

export async function addEntry(note: string): Promise<OutboxEntry> {
  const entry = { id: uuidv7(), note, createdAt: new Date().toISOString() };
  await db.outbox.put(entry);
  return entry;
}

export const waitingCount = () => db.outbox.count();
export const sentCount = () => db.sent.count();

/** Sends one entry; the sign-in cookie goes along automatically. Throws when offline. */
async function post(entry: OutboxEntry): Promise<"ok" | "signed_out" | "failed"> {
  const res = await fetch("/api/entries", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(entry),
  });
  if (res.ok) return "ok";
  return res.status === 401 ? "signed_out" : "failed";
}

let flushing: Promise<number> | null = null;

/** Sends every waiting entry; an entry leaves the outbox only after the server answered 2xx. Returns how many went. */
export function flush(): Promise<number> {
  flushing ??= (async () => {
    try {
      let sent = 0;
      for (const entry of await db.outbox.orderBy("createdAt").toArray()) {
        try {
          if ((await post(entry)) !== "ok") break;
        } catch {
          break; // offline: try again on the next trigger
        }
        await db.transaction("rw", db.outbox, db.sent, async () => {
          await db.sent.put(entry);
          await db.outbox.delete(entry.id);
        });
        sent++;
      }
      return sent;
    } finally {
      flushing = null;
    }
  })();
  return flushing;
}

/** Test helper for check (d): sends every already-sent entry again, twice at once. The server count must not change. */
export async function resendAllTwice(): Promise<number> {
  const entries = await db.sent.toArray();
  await Promise.all(entries.flatMap((e) => [post(e), post(e)]));
  return entries.length;
}

export async function clearLocal(): Promise<void> {
  await db.outbox.clear();
  await db.sent.clear();
}
