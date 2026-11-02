import { AuthUserResponse } from '@nestwise/api-contract';
import { makeResolveSessionUseCase } from '@/composition/auth';
import { perRequest } from '@/http/per-request';
import { readSessionToken } from '@/http/session-cookie';
import { withApiErrors } from '@/http/with-api-errors';

export const GET = withApiErrors(async (request: Request) => {
  await perRequest();
  const session = await makeResolveSessionUseCase().execute({ token: readSessionToken(request) });
  return Response.json(AuthUserResponse.parse({ user: { id: session.userId, email: session.email } }));
});
