import { IdParam, SetYearLineAmountRequest, YearLineResponse, YearParam } from '@nestwise/api-contract';
import { makeSetYearLineAmountUseCase } from '@/composition/year-plan';
import { requireActor } from '@/http/require-actor';
import { withApiErrors } from '@/http/with-api-errors';

type Context = { params: Promise<{ y: string; id: string }> };

/** Changes one open line's amount in that year's plan only (Admin). */
export const PUT = withApiErrors(async (request: Request, { params }: Context) => {
  const actor = await requireActor(request);
  const { y, id } = await params;
  YearParam.parse(y);
  const { plannedMinor } = SetYearLineAmountRequest.parse(await request.json());
  const line = await makeSetYearLineAmountUseCase().execute({ actor, lineId: IdParam.parse(id), plannedMinor });
  return Response.json(YearLineResponse.parse({ line }));
});
