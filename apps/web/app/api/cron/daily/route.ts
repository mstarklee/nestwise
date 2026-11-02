import { timingSafeEqual } from 'node:crypto';
import { perRequest } from '@/http/per-request';
import { withApiErrors } from '@/http/with-api-errors';
import { runDailyJob } from '@/orchestration/run-daily-job';

/** Vercel Cron calls this daily at 02:30 UTC (vercel.json) with `Authorization: Bearer ${CRON_SECRET}`. */
export const GET = withApiErrors(async (request: Request) => {
  await perRequest();
  if (!authorized(request.headers.get('authorization'), process.env.CRON_SECRET)) {
    return Response.json({ error: { code: 'NotSignedIn', message: 'Not allowed' } }, { status: 401 });
  }
  return Response.json(await runDailyJob(new Date()));
});

/** No secret set means nobody may run the job. Compared in constant time. */
function authorized(header: string | null, secret: string | undefined): boolean {
  if (!secret) return false;
  const expected = Buffer.from(`Bearer ${secret}`);
  const given = Buffer.from(header ?? '');
  return given.length === expected.length && timingSafeEqual(given, expected);
}
