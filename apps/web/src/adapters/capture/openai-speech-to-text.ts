import 'server-only';
import { CaptureNotUnderstoodError, type SpeechToText } from '@nestwise/domain/capture';
import type { PostForm } from './post-form';

const TRANSCRIPTIONS_URL = 'https://api.openai.com/v1/audio/transcriptions';

/** The current recommended transcription model. The gpt-4o transcribe models are deprecated (design §3.1). */
const MODEL = 'gpt-transcribe';

/**
 * Speech to text through OpenAI. `languages` is sent as a repeated field, which is what lets one recording be
 * declared as Tamil *and* English — the way this family actually speaks.
 */
export class OpenAiSpeechToText implements SpeechToText {
  constructor(private readonly post: PostForm) {}

  async transcribe(audio: Uint8Array, mimeType: string, options: { readonly languages: readonly string[] }) {
    const form = new FormData();
    form.set('file', new Blob([audio as BlobPart], { type: mimeType }), 'recording');
    form.set('model', MODEL);
    for (const language of options.languages) form.append('languages', language);

    let reply: unknown;
    try {
      reply = await this.post(TRANSCRIPTIONS_URL, { headers: {}, form });
    } catch (cause) {
      throw new CaptureNotUnderstoodError("Couldn't hear that recording", { cause });
    }

    const text = readText(reply);
    return { text, model: MODEL, seconds: readSeconds(reply) };
  }
}

function readText(reply: unknown): string {
  const text = isRecord(reply) && typeof reply.text === 'string' ? reply.text.trim() : '';
  if (text === '') throw new CaptureNotUnderstoodError("Couldn't hear anything in that recording");
  return text;
}

/** Only present when the account is billed by audio duration; zero when it is billed by token. */
function readSeconds(reply: unknown): number {
  if (!isRecord(reply) || !isRecord(reply.usage)) return 0;
  const { seconds } = reply.usage;
  return typeof seconds === 'number' && Number.isFinite(seconds) && seconds > 0 ? seconds : 0;
}

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null;
