import { ApiError } from './api-client';
import { type OutboxBody, outbox } from './outbox';

export type SavedExpense = {
  /** The server's answer, or undefined when the expense is waiting on the phone (no signal). */
  response: unknown;
  /** True when it is still on the phone, waiting to send. */
  onPhone: boolean;
};

/**
 * Every new expense goes to the phone's outbox first, then to the server: one path, signal or not (TRD §8.2).
 * A refusal the person can fix (a bad amount, a closed item) is taken back out of the outbox and thrown as an
 * ApiError, so the screen can say why and keep what they typed.
 */
export async function saveExpense(userId: string, body: OutboxBody): Promise<SavedExpense> {
  const box = outbox(userId);
  await box.add(body);
  let result = await box.flush();
  // A send already under way may have started before this entry was added; one more pass picks it up.
  if (!result.responses.has(body.id)) result = await box.flush();
  const entry = (await box.list()).find((e) => e.id === body.id);
  if (entry?.state === 'failed') {
    await box.discard(body.id);
    throw new ApiError(entry.error?.status ?? 0, entry.error?.code ?? 'ServerError', '');
  }
  return { response: result.responses.get(body.id), onPhone: entry !== undefined };
}
