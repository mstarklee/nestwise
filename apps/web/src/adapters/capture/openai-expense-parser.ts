import 'server-only';
import { CaptureNotUnderstoodError, type ExpenseParser, type ParsedEntry, type ParseContext } from '@nestwise/domain/capture';
import { toIsoDate } from '@nestwise/domain/shared';
import { buildParsePrompt } from './parse-prompt';

const RESPONSES_URL = 'https://api.openai.com/v1/responses';

/** The one HTTP call this adapter makes, injected so tests need no key and no network. */
export type PostJson = (url: string, request: { headers: Readonly<Record<string, string>>; body: string }) => Promise<unknown>;

/** Builds the real caller. Keeps the key here, so the adapter itself never sees one. */
export function makePostJson(headers: Readonly<Record<string, string>>): PostJson {
  return async (url, request) => {
    const response = await fetch(url, { method: 'POST', headers: { ...headers, ...request.headers }, body: request.body });
    if (!response.ok) throw new Error(`parse service replied ${response.status}`);
    return response.json();
  };
}

type Row = {
  amount_minor: unknown;
  item_id: unknown;
  year_line_id: unknown;
  kind: unknown;
  date: unknown;
  merchant: unknown;
  note: unknown;
  heard: unknown;
  confidence: unknown;
};

/** One message for the person; it never carries the transcript or anything else they said (design §9). */
const unreadable = () => new CaptureNotUnderstoodError("Couldn't read that recording");

/** Turns a transcript into entries with OpenAI structured outputs. The model comes from `AI_MODEL`. */
export class OpenAiExpenseParser implements ExpenseParser {
  constructor(
    private readonly post: PostJson,
    readonly model: string,
  ) {}

  async parse(transcript: string, context: ParseContext): Promise<readonly ParsedEntry[]> {
    const { system, schema } = buildParsePrompt(context);
    const body = JSON.stringify({
      model: this.model,
      input: [
        { role: 'system', content: system },
        { role: 'user', content: transcript },
      ],
      text: { format: { type: 'json_schema', name: 'nestwise_expenses', schema, strict: true } },
    });

    let reply: unknown;
    try {
      reply = await this.post(RESPONSES_URL, { headers: { 'content-type': 'application/json' }, body });
    } catch (cause) {
      throw new CaptureNotUnderstoodError("Couldn't read that recording", { cause });
    }

    return readRows(reply).map((row) => toEntry(row, context));
  }
}

/** Pulls the model's JSON out of a Responses envelope, refusing anything that is not a clean, complete answer. */
function readRows(reply: unknown): Row[] {
  if (!isRecord(reply)) throw unreadable();
  if (reply.status === 'incomplete') throw unreadable();

  const output = Array.isArray(reply.output) ? reply.output : [];
  const message = output.find((item) => isRecord(item) && item.type === 'message');
  if (!isRecord(message)) throw unreadable();

  const parts = Array.isArray(message.content) ? message.content : [];
  if (parts.some((part) => isRecord(part) && part.type === 'refusal')) throw unreadable();

  const text = parts.find((part) => isRecord(part) && part.type === 'output_text');
  if (!isRecord(text) || typeof text.text !== 'string') throw unreadable();

  let payload: unknown;
  try {
    payload = JSON.parse(text.text);
  } catch {
    throw unreadable();
  }
  if (!isRecord(payload) || !Array.isArray(payload.expenses)) throw unreadable();
  return payload.expenses as Row[];
}

/**
 * One row, trusted only as far as it can be checked. An id the family does not have is dropped rather than passed
 * on, with its confidence zeroed so the review screen asks instead of quietly putting money somewhere wrong.
 */
function toEntry(row: Row, context: ParseContext): ParsedEntry {
  const kind = row.kind === 'yearly_bill' ? 'yearly_bill' : 'expense';

  const namedItem = typeof row.item_id === 'string' ? row.item_id : null;
  const itemId = namedItem !== null && context.items.some((i) => i.id === namedItem) ? namedItem : null;
  const namedLine = typeof row.year_line_id === 'string' ? row.year_line_id : null;
  const yearLineId = namedLine !== null && context.yearLines.some((l) => l.id === namedLine) ? namedLine : null;
  const invented = (namedItem !== null && itemId === null) || (namedLine !== null && yearLineId === null);

  const confidence = isRecord(row.confidence) ? row.confidence : {};
  const amountMinor = typeof row.amount_minor === 'number' && Number.isInteger(row.amount_minor) && row.amount_minor > 0 ? row.amount_minor : null;

  return {
    amountMinor,
    itemId,
    yearLineId,
    kind,
    txnDate: readDate(row.date) ?? context.today,
    merchant: typeof row.merchant === 'string' && row.merchant.trim() !== '' ? row.merchant : null,
    note: typeof row.note === 'string' ? row.note : '',
    heard: typeof row.heard === 'string' ? row.heard : '',
    confidence: {
      amount: amountMinor === null ? 0 : clamp(confidence.amount),
      item: invented ? 0 : clamp(confidence.item),
    },
  };
}

function readDate(value: unknown) {
  if (typeof value !== 'string') return null;
  try {
    return toIsoDate(value);
  } catch {
    return null;
  }
}

const clamp = (value: unknown) => (typeof value === 'number' && Number.isFinite(value) ? Math.min(Math.max(value, 0), 1) : 0);

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null;
