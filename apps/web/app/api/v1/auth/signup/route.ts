import { AuthUserResponse, CredentialsRequest } from '@nestwise/api-contract';
import { makeSignUpUseCase } from '@/composition/auth';
import { sessionCookie } from '@/http/session-cookie';
import { withApiErrors } from '@/http/with-api-errors';

export const POST = withApiErrors(async (request: Request) => {
  const body = CredentialsRequest.parse(await request.json());
  const signedIn = await makeSignUpUseCase().execute(body);
  return Response.json(AuthUserResponse.parse({ user: signedIn.user }), {
    status: 201,
    headers: { 'set-cookie': sessionCookie(request, signedIn.token, signedIn.expiresAt) },
  });
});
