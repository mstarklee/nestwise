/**
 * A UUID v7 made on the phone (time-ordered), so a resend of the same expense is recognised by the server.
 * 48 bits of milliseconds, then version 7, then random bits with the RFC 4122 variant.
 */
export function newId(now: number = Date.now()): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  let ms = BigInt(now);
  for (let i = 5; i >= 0; i -= 1) {
    bytes[i] = Number(ms & 0xffn);
    ms >>= 8n;
  }
  bytes[6] = (bytes[6]! & 0x0f) | 0x70;
  bytes[8] = (bytes[8]! & 0x3f) | 0x80;
  const hex = [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
