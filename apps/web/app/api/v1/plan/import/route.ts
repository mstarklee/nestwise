import { NotAllowedError } from '@nestwise/domain/shared';
import { samplePlanImport } from '../../../../../../../fixtures/sample-plan-import';
import { makeImportPlanUseCase } from '@/composition/plan';
import { requireActor, requireSessionUser } from '@/http/require-actor';
import { planImportAllowed } from '@/http/signup-gate';
import { withApiErrors } from '@/http/with-api-errors';

/** "Import our plan" at setup: the family's own plan (fixtures/sample-plan.ts, no transactions), for listed emails only. */
export const POST = withApiErrors(async (request: Request) => {
  const user = await requireSessionUser(request);
  const actor = await requireActor(request);
  if (!planImportAllowed(user.email)) throw new NotAllowedError('This account cannot import the family plan');
  const result = await makeImportPlanUseCase().execute({ actor, plan: samplePlanImport });
  return Response.json(result, { status: 201 });
});
