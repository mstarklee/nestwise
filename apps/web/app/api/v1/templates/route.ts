import { TemplatesResponse } from '@nestwise/api-contract';
import { makeGetTemplatesUseCase } from '@/composition/plan';
import { perRequest } from '@/http/per-request';
import { requireActor } from '@/http/require-actor';
import { withApiErrors } from '@/http/with-api-errors';

export const GET = withApiErrors(async (request: Request) => {
  await perRequest();
  const actor = await requireActor(request);
  const templates = await makeGetTemplatesUseCase().execute({ actor });
  return Response.json(TemplatesResponse.parse(templates));
});
