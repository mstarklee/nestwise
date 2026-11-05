import { ResendVerificationRequest, ResendVerificationResponse } from '@nestwise/api-contract';
import { makeAccountEmails, makeResendVerificationUseCase } from '@/composition/auth';
import { appOrigin } from '@/http/app-origin';
import { requireSignedIn } from '@/http/require-actor';
import { withApiErrors } from '@/http/with-api-errors';

/** "Send it again" on the Check your email screen (signed in, not yet verified). */
export const POST = withApiErrors(async (request: Request) => {
  const user = await requireSignedIn(request);
  const body = ResendVerificationRequest.parse(await request.json().catch(() => ({})));
  const result = await makeResendVerificationUseCase(makeAccountEmails(appOrigin(request))).execute({ userId: user.userId, ...body });
  return Response.json(ResendVerificationResponse.parse({ result }));
});
