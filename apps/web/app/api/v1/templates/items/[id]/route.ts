import { IdParam, ItemResponse, UpdateItemRequest } from '@nestwise/api-contract';
import { InvalidMonthCommandError } from '@nestwise/domain/month-budget';
import { samePeriod } from '@nestwise/domain/shared';
import { makeApplyTemplateToMonthsUseCase, makePreviewFutureMonthsUseCase } from '@/composition/month-budget';
import { makeUpdateItemUseCase } from '@/composition/plan';
import { requireActor } from '@/http/require-actor';
import { withApiErrors } from '@/http/with-api-errors';

type Context = { params: Promise<{ id: string }> };

/**
 * Edits an item's name or template. With applyToMonths, the new amount also goes into those future months (PRD §6.2);
 * a month the preview does not offer is refused before anything changes.
 */
export const PATCH = withApiErrors(async (request: Request, { params }: Context) => {
  const actor = await requireActor(request);
  const itemId = IdParam.parse((await params).id);
  const { applyToMonths, ...body } = UpdateItemRequest.parse(await request.json());
  if (applyToMonths?.length) {
    const { months } = await makePreviewFutureMonthsUseCase().execute({ actor });
    if (applyToMonths.some((m) => !months.some((o) => samePeriod(o, m)))) {
      throw new InvalidMonthCommandError('Only months after this one that already exist can take a template change');
    }
  }
  const item = await makeUpdateItemUseCase().execute({ actor, itemId, ...body });
  if (applyToMonths?.length) await makeApplyTemplateToMonthsUseCase().execute({ actor, itemId, months: applyToMonths });
  return Response.json(ItemResponse.parse({ item }));
});
