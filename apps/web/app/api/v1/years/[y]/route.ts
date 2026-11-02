import { YearParam, YearPlanResponse } from '@nestwise/api-contract';
import { makeGetYearPlanUseCase } from '@/composition/year-plan';
import { perRequest } from '@/http/per-request';
import { requireActor } from '@/http/require-actor';
import { withApiErrors } from '@/http/with-api-errors';

type Context = { params: Promise<{ y: string }> };

export const GET = withApiErrors(async (request: Request, { params }: Context) => {
  await perRequest();
  const actor = await requireActor(request);
  const year = YearParam.parse((await params).y);
  const view = await makeGetYearPlanUseCase().execute({ actor, year });
  return Response.json(YearPlanResponse.parse(view));
});
