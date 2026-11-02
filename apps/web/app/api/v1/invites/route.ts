import { CreateInviteRequest, InviteResponse } from '@nestwise/api-contract';
import { makeCreateInviteUseCase } from '@/composition/family';
import { requireActor } from '@/http/require-actor';
import { withApiErrors } from '@/http/with-api-errors';

export const POST = withApiErrors(async (request: Request) => {
  const actor = await requireActor(request);
  const body = CreateInviteRequest.parse(await request.json());
  const { invite, token } = await makeCreateInviteUseCase().execute({ actor, role: body.role });
  return Response.json(
    InviteResponse.parse({
      inviteId: invite.id,
      token,
      expiresAt: invite.expiresAt.toISOString(),
      joinPath: `/join/${encodeURIComponent(token)}`,
    }),
    { status: 201 },
  );
});
