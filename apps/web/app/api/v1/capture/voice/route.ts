import { CaptureBatchResponse } from '@nestwise/api-contract';
import { CaptureNotUnderstoodError, needsAttention } from '@nestwise/domain/capture';
import { maxClipSeconds, readProvider } from '@/capture/clip-limits';
import { makeCaptureVoiceUseCase } from '@/composition/capture';
import { perRequest } from '@/http/per-request';
import { requireActor } from '@/http/require-actor';
import { withApiErrors } from '@/http/with-api-errors';

/** Two network calls happen inside this request (listen, then understand), so it needs more than the default. */
export const maxDuration = 60;

/** 0.5 MB a minute at 64 kbps, so a minute of audio is nowhere near Vercel's 4.5 MB request limit. */
const MAX_BYTES = 8 * 1024 * 1024;

const ACCEPTED = new Set(['audio/mp4', 'audio/mpeg', 'audio/m4a', 'audio/wav', 'audio/webm', 'audio/ogg']);

/**
 * Takes one recording, returns the entries for the review screen. Nothing is counted: the entries wait in the
 * staging store until their speaker confirms them (design §8).
 *
 * The audio lives only for this request. It is read into memory, handed to the speech service, and dropped.
 */
export const POST = withApiErrors(async (request: Request) => {
  await perRequest();
  const actor = await requireActor(request);

  const form = await request.formData();
  const file = form.get('audio');
  if (!(file instanceof Blob)) throw new CaptureNotUnderstoodError('No recording was sent');
  if (file.size === 0) throw new CaptureNotUnderstoodError("The recording was empty — we couldn't hear anything");
  if (file.size > MAX_BYTES) throw new CaptureNotUnderstoodError('That recording is too long');

  const mimeType = (file.type || 'audio/mp4').split(';')[0]!.trim();
  if (!ACCEPTED.has(mimeType)) throw new CaptureNotUnderstoodError("That isn't a recording we can read");

  // The browser reports how long it recorded; it is the only place a duration is known before the audio is decoded.
  const seconds = Number(form.get('seconds') ?? 0);
  const limit = maxClipSeconds(readProvider(process.env.STT_PROVIDER));
  if (Number.isFinite(seconds) && seconds > limit + 1) {
    throw new CaptureNotUnderstoodError(`A recording can be up to ${limit} seconds`);
  }

  const audio = new Uint8Array(await file.arrayBuffer());
  const batch = await makeCaptureVoiceUseCase(actor.familyId).execute({ actor, audio, mimeType });

  return Response.json(
    CaptureBatchResponse.parse({
      batch: {
        id: batch.id,
        createdBy: batch.createdBy,
        transcript: batch.transcript,
        createdAt: batch.createdAt.toISOString(),
        entries: batch.entries.map((entry) => ({ ...entry, needsAttention: needsAttention(entry) })),
      },
    }),
    { status: 201 },
  );
});
