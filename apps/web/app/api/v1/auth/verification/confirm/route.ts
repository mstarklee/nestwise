import { ConfirmEmailRequest, ConfirmEmailResponse } from '@nestwise/api-contract';
import { makeConfirmEmailUseCase } from '@/composition/auth';
import { withApiErrors } from '@/http/with-api-errors';

/** The verify link's page posts its token here. No session needed: the link may be opened on another device. */
export const POST = withApiErrors(async (request: Request) => {
  const body = ConfirmEmailRequest.parse(await request.json());
  const confirmed = await makeConfirmEmailUseCase().execute(body);
  return Response.json(ConfirmEmailResponse.parse(confirmed));
});
