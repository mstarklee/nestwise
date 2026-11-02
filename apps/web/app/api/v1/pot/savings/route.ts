import { ConfirmSavingsRequest, SavingsEntryResponse } from '@nestwise/api-contract';
import { makeConfirmSavingsUseCase } from '@/composition/pot';
import { requireActor } from '@/http/require-actor';
import { withApiErrors } from '@/http/with-api-errors';

export const POST = withApiErrors(async (request: Request) => {
  const actor = await requireActor(request);
  const body = ConfirmSavingsRequest.parse(await request.json());
  const entry = await makeConfirmSavingsUseCase().execute({ actor, ...body });
  return Response.json(SavingsEntryResponse.parse({ entry }), { status: 201 });
});
