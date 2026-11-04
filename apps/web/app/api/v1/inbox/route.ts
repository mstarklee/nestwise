import { InboxResponse } from '@nestwise/api-contract';
import { makeListInboxUseCase } from '@/composition/duplicates';
import { perRequest } from '@/http/per-request';
import { requireActor } from '@/http/require-actor';
import { withApiErrors } from '@/http/with-api-errors';

/** Everything waiting for a yes: unanswered "Same purchase?" questions and spoken notes, oldest first in each. */
export const GET = withApiErrors(async (request: Request) => {
  await perRequest();
  const actor = await requireActor(request);
  const { duplicates, captures } = await makeListInboxUseCase().execute({ actor });
  return Response.json(
    InboxResponse.parse({
      entries: duplicates,
      voiceNotes: captures.map((note) => ({
        batchId: note.batchId,
        createdBy: note.createdBy,
        mine: note.mine,
        transcript: note.transcript,
        entryCount: note.entries.filter((entry) => !entry.dropped).length,
        createdAt: note.createdAt.toISOString(),
      })),
    }),
  );
});
