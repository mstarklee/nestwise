import { IdParam, YearLineResponse, YearParam } from '@nestwise/api-contract';
import { makeMarkYearLineDoneUseCase } from '@/composition/year-plan';
import { requireActor } from '@/http/require-actor';
import { withApiErrors } from '@/http/with-api-errors';

type Context = { params: Promise<{ y: string; id: string }> };

export const POST = withApiErrors(async (request: Request, { params }: Context) => {
  const actor = await requireActor(request);
  const { y, id } = await params;
  YearParam.parse(y);
  const line = await makeMarkYearLineDoneUseCase().execute({ actor, yearLineId: IdParam.parse(id) });
  return Response.json(YearLineResponse.parse({ line }));
});
