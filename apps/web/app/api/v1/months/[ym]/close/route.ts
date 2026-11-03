import { MonthParam } from '@nestwise/api-contract';
import { makeCloseMonthUseCase } from '@/composition/month-budget';
import { requireActor } from '@/http/require-actor';
import { withApiErrors } from '@/http/with-api-errors';

type Context = { params: Promise<{ ym: string }> };

/** "Close October" (Admin): 204; 409 if it is already closed. */
export const POST = withApiErrors(async (request: Request, { params }: Context) => {
  const actor = await requireActor(request);
  const period = MonthParam.parse((await params).ym);
  await makeCloseMonthUseCase().execute({ actor, period });
  return new Response(null, { status: 204 });
});
