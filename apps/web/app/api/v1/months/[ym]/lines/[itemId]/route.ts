import { IdParam, MonthLineResponse, MonthParam, SetMonthLineRequest } from '@nestwise/api-contract';
import { makeSetMonthLineUseCase } from '@/composition/month-budget';
import { requireActor } from '@/http/require-actor';
import { withApiErrors } from '@/http/with-api-errors';

type Context = { params: Promise<{ ym: string; itemId: string }> };

export const PUT = withApiErrors(async (request: Request, { params }: Context) => {
  const actor = await requireActor(request);
  const { ym, itemId } = await params;
  const { plannedMinor } = SetMonthLineRequest.parse(await request.json());
  const line = await makeSetMonthLineUseCase().execute({ actor, period: MonthParam.parse(ym), itemId: IdParam.parse(itemId), plannedMinor });
  return Response.json(MonthLineResponse.parse({ line }));
});
