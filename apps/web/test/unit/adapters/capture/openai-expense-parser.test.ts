import { CaptureNotUnderstoodError, type ParseContext } from '@nestwise/domain/capture';
import { toIsoDate } from '@nestwise/domain/shared';
import { beforeEach, describe, expect, it } from 'vitest';
import { buildParsePrompt } from '@/adapters/capture/parse-prompt';
import { OpenAiExpenseParser, type PostJson } from '@/adapters/capture/openai-expense-parser';

const TODAY = toIsoDate('2026-11-05');

const context: ParseContext = {
  items: [
    { id: 'item-groceries', name: 'Groceries', group: 'Food & Dining' },
    { id: 'item-nonveg', name: 'Non-veg', group: 'Food & Dining' },
    { id: 'item-misc', name: 'Miscellaneous', group: 'Miscellaneous' },
  ],
  yearLines: [{ id: 'line-bike', name: 'Bike Insurance', plannedMinor: 150000, paidMinor: 0, dueMonth: 11 }],
  today: TODAY,
  currencyCode: 'INR',
  minorUnits: 2,
};

const row = {
  amount_minor: 25000,
  item_id: 'item-groceries',
  year_line_id: null,
  kind: 'expense',
  date: '2026-11-05',
  merchant: 'KPN',
  note: '',
  heard: 'KPN 250',
  confidence: { amount: 0.97, item: 0.94 },
};

const completed = (payload: unknown) => ({
  status: 'completed',
  output: [{ type: 'message', content: [{ type: 'output_text', text: JSON.stringify(payload) }] }],
});

describe('buildParsePrompt', () => {
  it('names every item with its id, so the model can only choose one that exists', () => {
    const { system } = buildParsePrompt(context);
    for (const item of context.items) expect(system).toContain(item.id);
    expect(system).toContain('Groceries');
    expect(system).toContain('Miscellaneous');
  });

  it("names this year's open bill lines", () => {
    const { system } = buildParsePrompt(context);
    expect(system).toContain('line-bike');
    expect(system).toContain('Bike Insurance');
  });

  it("carries today's date and the currency", () => {
    const { system } = buildParsePrompt(context);
    expect(system).toContain('2026-11-05');
    expect(system).toContain('INR');
  });

  it('teaches the Tamil number words', () => {
    const { system } = buildParsePrompt(context);
    for (const word of ['nooru', 'irunooru', 'aayiram']) expect(system.toLowerCase()).toContain(word);
  });

  it('says a quantity is never the amount', () => {
    expect(buildParsePrompt(context).system.toLowerCase()).toContain('quantity');
  });

  it('says a spoken count is only a hint', () => {
    expect(buildParsePrompt(context).system.toLowerCase()).toContain('hint');
  });

  it('forbids inventing an amount', () => {
    expect(buildParsePrompt(context).system.toLowerCase()).toContain('never invent');
  });

  it('builds a strict schema that forbids extra properties', () => {
    const { schema } = buildParsePrompt(context);
    expect(schema).toMatchObject({ type: 'object', additionalProperties: false });
  });
});

