import { PotEntryResponse, RecordPotMovementRequest } from '@nestwise/api-contract';
import { makeRecordPotMovementUseCase } from '@/composition/pot';
import { requireActor } from '@/http/require-actor';
import { withApiErrors } from '@/http/with-api-errors';

export const POST = withApiErrors(async (request: Request) => {
  const actor = await requireActor(request);
  const body = RecordPotMovementRequest.parse(await request.json());
  const entry = await makeRecordPotMovementUseCase().execute({ actor, ...body });
  return Response.json(PotEntryResponse.parse({ entry }), { status: 201 });
});
