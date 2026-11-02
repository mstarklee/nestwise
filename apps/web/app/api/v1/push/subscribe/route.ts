import { PushSubscribeRequest } from '@nestwise/api-contract';
import { makeSavePushSubscriptionUseCase } from '@/composition/reminders';
import { requireSessionUser } from '@/http/require-actor';
import { withApiErrors } from '@/http/with-api-errors';

/** "Turn on reminders": saves this device's push subscription for the signed-in person. */
export const POST = withApiErrors(async (request: Request) => {
  const user = await requireSessionUser(request);
  const body = PushSubscribeRequest.parse(await request.json());
  await makeSavePushSubscriptionUseCase().execute({
    userId: user.userId,
    endpoint: body.endpoint,
    p256dh: body.keys.p256dh,
    auth: body.keys.auth,
    userAgent: request.headers.get('user-agent'),
  });
  return Response.json({ subscribed: true }, { status: 201 });
});
