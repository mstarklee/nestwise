import { ConfirmCaptureRequest, RecordExpenseResponse } from '@nestwise/api-contract';
import type { IsoDate } from '@nestwise/domain/shared';
import { makeConfirmVoiceEntriesUseCase } from '@/composition/capture';
import { runInBackground } from '@/http/background';
import { perRequest } from '@/http/per-request';
import { requireActor } from '@/http/require-actor';
import { withApiErrors } from '@/http/with-api-errors';
import { sendSpendingAlerts } from '@/orchestration/send-spending-alerts';

/**
 * Turns the checked rows into real expenses. Only the person who spoke the batch may do this, and confirming the
 * same batch twice creates its expenses once (design §8).
 */
export const POST = withApiErrors<{ params: Promise<{ id: string }> }>(async (request, context) => {
  await perRequest();
  const actor = await requireActor(request);
  const { id } = await context.params;
  const { entries } = ConfirmCaptureRequest.parse(await request.json());

  const { created } = await makeConfirmVoiceEntriesUseCase().execute({
    actor,
    batchId: id,
    entries: entries.map((entry) => ({ ...entry, txnDate: entry.txnDate as IsoDate })),
  });

  // Alerts go out after the answer, so confirming never waits on push or email.
  for (const period of new Set(created.filter((t) => t.status === 'confirmed').map((t) => `${t.period.year}-${t.period.month}`))) {
    const [year, month] = period.split('-').map(Number);
    runInBackground('Spending alerts', sendSpendingAlerts(actor.familyId, { year: year!, month: month! }));
  }

  return Response.json({ created: created.map((transaction) => RecordExpenseResponse.parse({ transaction, duplicate: null }).transaction) }, { status: 201 });
});
