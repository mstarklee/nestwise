import { IdParam, ReorderItemsRequest } from '@nestwise/api-contract';
import { makeReorderItemsUseCase } from '@/composition/plan';
import { requireActor } from '@/http/require-actor';
import { withApiErrors } from '@/http/with-api-errors';

type Context = { params: Promise<{ id: string }> };

export const POST = withApiErrors(async (request: Request, { params }: Context) => {
  const actor = await requireActor(request);
  const groupId = IdParam.parse((await params).id);
  const { itemIds } = ReorderItemsRequest.parse(await request.json());
  const items = await makeReorderItemsUseCase().execute({ actor, groupId, itemIds });
  return Response.json({ itemIds: items.map((i) => i.id) });
});
