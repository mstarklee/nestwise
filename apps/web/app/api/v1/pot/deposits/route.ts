import { ConfirmPotDepositRequest, PotEntryResponse } from '@nestwise/api-contract';
import { makeConfirmPotDepositUseCase } from '@/composition/pot';
import { requireActor } from '@/http/require-actor';
import { withApiErrors } from '@/http/with-api-errors';

export const POST = withApiErrors(async (request: Request) => {
  const actor = await requireActor(request);
  const body = ConfirmPotDepositRequest.parse(await request.json());
  const entry = await makeConfirmPotDepositUseCase().execute({ actor, ...body });
  return Response.json(PotEntryResponse.parse({ entry }), { status: 201 });
});
