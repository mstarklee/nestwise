import { IdParam, TransactionResponse } from '@nestwise/api-contract';
import { makeRestoreExpenseUseCase } from '@/composition/expenses';
import { requireActor } from '@/http/require-actor';
import { withApiErrors } from '@/http/with-api-errors';

type Context = { params: Promise<{ id: string }> };

export const POST = withApiErrors(async (request: Request, { params }: Context) => {
  const actor = await requireActor(request);
  const id = IdParam.parse((await params).id);
  const transaction = await makeRestoreExpenseUseCase().execute({ actor, id });
  return Response.json(TransactionResponse.parse({ transaction }));
});
