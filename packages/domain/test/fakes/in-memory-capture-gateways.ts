import type { CaptureBatch, CaptureGateway, ExpenseParser, ParsedEntry, ParseContext, SpeechToText, UsageGateway } from '../../src/capture';
import type { Period } from '../../src/shared';

export class InMemoryCaptureGateway implements CaptureGateway {
  rows = new Map<string, CaptureBatch>();

  async create(batch: CaptureBatch) {
    this.rows.set(batch.id, batch);
  }
  async find(familyId: string, id: string) {
    const batch = this.rows.get(id);
    return batch?.familyId === familyId ? batch : undefined;
  }
  async listWaiting(familyId: string) {
    return [...this.rows.values()]
      .filter((b) => b.familyId === familyId && b.resolvedAt === null)
      .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime() || a.id.localeCompare(b.id));
  }
  async resolve(familyId: string, id: string, at: Date) {
    const batch = this.rows.get(id);
    if (batch?.familyId !== familyId || batch.resolvedAt !== null) return false;
    this.rows.set(id, { ...batch, resolvedAt: at });
    return true;
  }
  all() {
    return [...this.rows.values()];
  }
}

const key = (familyId: string, period: Period) => `${familyId}:${period.year}-${period.month}`;

export class InMemoryUsageGateway implements UsageGateway {
  rows = new Map<string, { voiceCount: number; voiceSeconds: number }>();

  set(familyId: string, period: Period, voiceCount: number, voiceSeconds = 0) {
    this.rows.set(key(familyId, period), { voiceCount, voiceSeconds });
  }
  async countThisMonth(familyId: string, period: Period) {
    return this.rows.get(key(familyId, period)) ?? { voiceCount: 0, voiceSeconds: 0 };
  }
  async record(familyId: string, period: Period, seconds: number) {
    const now = this.rows.get(key(familyId, period)) ?? { voiceCount: 0, voiceSeconds: 0 };
    this.rows.set(key(familyId, period), { voiceCount: now.voiceCount + 1, voiceSeconds: now.voiceSeconds + seconds });
  }
}

/** A speech service that returns what the test tells it to, and records what it was handed. */
export class FakeSpeechToText implements SpeechToText {
  calls: { mimeType: string; languages: readonly string[]; bytes: number }[] = [];

  constructor(
    private readonly result: { text: string; model?: string; seconds?: number } | Error = { text: 'KPN 250' },
  ) {}

  async transcribe(audio: Uint8Array, mimeType: string, options: { readonly languages: readonly string[] }) {
    this.calls.push({ mimeType, languages: options.languages, bytes: audio.byteLength });
    if (this.result instanceof Error) throw this.result;
    return { text: this.result.text, model: this.result.model ?? 'fake-stt', seconds: this.result.seconds ?? 12 };
  }
}

/** A parse that returns what the test tells it to, and records the context it was given. */
export class FakeExpenseParser implements ExpenseParser {
  contexts: ParseContext[] = [];
  transcripts: string[] = [];

  constructor(
    private readonly result: readonly ParsedEntry[] | Error = [],
    readonly model = 'fake-parser',
  ) {}

  async parse(transcript: string, context: ParseContext) {
    this.transcripts.push(transcript);
    this.contexts.push(context);
    if (this.result instanceof Error) throw this.result;
    return this.result;
  }

  get lastContext() {
    return this.contexts.at(-1)!;
  }
}
