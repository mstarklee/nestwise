import { IdParam, YearEndAnswerRequest, YearLineResponse, YearParam } from '@nestwise/api-contract';
import { makeAnswerYearEndLineUseCase } from '@/composition/year-plan';
import { requireActor } from '@/http/require-actor';
import { withApiErrors } from '@/http/with-api-errors';

type Context = { params: Promise<{ y: string; id: string }> };

/** Done, drop, or carry into the next year (Admin). 409 if it was already answered. */
export const POST = withApiErrors(async (request: Request, { params }: Context) => {
  const actor = await requireActor(request);
  const { y, id } = await params;
  const answer = YearEndAnswerRequest.parse(await request.json());
  const line = await makeAnswerYearEndLineUseCase().execute({ actor, year: YearParam.parse(y), lineId: IdParam.parse(id), answer });
  return Response.json(YearLineResponse.parse({ line }));
});
