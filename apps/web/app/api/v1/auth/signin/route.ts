import { AuthUserResponse, CredentialsRequest } from '@nestwise/api-contract';
import { makeSignInUseCase } from '@/composition/auth';
import { sessionCookie } from '@/http/session-cookie';
import { withApiErrors } from '@/http/with-api-errors';

export const POST = withApiErrors(async (request: Request) => {
  const body = CredentialsRequest.parse(await request.json());
  const signedIn = await makeSignInUseCase().execute(body);
  return Response.json(AuthUserResponse.parse({ user: signedIn.user }), {
    headers: { 'set-cookie': sessionCookie(signedIn.token, signedIn.expiresAt) },
  });
});
