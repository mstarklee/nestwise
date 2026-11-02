import { EditExpenseRequest, IdParam, TransactionResponse } from '@nestwise/api-contract';
import type { IsoDate } from '@nestwise/domain/shared';
import { makeDeleteExpenseUseCase, makeEditExpenseUseCase } from '@/composition/expenses';
import { requireActor } from '@/http/require-actor';
import { withApiErrors } from '@/http/with-api-errors';

type Context = { params: Promise<{ id: string }> };

export const PATCH = withApiErrors(async (request: Request, { params }: Context) => {
  const actor = await requireActor(request);
  const id = IdParam.parse((await params).id);
  const { txnDate, ...changes } = EditExpenseRequest.parse(await request.json());
  const transaction = await makeEditExpenseUseCase().execute({
    actor,
    id,
    changes: { ...changes, ...(txnDate === undefined ? {} : { txnDate: txnDate as IsoDate }) },
  });
  return Response.json(TransactionResponse.parse({ transaction }));
});

export const DELETE = withApiErrors(async (request: Request, { params }: Context) => {
  const actor = await requireActor(request);
  const id = IdParam.parse((await params).id);
  const transaction = await makeDeleteExpenseUseCase().execute({ actor, id });
  return Response.json(TransactionResponse.parse({ transaction }));
});
