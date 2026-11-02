import { IdParam, SetYearLineScheduleRequest, YearLineResponse, YearParam } from '@nestwise/api-contract';
import { makeSetYearLineScheduleUseCase } from '@/composition/year-plan';
import { requireActor } from '@/http/require-actor';
import { withApiErrors } from '@/http/with-api-errors';

type Context = { params: Promise<{ y: string; id: string }> };

export const PUT = withApiErrors(async (request: Request, { params }: Context) => {
  const actor = await requireActor(request);
  const { y, id } = await params;
  YearParam.parse(y);
  const { dueMonth, dueDay } = SetYearLineScheduleRequest.parse(await request.json());
  const line = await makeSetYearLineScheduleUseCase().execute({ actor, yearLineId: IdParam.parse(id), dueMonth, dueDay });
  return Response.json(YearLineResponse.parse({ line }));
});
