import { CreateFamilyRequest, FamilyResponse } from '@nestwise/api-contract';
import { makeCreateFamilyUseCase } from '@/composition/family';
import { requireSessionUser } from '@/http/require-actor';
import { signupAllowed } from '@/http/signup-gate';
import { withApiErrors } from '@/http/with-api-errors';

export const POST = withApiErrors(async (request: Request) => {
  const user = await requireSessionUser(request);
  const body = CreateFamilyRequest.parse(await request.json());
  const family = await makeCreateFamilyUseCase().execute({
    ...body,
    actorUserId: user.userId,
    signupAllowed: signupAllowed(user.email),
  });
  const { id, name, currencyCode, minorUnit, numberLocale, timeZone, countryCode } = family;
  return Response.json(
    FamilyResponse.parse({ family: { id, name, currencyCode, minorUnit, numberLocale, timeZone, countryCode }, role: 'admin' }),
    { status: 201 },
  );
});
