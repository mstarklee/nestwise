import { ForecastResponse } from '@nestwise/api-contract';
import { makeGetForecastUseCase } from '@/composition/forecast';
import { perRequest } from '@/http/per-request';
import { requireActor } from '@/http/require-actor';
import { withApiErrors } from '@/http/with-api-errors';

export const GET = withApiErrors(async (request: Request) => {
  await perRequest();
  const actor = await requireActor(request);
  return Response.json(ForecastResponse.parse(await makeGetForecastUseCase().execute({ actor })));
});
