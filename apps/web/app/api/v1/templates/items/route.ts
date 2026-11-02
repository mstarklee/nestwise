import { AddItemRequest, ItemResponse } from '@nestwise/api-contract';
import { makeAddItemUseCase } from '@/composition/plan';
import { requireActor } from '@/http/require-actor';
import { withApiErrors } from '@/http/with-api-errors';

export const POST = withApiErrors(async (request: Request) => {
  const actor = await requireActor(request);
  const body = AddItemRequest.parse(await request.json());
  const item = await makeAddItemUseCase().execute({ ...body, actor });
  return Response.json(ItemResponse.parse({ item }), { status: 201 });
});
