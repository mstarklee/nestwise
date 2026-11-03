import { MonthParam, MonthReviewResponse } from '@nestwise/api-contract';
import { makeGetMonthReviewUseCase } from '@/composition/month-review';
import { perRequest } from '@/http/per-request';
import { requireActor } from '@/http/require-actor';
import { withApiErrors } from '@/http/with-api-errors';

type Context = { params: Promise<{ ym: string }> };

/** The month-end review (PRD §6.12). */
export const GET = withApiErrors(async (request: Request, { params }: Context) => {
  await perRequest();
  const actor = await requireActor(request);
  const period = MonthParam.parse((await params).ym);
  const review = await makeGetMonthReviewUseCase().execute({ actor, period });
  return Response.json(MonthReviewResponse.parse(review));
});
