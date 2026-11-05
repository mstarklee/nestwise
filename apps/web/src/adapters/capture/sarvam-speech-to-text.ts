import 'server-only';
import { CaptureNotUnderstoodError, type SpeechToText } from '@nestwise/domain/capture';
import type { PostForm } from './post-form';

const SPEECH_TO_TEXT_URL = 'https://api.sarvam.ai/speech-to-text';

/** Our ISO-639-1 codes in the port's terms, to the BCP-47 codes Sarvam names. */
const BCP47: Readonly<Record<string, string>> = { ta: 'ta-IN', en: 'en-IN', hi: 'hi-IN' };

/**
 * Speech to text through Sarvam's Saaras, the candidate expected to be strongest on Tamil (design §3).
 *
 * Saaras takes **one** `language_code`, not a list. So a recording that may be Tamil or English — which is most of
 * them here — is sent as `unknown` and left to Saaras to detect; naming one language would be a guess that costs
 * accuracy on the other.
 */
export class SarvamSpeechToText implements SpeechToText {
  constructor(
    private readonly post: PostForm,
    private readonly model: string,
  ) {}

  async transcribe(audio: Uint8Array, mimeType: string, options: { readonly languages: readonly string[] }) {
    const form = new FormData();
    form.set('file', new Blob([audio as BlobPart], { type: mimeType }), 'recording');
    form.set('model', this.model);
    form.set('language_code', languageCode(options.languages));

    let reply: unknown;
    try {
      reply = await this.post(SPEECH_TO_TEXT_URL, { headers: {}, form });
    } catch (cause) {
      throw new CaptureNotUnderstoodError("Couldn't hear that recording", { cause });
    }

    const text = isRecord(reply) && typeof reply.transcript === 'string' ? reply.transcript.trim() : '';
    if (text === '') throw new CaptureNotUnderstoodError("Couldn't hear anything in that recording");
    return { text, model: this.model, seconds: 0 };
  }
}

function languageCode(languages: readonly string[]): string {
  if (languages.length !== 1) return 'unknown';
  return BCP47[languages[0]!] ?? 'unknown';
}

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null;
