import { MonthParam, ResetMonthRequest } from '@nestwise/api-contract';
import { makeCopyOrBlankMonthUseCase } from '@/composition/month-budget';
import { requireActor } from '@/http/require-actor';
import { withApiErrors } from '@/http/with-api-errors';

type Context = { params: Promise<{ ym: string }> };

export const POST = withApiErrors(async (request: Request, { params }: Context) => {
  const actor = await requireActor(request);
  const period = MonthParam.parse((await params).ym);
  const { mode } = ResetMonthRequest.parse(await request.json());
  const budget = await makeCopyOrBlankMonthUseCase().execute({ actor, period, mode });
  return Response.json({ createdFrom: budget.createdFrom, lines: budget.lines.length });
});
