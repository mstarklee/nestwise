import { PotBalanceResponse } from '@nestwise/api-contract';
import { makeGetPotBalanceUseCase } from '@/composition/pot';
import { perRequest } from '@/http/per-request';
import { requireActor } from '@/http/require-actor';
import { withApiErrors } from '@/http/with-api-errors';

export const GET = withApiErrors(async (request: Request) => {
  await perRequest();
  const actor = await requireActor(request);
  return Response.json(PotBalanceResponse.parse(await makeGetPotBalanceUseCase().execute({ actor })));
});
