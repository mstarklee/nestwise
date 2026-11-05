import { AuthUserResponse, ResetPasswordRequest } from '@nestwise/api-contract';
import { makeResetPasswordUseCase } from '@/composition/auth';
import { sessionCookie } from '@/http/session-cookie';
import { withApiErrors } from '@/http/with-api-errors';

/** Sets the new password from a reset link; every other session ends and this browser is signed in. */
export const POST = withApiErrors(async (request: Request) => {
  const body = ResetPasswordRequest.parse(await request.json());
  const signedIn = await makeResetPasswordUseCase().execute(body);
  return Response.json(AuthUserResponse.parse({ user: signedIn.user }), {
    headers: { 'set-cookie': sessionCookie(request, signedIn.token, signedIn.expiresAt) },
  });
});
