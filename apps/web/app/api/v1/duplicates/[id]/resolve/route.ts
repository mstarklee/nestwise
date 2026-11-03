import { IdParam, ResolveDuplicateRequest } from '@nestwise/api-contract';
import { makeResolveDuplicateUseCase } from '@/composition/duplicates';
import { runInBackground } from '@/http/background';
import { requireActor } from '@/http/require-actor';
import { withApiErrors } from '@/http/with-api-errors';
import { sendSpendingAlerts } from '@/orchestration/send-spending-alerts';

type Context = { params: Promise<{ id: string }> };

/** Answers "Same purchase?": 204; 409 if someone already answered. */
export const POST = withApiErrors(async (request: Request, { params }: Context) => {
  const actor = await requireActor(request);
  const matchId = IdParam.parse((await params).id);
  const body = ResolveDuplicateRequest.parse(await request.json());
  const { period } = await makeResolveDuplicateUseCase().execute({ actor, matchId, ...body });
  // Different makes the waiting expense count, so spending alerts may now be due.
  if (body.answer === 'different') runInBackground('Spending alerts', sendSpendingAlerts(actor.familyId, period));
  return new Response(null, { status: 204 });
});
