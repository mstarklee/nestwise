import { databaseAnswers } from '@/composition/db';
import { perRequest } from '@/http/per-request';

/** After a deploy: 200 when the app runs and reaches its database (RUNBOOK step "check"), 503 otherwise. */
export async function GET() {
  await perRequest();
  const database = (await databaseAnswers()) ? 'ok' : 'unreachable';
  return Response.json({ status: database === 'ok' ? 'ok' : 'degraded', database }, { status: database === 'ok' ? 200 : 503 });
}
