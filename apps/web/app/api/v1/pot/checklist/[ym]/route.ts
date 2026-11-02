import { ChecklistResponse, MonthParam } from '@nestwise/api-contract';
import { makeGetChecklistUseCase } from '@/composition/pot';
import { perRequest } from '@/http/per-request';
import { requireActor } from '@/http/require-actor';
import { withApiErrors } from '@/http/with-api-errors';

type Context = { params: Promise<{ ym: string }> };

export const GET = withApiErrors(async (request: Request, { params }: Context) => {
  await perRequest();
  const actor = await requireActor(request);
  const period = MonthParam.parse((await params).ym);
  return Response.json(ChecklistResponse.parse(await makeGetChecklistUseCase().execute({ actor, period })));
});
