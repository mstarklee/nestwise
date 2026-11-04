import 'server-only';
import type { ParseContext } from '@nestwise/domain/capture';

/**
 * The instructions and the JSON schema behind one parse. The system text is built list-first and rules-second so
 * the long, unchanging part (the family's items) sits at the front as a stable prefix and OpenAI's prompt caching
 * applies (design §12).
 */
export function buildParsePrompt(context: ParseContext): { system: string; schema: Record<string, unknown> } {
  const items = context.items.map((i) => `- ${i.id} | ${i.name} | group: ${i.group}`).join('\n');
  const bills = context.yearLines.length
    ? context.yearLines
        .map((l) => `- ${l.id} | ${l.name} | planned ${l.plannedMinor} | paid so far ${l.paidMinor}${l.dueMonth ? ` | due month ${l.dueMonth}` : ''}`)
        .join('\n')
    : '- (none open)';

  const system = `You turn a spoken note about money already spent into structured entries for one family's budget app.

MONTHLY ITEMS (everyday spending must use one of these ids, exactly as written):
${items}

THIS YEAR'S OPEN BILLS (a bill payment must use one of these ids, exactly as written):
${bills}

Today is ${context.today}. The currency is ${context.currencyCode} and amounts are whole minor units (${context.minorUnits} decimal places), so 250 rupees is 25000.

RULES
1. Amounts are always in this currency. The speaker never says the currency name, and you never ask for it.
2. The speaker may use Tamil, English, or both in one sentence, in Tamil script or romanised. Understand Tamil number words: nooru = 100, irunooru = 200, munooru = 300, aayiram = 1000. "irunooru rubaai" is 200 rupees, so amount_minor 20000.
3. Never invent an amount. If you did not clearly hear a number, set amount_minor to null and set confidence.amount low. Never guess, never round, never carry an amount over from another entry.
4. A quantity is never the amount. In "chicken boneless half kg 250" the amount is 250 and "half kg" belongs in note. Weights, counts and sizes go in note.
5. A count the speaker announces is only a hint. If they say "three entries" and you hear four, return four.
6. One recording may hold several entries. Return one object per purchase, in the order spoken.
7. Everyday spending uses kind "expense" with an item_id and year_line_id null. A payment of one of this year's bills uses kind "yearly_bill" with a year_line_id and item_id null. Say "paid" or naming a bill means a bill payment.
8. If spending matches no item, use the Miscellaneous item if there is one, and set confidence.item low so a person checks it. Never choose an id that is not listed above.
9. date is YYYY-MM-DD and defaults to today. Understand "yesterday" and a weekday. Never invent a date you did not hear.
10. merchant is the shop if one was named, otherwise null. heard is the speaker's own words for this entry.
11. confidence.amount and confidence.item are 0 to 1: how sure you are of that field alone.`;

  const schema: Record<string, unknown> = {
    type: 'object',
    additionalProperties: false,
    required: ['expenses'],
    properties: {
      expenses: {
        type: 'array',
        items: {
          type: 'object',
          additionalProperties: false,
          required: ['amount_minor', 'item_id', 'year_line_id', 'kind', 'date', 'merchant', 'note', 'heard', 'confidence'],
          properties: {
            amount_minor: { type: ['integer', 'null'], description: 'Whole minor units, or null if not clearly heard' },
            item_id: { type: ['string', 'null'] },
            year_line_id: { type: ['string', 'null'] },
            kind: { type: 'string', enum: ['expense', 'yearly_bill'] },
            date: { type: 'string', description: 'YYYY-MM-DD' },
            merchant: { type: ['string', 'null'] },
            note: { type: 'string' },
            heard: { type: 'string' },
            confidence: {
              type: 'object',
              additionalProperties: false,
              required: ['amount', 'item'],
              properties: { amount: { type: 'number' }, item: { type: 'number' } },
            },
          },
        },
      },
    },
  };

  return { system, schema };
}
