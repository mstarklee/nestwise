import { IdParam, ItemResponse } from '@nestwise/api-contract';
import { makeArchiveItemUseCase } from '@/composition/plan';
import { requireActor } from '@/http/require-actor';
import { withApiErrors } from '@/http/with-api-errors';

type Context = { params: Promise<{ id: string }> };

export const POST = withApiErrors(async (request: Request, { params }: Context) => {
  const actor = await requireActor(request);
  const itemId = IdParam.parse((await params).id);
  const item = await makeArchiveItemUseCase().execute({ actor, itemId });
  return Response.json(ItemResponse.parse({ item }));
});
