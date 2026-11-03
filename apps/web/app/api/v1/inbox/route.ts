import { InboxResponse } from '@nestwise/api-contract';
import { makeListInboxUseCase } from '@/composition/duplicates';
import { perRequest } from '@/http/per-request';
import { requireActor } from '@/http/require-actor';
import { withApiErrors } from '@/http/with-api-errors';

/** The family's unanswered "Same purchase?" questions, oldest first. */
export const GET = withApiErrors(async (request: Request) => {
  await perRequest();
  const actor = await requireActor(request);
  const entries = await makeListInboxUseCase().execute({ actor });
  return Response.json(InboxResponse.parse({ entries }));
});
