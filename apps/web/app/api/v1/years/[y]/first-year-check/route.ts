import { FirstYearCheckRequest, YearParam, YearPlanLinesResponse } from '@nestwise/api-contract';
import { makeApplyFirstYearCheckUseCase } from '@/composition/year-plan';
import { requireActor } from '@/http/require-actor';
import { withApiErrors } from '@/http/with-api-errors';

type Context = { params: Promise<{ y: string }> };

export const POST = withApiErrors(async (request: Request, { params }: Context) => {
  const actor = await requireActor(request);
  const year = YearParam.parse((await params).y);
  const body = FirstYearCheckRequest.parse(await request.json());
  const plan = await makeApplyFirstYearCheckUseCase().execute({
    actor,
    year,
    stillToComeLineIds: body.stillToComeLineIds,
    setupPeriod: body.setupMonth,
  });
  return Response.json(YearPlanLinesResponse.parse(plan));
});
