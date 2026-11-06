import { ForgotPasswordRequest } from '@nestwise/api-contract';
import { makeAccountEmails, makeRequestPasswordResetUseCase } from '@/composition/auth';
import { appOrigin } from '@/http/app-origin';
import { withApiErrors } from '@/http/with-api-errors';

/** Always 202 with the same answer, whether or not the email has an account. */
export const POST = withApiErrors(async (request: Request) => {
  const body = ForgotPasswordRequest.parse(await request.json());
  await makeRequestPasswordResetUseCase(makeAccountEmails(appOrigin(request))).execute(body);
  return Response.json({ requested: true }, { status: 202 });
});
