/**
 * The microphone plumbing, kept apart from the timing rules in `recording-clock.ts` so those stay testable.
 *
 * Thin by design: open the mic, record to one blob, and report the current input level. Everything that decides
 * *when* to stop lives in `RecordingClock`.
 */
export interface Recording {
  /** The current input level, 0–1, read from the analyser. */
  level(): number;
  /** Stops recording and gives back what was captured. Safe to call twice. */
  stop(): Promise<{ blob: Blob; mimeType: string }>;
}

/** The recording formats iPhone Safari and Chrome actually produce, best first. */
const PREFERRED_TYPES = ['audio/mp4', 'audio/webm;codecs=opus', 'audio/webm'];

function pickMimeType(): string | undefined {
  if (typeof MediaRecorder === 'undefined') return undefined;
  return PREFERRED_TYPES.find((type) => MediaRecorder.isTypeSupported(type));
}

export class MicrophoneUnavailableError extends Error {}

/**
 * Asks for the microphone and starts recording. Throws `MicrophoneUnavailableError` when the browser has no
 * microphone API or the person says no — the caller turns that into "we couldn't reach your microphone".
 */
export async function startRecording(): Promise<Recording> {
  if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
    throw new MicrophoneUnavailableError('This browser cannot record audio');
  }

  let stream: MediaStream;
  try {
    stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  } catch (cause) {
    throw new MicrophoneUnavailableError('The microphone was not allowed', { cause });
  }

  const mimeType = pickMimeType();
  const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
  const chunks: Blob[] = [];
  recorder.addEventListener('dataavailable', (event) => {
    if (event.data.size > 0) chunks.push(event.data);
  });

  const finished = new Promise<void>((resolve) => recorder.addEventListener('stop', () => resolve(), { once: true }));
  recorder.start();

  // A separate analyser on the same stream, only ever read, never recorded.
  const audio = new AudioContext();
  const analyser = audio.createAnalyser();
  analyser.fftSize = 512;
  audio.createMediaStreamSource(stream).connect(analyser);
  const samples = new Uint8Array(analyser.fftSize);

  let stopping: Promise<{ blob: Blob; mimeType: string }> | null = null;

  return {
    level() {
      analyser.getByteTimeDomainData(samples);
      // Loudness as distance from the 128 midpoint, scaled to 0–1.
      let peak = 0;
      for (const sample of samples) peak = Math.max(peak, Math.abs(sample - 128));
      return peak / 128;
    },

    stop() {
      stopping ??= (async () => {
        if (recorder.state !== 'inactive') recorder.stop();
        await finished;
        for (const track of stream.getTracks()) track.stop();
        await audio.close().catch(() => undefined);
        const type = recorder.mimeType || mimeType || 'audio/mp4';
        return { blob: new Blob(chunks, { type }), mimeType: type.split(';')[0]!.trim() };
      })();
      return stopping;
    },
  };
}
