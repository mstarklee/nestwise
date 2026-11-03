import { IdParam, ResolveDuplicateRequest } from '@nestwise/api-contract';
import { makeResolveDuplicateUseCase } from '@/composition/duplicates';
import { requireActor } from '@/http/require-actor';
import { withApiErrors } from '@/http/with-api-errors';

type Context = { params: Promise<{ id: string }> };

/** Answers "Same purchase?": 204; 409 if someone already answered. */
export const POST = withApiErrors(async (request: Request, { params }: Context) => {
  const actor = await requireActor(request);
  const matchId = IdParam.parse((await params).id);
  const body = ResolveDuplicateRequest.parse(await request.json());
  await makeResolveDuplicateUseCase().execute({ actor, matchId, ...body });
  return new Response(null, { status: 204 });
});
