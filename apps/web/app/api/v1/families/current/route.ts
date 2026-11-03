import { FamilySettingsResponse, UpdateFamilyRequest } from '@nestwise/api-contract';
import { makeUpdateFamilySettingsUseCase } from '@/composition/family';
import { requireActor } from '@/http/require-actor';
import { withApiErrors } from '@/http/with-api-errors';

/** Renames the family or changes its alert levels (Admin). Anything else in the body is ignored; the currency is locked. */
export const PATCH = withApiErrors(async (request: Request) => {
  const actor = await requireActor(request);
  const body = UpdateFamilyRequest.parse(await request.json());
  const family = await makeUpdateFamilySettingsUseCase().execute({ actor, ...body });
  return Response.json(FamilySettingsResponse.parse({ family }));
});
