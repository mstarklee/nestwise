import { ListExpensesQuery, RecordExpenseRequest, RecordExpenseResponse, TransactionListResponse } from '@nestwise/api-contract';
import type { IsoDate } from '@nestwise/domain/shared';
import { makeListExpensesUseCase, makeRecordExpenseUseCase } from '@/composition/expenses';
import { perRequest } from '@/http/per-request';
import { requireActor } from '@/http/require-actor';
import { runInBackground } from '@/http/background';
import { withApiErrors } from '@/http/with-api-errors';
import { sendSpendingAlerts } from '@/orchestration/send-spending-alerts';

export const GET = withApiErrors(async (request: Request) => {
  await perRequest();
  const actor = await requireActor(request);
  const query = ListExpensesQuery.parse(Object.fromEntries(new URL(request.url).searchParams));
  const transactions = await makeListExpensesUseCase().execute({
    actor,
    period: query.month,
    itemId: query.itemId,
    enteredBy: query.enteredBy,
    paidBy: query.paidBy,
    captureMethod: query.method,
  });
  return Response.json(TransactionListResponse.parse({ transactions }));
});

/**
 * 201 for a new expense, 200 when the same id was already saved (a resend). The date defaults to today in the family's
 * zone. When it may repeat another expense, it is saved as pending and `duplicate` carries the question.
 */
export const POST = withApiErrors(async (request: Request) => {
  const actor = await requireActor(request);
  const { txnDate, ...body } = RecordExpenseRequest.parse(await request.json());
  const { transaction, created, duplicate } = await makeRecordExpenseUseCase().execute({
    ...body,
    actor,
    ...(txnDate === undefined ? {} : { txnDate: txnDate as IsoDate }),
  });
  // Spending alerts go out after the answer, so saving never waits on push or email.
  if (created && transaction.status === 'confirmed') runInBackground('Spending alerts', sendSpendingAlerts(actor.familyId, transaction.period));
  return Response.json(RecordExpenseResponse.parse({ transaction, duplicate }), { status: created ? 201 : 200 });
});
