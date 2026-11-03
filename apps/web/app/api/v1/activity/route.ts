import { ActivityQuery, ActivityResponse } from '@nestwise/api-contract';
import { makeListActivityUseCase } from '@/composition/activity';
import { perRequest } from '@/http/per-request';
import { requireActor } from '@/http/require-actor';
import { withApiErrors } from '@/http/with-api-errors';

/** The family's activity history, newest first; pass `before` = the previous page's nextBefore. */
export const GET = withApiErrors(async (request: Request) => {
  await perRequest();
  const actor = await requireActor(request);
  const query = ActivityQuery.parse(Object.fromEntries(new URL(request.url).searchParams));
  return Response.json(ActivityResponse.parse(await makeListActivityUseCase().execute({ actor, ...query })));
});
