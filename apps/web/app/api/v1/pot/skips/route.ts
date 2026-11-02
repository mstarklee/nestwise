import { ChecklistSkipResponse, SkipChecklistItemRequest } from '@nestwise/api-contract';
import { makeSkipChecklistItemUseCase } from '@/composition/pot';
import { requireActor } from '@/http/require-actor';
import { withApiErrors } from '@/http/with-api-errors';

export const POST = withApiErrors(async (request: Request) => {
  const actor = await requireActor(request);
  const body = SkipChecklistItemRequest.parse(await request.json());
  const skip = await makeSkipChecklistItemUseCase().execute({ actor, ...body });
  return Response.json(ChecklistSkipResponse.parse({ skip }), { status: 201 });
});
