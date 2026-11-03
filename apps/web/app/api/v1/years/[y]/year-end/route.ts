import { YearEndReviewResponse, YearParam } from '@nestwise/api-contract';
import { makeGetYearEndReviewUseCase } from '@/composition/year-plan';
import { perRequest } from '@/http/per-request';
import { requireActor } from '@/http/require-actor';
import { withApiErrors } from '@/http/with-api-errors';

type Context = { params: Promise<{ y: string }> };

/** Last year's yearly bills still open with something left to pay (PRD §5.3). */
export const GET = withApiErrors(async (request: Request, { params }: Context) => {
  await perRequest();
  const actor = await requireActor(request);
  const year = YearParam.parse((await params).y);
  return Response.json(YearEndReviewResponse.parse(await makeGetYearEndReviewUseCase().execute({ actor, year })));
});
