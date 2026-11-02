import { ListExpensesQuery, RecordExpenseRequest, TransactionListResponse, TransactionResponse } from '@nestwise/api-contract';
import type { IsoDate } from '@nestwise/domain/shared';
import { makeListExpensesUseCase, makeRecordExpenseUseCase } from '@/composition/expenses';
import { perRequest } from '@/http/per-request';
import { requireActor } from '@/http/require-actor';
import { withApiErrors } from '@/http/with-api-errors';

export const GET = withApiErrors(async (request: Request) => {
  await perRequest();
  const actor = await requireActor(request);
  const query = ListExpensesQuery.parse(Object.fromEntries(new URL(request.url).searchParams));
  const transactions = await makeListExpensesUseCase().execute({ actor, period: query.month, itemId: query.itemId, enteredBy: query.enteredBy });
  return Response.json(TransactionListResponse.parse({ transactions }));
});

/** 201 for a new expense, 200 when the same id was already saved (a resend). The date defaults to today in the family's zone. */
export const POST = withApiErrors(async (request: Request) => {
  const actor = await requireActor(request);
  const { txnDate, ...body } = RecordExpenseRequest.parse(await request.json());
  const { transaction, created } = await makeRecordExpenseUseCase().execute({
    ...body,
    actor,
    ...(txnDate === undefined ? {} : { txnDate: txnDate as IsoDate }),
  });
  return Response.json(TransactionResponse.parse({ transaction }), { status: created ? 201 : 200 });
});
