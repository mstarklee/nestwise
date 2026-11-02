import { makeSignOutUseCase } from '@/composition/auth';
import { clearedSessionCookie, readSessionToken } from '@/http/session-cookie';
import { withApiErrors } from '@/http/with-api-errors';

export const POST = withApiErrors(async (request: Request) => {
  const token = readSessionToken(request);
  if (token) await makeSignOutUseCase().execute({ token });
  return Response.json({ signedOut: true }, { headers: { 'set-cookie': clearedSessionCookie(request) } });
});
