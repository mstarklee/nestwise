import { MembershipResponse } from '@nestwise/api-contract';
import { makeAcceptInviteUseCase } from '@/composition/family';
import { requireSessionUser } from '@/http/require-actor';
import { withApiErrors } from '@/http/with-api-errors';

type Context = { params: Promise<{ token: string }> };

export const POST = withApiErrors(async (request: Request, { params }: Context) => {
  const user = await requireSessionUser(request);
  const { token } = await params;
  const membership = await makeAcceptInviteUseCase().execute({ userId: user.userId, token });
  return Response.json(MembershipResponse.parse({ familyId: membership.familyId, role: membership.role }), { status: 201 });
});
