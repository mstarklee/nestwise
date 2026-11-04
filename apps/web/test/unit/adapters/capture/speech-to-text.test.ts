import { CaptureNotUnderstoodError } from '@nestwise/domain/capture';
import { beforeEach, describe, expect, it } from 'vitest';
import { maxClipSeconds } from '@/capture/clip-limits';
import { OpenAiSpeechToText } from '@/adapters/capture/openai-speech-to-text';
import { SarvamSpeechToText } from '@/adapters/capture/sarvam-speech-to-text';
import type { PostForm } from '@/adapters/capture/post-form';

const AUDIO = new Uint8Array([1, 2, 3, 4, 5]);
const MIME = 'audio/mp4';
const BOTH = { languages: ['ta', 'en'] };

type Call = { url: string; headers: Readonly<Record<string, string>>; form: FormData };

function recorder(reply: unknown): { post: PostForm; calls: Call[] } {
  const calls: Call[] = [];
  const post: PostForm = async (url, request) => {
    calls.push({ url, headers: request.headers, form: request.form });
    if (reply instanceof Error) throw reply;
    return reply;
  };
  return { post, calls };
}

describe('maxClipSeconds', () => {
  it('allows a minute on OpenAI', () => {
    expect(maxClipSeconds('openai')).toBe(60);
  });

  it('allows half a minute on Sarvam, whose quick endpoint stops there', () => {
    expect(maxClipSeconds('sarvam')).toBe(30);
  });
});

describe('OpenAiSpeechToText', () => {
  let calls: Call[];
  let adapter: OpenAiSpeechToText;

  beforeEach(() => {
    const r = recorder({ text: 'KPN 250', languages: [{ code: 'en' }], usage: { type: 'duration', seconds: 14 } });
    calls = r.calls;
    adapter = new OpenAiSpeechToText(r.post);
  });

  it('asks gpt-transcribe for the transcription', async () => {
    await adapter.transcribe(AUDIO, MIME, BOTH);

    expect(calls[0]!.url).toContain('/v1/audio/transcriptions');
    expect(calls[0]!.form.get('model')).toBe('gpt-transcribe');
  });

  it('declares both languages, so Tamil and English in one sentence are expected', async () => {
    await adapter.transcribe(AUDIO, MIME, BOTH);

    expect(calls[0]!.form.getAll('languages')).toEqual(['ta', 'en']);
  });

  it('sends the audio as the file part', async () => {
    await adapter.transcribe(AUDIO, MIME, BOTH);

    const file = calls[0]!.form.get('file');
    expect(file).toBeInstanceOf(Blob);
    expect((file as Blob).size).toBe(AUDIO.byteLength);
  });

  it('returns the text, the model and the billed seconds', async () => {
    expect(await adapter.transcribe(AUDIO, MIME, BOTH)).toEqual({ text: 'KPN 250', model: 'gpt-transcribe', seconds: 14 });
  });

  it('reports zero seconds when the service bills by token instead of duration', async () => {
    const r = recorder({ text: 'KPN 250', usage: { type: 'tokens', input_tokens: 10, output_tokens: 4 } });

    expect((await new OpenAiSpeechToText(r.post).transcribe(AUDIO, MIME, BOTH)).seconds).toBe(0);
  });

  it('throws CaptureNotUnderstoodError when nothing was heard', async () => {
    const r = recorder({ text: '   ' });

    await expect(new OpenAiSpeechToText(r.post).transcribe(AUDIO, MIME, BOTH)).rejects.toThrow(CaptureNotUnderstoodError);
  });

  it('throws CaptureNotUnderstoodError when the service fails, saying nothing about the audio', async () => {
    const r = recorder(new Error('502 upstream: body 0102030405'));

    await expect(new OpenAiSpeechToText(r.post).transcribe(AUDIO, MIME, BOTH)).rejects.toThrow(
      expect.objectContaining({ message: expect.not.stringContaining('0102030405') }),
    );
  });

  it('keeps no copy of the audio once it has returned', async () => {
    await adapter.transcribe(AUDIO, MIME, BOTH);

    expect(Object.values(adapter).some((v) => v instanceof Uint8Array || v instanceof Blob)).toBe(false);
  });
});

describe('SarvamSpeechToText', () => {
  let calls: Call[];
  let adapter: SarvamSpeechToText;

  beforeEach(() => {
    const r = recorder({ request_id: 'r1', transcript: 'KPN 250', language_code: 'ta-IN' });
    calls = r.calls;
    adapter = new SarvamSpeechToText(r.post, 'saaras:v4');
  });

  it('asks Saaras for the transcription', async () => {
    await adapter.transcribe(AUDIO, MIME, BOTH);

    expect(calls[0]!.url).toContain('api.sarvam.ai/speech-to-text');
    expect(calls[0]!.form.get('model')).toBe('saaras:v4');
  });

  it('lets Saaras detect the language when more than one is expected', async () => {
    await adapter.transcribe(AUDIO, MIME, BOTH);

    expect(calls[0]!.form.get('language_code')).toBe('unknown');
  });

  it('names the language in BCP-47 when only one is expected', async () => {
    await adapter.transcribe(AUDIO, MIME, { languages: ['ta'] });

    expect(calls[0]!.form.get('language_code')).toBe('ta-IN');
  });

  it('returns the transcript and the model version it ran against', async () => {
    expect(await adapter.transcribe(AUDIO, MIME, BOTH)).toEqual({ text: 'KPN 250', model: 'saaras:v4', seconds: 0 });
  });

  it('throws CaptureNotUnderstoodError when nothing was heard', async () => {
    const r = recorder({ transcript: '' });

    await expect(new SarvamSpeechToText(r.post, 'saaras:v4').transcribe(AUDIO, MIME, BOTH)).rejects.toThrow(CaptureNotUnderstoodError);
  });

  it('throws CaptureNotUnderstoodError when the service fails, saying nothing about the audio', async () => {
    const r = recorder(new Error('500: 0102030405'));

    await expect(new SarvamSpeechToText(r.post, 'saaras:v4').transcribe(AUDIO, MIME, BOTH)).rejects.toThrow(
      expect.objectContaining({ message: expect.not.stringContaining('0102030405') }),
    );
  });

  it('keeps no copy of the audio once it has returned', async () => {
    await adapter.transcribe(AUDIO, MIME, BOTH);

    expect(Object.values(adapter).some((v) => v instanceof Uint8Array || v instanceof Blob)).toBe(false);
  });
});
