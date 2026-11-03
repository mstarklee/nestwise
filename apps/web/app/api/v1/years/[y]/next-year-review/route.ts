import { NextYearReviewResponse, YearParam } from '@nestwise/api-contract';
import { makeConfirmNextYearReviewUseCase, makeGetNextYearReviewUseCase } from '@/composition/year-plan';
import { perRequest } from '@/http/per-request';
import { requireActor } from '@/http/require-actor';
import { withApiErrors } from '@/http/with-api-errors';

type Context = { params: Promise<{ y: string }> };

/** Next year's bills for the 1 December review, and whether they were confirmed. */
export const GET = withApiErrors(async (request: Request, { params }: Context) => {
  await perRequest();
  const actor = await requireActor(request);
  const year = YearParam.parse((await params).y);
  return Response.json(NextYearReviewResponse.parse(await makeGetNextYearReviewUseCase().execute({ actor, year })));
});

/** "Looks right" (Admin): 204, also when it was already confirmed. */
export const POST = withApiErrors(async (request: Request, { params }: Context) => {
  const actor = await requireActor(request);
  const year = YearParam.parse((await params).y);
  await makeConfirmNextYearReviewUseCase().execute({ actor, year });
  return new Response(null, { status: 204 });
});
