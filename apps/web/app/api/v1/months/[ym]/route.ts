import { MonthParam, MonthSummaryResponse } from '@nestwise/api-contract';
import { makeGetMonthSummaryUseCase } from '@/composition/month-budget';
import { perRequest } from '@/http/per-request';
import { requireActor } from '@/http/require-actor';
import { withApiErrors } from '@/http/with-api-errors';

type Context = { params: Promise<{ ym: string }> };

export const GET = withApiErrors(async (request: Request, { params }: Context) => {
  await perRequest();
  const actor = await requireActor(request);
  const period = MonthParam.parse((await params).ym);
  const summary = await makeGetMonthSummaryUseCase().execute({ actor, period });
  return Response.json(MonthSummaryResponse.parse(summary));
});
