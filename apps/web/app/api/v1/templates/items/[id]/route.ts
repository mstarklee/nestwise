import { IdParam, ItemResponse, UpdateItemRequest } from '@nestwise/api-contract';
import { makeUpdateItemUseCase } from '@/composition/plan';
import { requireActor } from '@/http/require-actor';
import { withApiErrors } from '@/http/with-api-errors';

type Context = { params: Promise<{ id: string }> };

export const PATCH = withApiErrors(async (request: Request, { params }: Context) => {
  const actor = await requireActor(request);
  const itemId = IdParam.parse((await params).id);
  const body = UpdateItemRequest.parse(await request.json());
  const item = await makeUpdateItemUseCase().execute({ actor, itemId, ...body });
  return Response.json(ItemResponse.parse({ item }));
});