describe('OpenAiExpenseParser', () => {
  let calls: { url: string; body: unknown }[];
  let reply: unknown;
  let post: PostJson;
  let parser: OpenAiExpenseParser;

  beforeEach(() => {
    calls = [];
    reply = completed({ expenses: [row] });
    post = async (url, request) => {
      calls.push({ url, body: JSON.parse(request.body) });
      return reply;
    };
    parser = new OpenAiExpenseParser(post, 'gpt-6.1-terra');
  });

  it('asks the responses endpoint for strict structured output from the chosen model', async () => {
    await parser.parse('KPN 250', context);

    expect(calls).toHaveLength(1);
    expect(calls[0]!.url).toContain('/v1/responses');
    expect(calls[0]!.body).toMatchObject({
      model: 'gpt-6.1-terra',
      text: { format: { type: 'json_schema', strict: true } },
    });
  });

  it('sends the transcript as the user message', async () => {
    await parser.parse('KPN 250, chicken boneless 500', context);

    const body = calls[0]!.body as { input: { role: string; content: string }[] };
    expect(body.input.at(-1)).toMatchObject({ role: 'user', content: 'KPN 250, chicken boneless 500' });
  });

  it('maps a row to a ParsedEntry, keeping the amount in minor units', async () => {
    const [entry] = await parser.parse('KPN 250', context);

    expect(entry).toEqual({
      amountMinor: 25000,
      itemId: 'item-groceries',
      yearLineId: null,
      kind: 'expense',
      txnDate: TODAY,
      merchant: 'KPN',
      note: '',
      heard: 'KPN 250',
      confidence: { amount: 0.97, item: 0.94 },
    });
  });

  it('keeps an amount spoken in Tamil words in minor units, and keeps the words it heard', async () => {
    reply = completed({ expenses: [{ ...row, amount_minor: 20000, heard: 'irunooru rubaai', merchant: null }] });

    const [entry] = await parser.parse('irunooru rubaai', context);

    expect(entry!.amountMinor).toBe(20000);
    expect(entry!.heard).toBe('irunooru rubaai');
  });

  it('keeps a spoken quantity in the note instead of the amount', async () => {
    reply = completed({ expenses: [{ ...row, amount_minor: 25000, item_id: 'item-nonveg', note: 'half kg', heard: 'chicken boneless half kg 250' }] });

    const [entry] = await parser.parse('chicken boneless half kg 250', context);

    expect(entry!.amountMinor).toBe(25000);
    expect(entry!.note).toBe('half kg');
  });

  it('returns every row found, even when the speaker announced a different count', async () => {
    reply = completed({ expenses: [row, row, row, row] });

    expect(await parser.parse('three entries today, ...', context)).toHaveLength(4);
  });

  it('maps an unheard amount to null, not zero', async () => {
    reply = completed({ expenses: [{ ...row, amount_minor: null, confidence: { amount: 0.1, item: 0.9 } }] });

    expect((await parser.parse('something mumbled', context))[0]!.amountMinor).toBeNull();
  });

  it('maps a bill row to kind yearly_bill with its year line and no item', async () => {
    reply = completed({
      expenses: [{ ...row, kind: 'yearly_bill', item_id: null, year_line_id: 'line-bike', amount_minor: 150000, heard: 'bike insurance 1500 paid' }],
    });

    const [entry] = await parser.parse('bike insurance 1500 paid', context);

    expect(entry).toMatchObject({ kind: 'yearly_bill', yearLineId: 'line-bike', itemId: null });
  });

  it('refuses an item id the family does not have, rather than trusting it', async () => {
    reply = completed({ expenses: [{ ...row, item_id: 'item-invented' }] });

    const [entry] = await parser.parse('something 250', context);

    expect(entry!.itemId).toBeNull();
    expect(entry!.confidence.item).toBe(0);
  });

  it('refuses a year line the family does not have', async () => {
    reply = completed({ expenses: [{ ...row, kind: 'yearly_bill', item_id: null, year_line_id: 'line-invented' }] });

    const [entry] = await parser.parse('some insurance 250', context);

    expect(entry!.yearLineId).toBeNull();
    expect(entry!.confidence.item).toBe(0);
  });

  it("falls back to today when the model's date is not a real date", async () => {
    reply = completed({ expenses: [{ ...row, date: 'last Tuesday-ish' }] });

    expect((await parser.parse('KPN 250', context))[0]!.txnDate).toBe(TODAY);
  });

  it('returns nothing when the recording held no expenses', async () => {
    reply = completed({ expenses: [] });

    expect(await parser.parse('hello, testing one two', context)).toEqual([]);
  });

  it('throws CaptureNotUnderstoodError on a refusal', async () => {
    reply = { status: 'completed', output: [{ type: 'message', content: [{ type: 'refusal', refusal: 'I cannot help with that' }] }] };

    await expect(parser.parse('KPN 250', context)).rejects.toThrow(CaptureNotUnderstoodError);
  });

  it('throws CaptureNotUnderstoodError when the response was cut short', async () => {
    reply = { status: 'incomplete', incomplete_details: { reason: 'max_output_tokens' }, output: [] };

    await expect(parser.parse('KPN 250', context)).rejects.toThrow(CaptureNotUnderstoodError);
  });

  it('throws CaptureNotUnderstoodError on an unparseable body', async () => {
    reply = { status: 'completed', output: [{ type: 'message', content: [{ type: 'output_text', text: 'not json at all' }] }] };

    await expect(parser.parse('KPN 250', context)).rejects.toThrow(CaptureNotUnderstoodError);
  });

  it('never puts the transcript in the error it throws', async () => {
    reply = { status: 'completed', output: [] };

    await expect(parser.parse('KPN 250 secret words', context)).rejects.toThrow(
      expect.objectContaining({ message: expect.not.stringContaining('secret words') }),
    );
  });
});
