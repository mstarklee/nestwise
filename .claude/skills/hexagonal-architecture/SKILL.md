---
name: hexagonal-architecture
description: >
  Hexagonal (ports and adapters) architecture for the NestWise Next.js + TypeScript monorepo. Use this skill
  whenever you write, review or plan server-side NestWise code: a Next.js API route handler under app/api, a
  Server Component or Server Action that reads or writes data, a Drizzle/Postgres query, a call to Claude,
  a speech-to-text service, web push or email, a scheduled job, or any business rule, calculation, permission
  check or transaction. Also use it when deciding where code belongs (packages/domain vs apps/web), even if
  the user never says "architecture".
user-invocable: true
---

# Hexagonal architecture (Next.js + TypeScript)

The business rules live in a core that knows nothing about HTTP, the database or Next.js. Everything else
plugs into that core from outside. The core is then tested without starting anything, and changing the database,
the transport, or adding a React Native client later never touches a rule.

In NestWise the core is **`packages/domain`**. The outside is **`apps/web`** (Next.js) and, later,
`apps/mobile` (Expo).

For the detailed NestWise conventions (folder layout, naming, wiring, errors, checklists), use the
**clean-architecture** skill together with this one.

## The one rule

**Dependencies point inward.** Outside code may import the core. The core never imports outside code.

A plain library is fine in the core (a validator, a date or money helper). It is not "outside": it brings no
framework and does no I/O. What the core must not import is a framework, or anything that talks to HTTP, the
database or another service. That rules out `next/*`, `react`, `server-only`, `drizzle-orm`, `postgres`,
`@supabase/*`, `@anthropic-ai/sdk`, `web-push` and email SDKs. It also rules out `packages/db` and
`packages/api-contract`, because those are outside shapes.

```text
HTTP request / page render / cron tick
    ↓
Route handler, Server Component, job     inbound adapter      (apps/web)
    ↓
Use case                                 behaviour            (packages/domain)
    ↓
Port (interface)                         what the core needs  (packages/domain)
    ↑ implements
Gateway adapter                          outbound adapter     (apps/web)
    ↓
Postgres · Claude API · push · email
```

## The parts

| Part | What it is | Where |
| --- | --- | --- |
| Model | The data (readonly types) and the rules that belong to it (pure functions beside the type). | core |
| Command | What a caller asks for, in domain terms. Not an HTTP body or a Zod schema. | core |
| Use case | One user intent: one class, one public `execute()`. | core |
| Port | An interface the core owns, saying what it needs, in the core's own types. | core |
| Outbound adapter | Implements a port with a real technology (Drizzle SQL, the Claude API, web push). | outside |
| Inbound adapter | Turns a request into a command and calls the use case: a route handler, a Server Component, a cron job. | outside |

Models are plain readonly objects plus functions, not class instances. Plain objects cross the API boundary,
the React Server Component boundary and the offline outbox as JSON. Class instances would silently lose their
methods on the way.

## Example: dropping a yearly bill

The core, with no framework in it:

```ts
// packages/domain/src/year-plan/models.ts
export type YearLineState = 'open' | 'done' | 'cancelled' | 'before_nestwise';

export interface YearLine {
  readonly id: string;
  readonly familyId: string;
  readonly plannedMinor: number;
  readonly paidMinor: number;
  readonly state: YearLineState;
}

export interface CancelYearLineCommand {
  readonly actor: Actor;            // who is asking, resolved by the outside from the session
  readonly yearLineId: string;
}

export const isPaid = (line: YearLine): boolean =>
  line.state === 'done' || line.paidMinor >= line.plannedMinor;

export const cancelled = (line: YearLine): YearLine => ({ ...line, state: 'cancelled' });

// packages/domain/src/year-plan/ports.ts — what the core needs, in the core's own types
export interface YearLineGateway {
  findById(familyId: string, yearLineId: string): Promise<YearLine | undefined>;
  save(line: YearLine): Promise<YearLine>;
}

// packages/domain/src/year-plan/use-cases/cancel-year-line.ts — one intent, one execute(); the rule lives here
export class CancelYearLineUseCase {
  constructor(private readonly yearLines: YearLineGateway) {}

  async execute(command: CancelYearLineCommand): Promise<YearLine> {
    assertCanEditPlan(command.actor);
    const line = await this.yearLines.findById(command.actor.familyId, command.yearLineId);
    if (!line) throw new YearLineNotFoundError(command.yearLineId);
    if (isPaid(line)) throw new YearLineNotCancellableError('A paid yearly item cannot be cancelled');
    return this.yearLines.save(cancelled(line));
  }
}
```

The outside, where Next.js and the database are:

```ts
// apps/web/src/adapters/year-plan/drizzle-year-line-gateway.ts — the port, implemented with SQL
export class DrizzleYearLineGateway implements YearLineGateway {
  constructor(private readonly db: Db) {}

  async findById(familyId: string, yearLineId: string) {
    const row = await this.db.query.yearLines.findFirst({
      where: and(eq(yearLines.familyId, familyId), eq(yearLines.id, yearLineId)),
    });
    return row ? toYearLine(row) : undefined;   // map the Drizzle row to the domain model
  }

  async save(line: YearLine) {
    await this.db.update(yearLines).set({ state: line.state })
      .where(and(eq(yearLines.familyId, line.familyId), eq(yearLines.id, line.id)));
    return line;
  }
}

// apps/web/app/api/v1/year-lines/[id]/cancellation/route.ts — HTTP in, command out, response back. No rules here.
export const POST = withApiErrors(async (request: Request, { params }: { params: Promise<{ id: string }> }) => {
  const actor = await requireActor(request);                      // session cookie or Bearer token → Actor
  const { id } = await params;
  const line = await makeCancelYearLineUseCase().execute({ actor, yearLineId: id });
  return Response.json(toYearLineResponse(line));                  // shape from packages/api-contract
});

// apps/web/src/composition/year-plan.ts — the outside builds the use case; the core needs no framework
export const makeCancelYearLineUseCase = (db: Db = getDb()) =>
  new CancelYearLineUseCase(new DrizzleYearLineGateway(db));
```

A Server Component that shows data is an inbound adapter too. It calls a query use case
(`makeGetYearPlanUseCase().execute(...)`) and renders the result. It never queries Drizzle itself.

## Testing

Test the core with an in-memory fake of the port. Use no framework, no database and no mocking library: no
`vi.mock`, `vi.fn` or `vi.spyOn` in `packages/domain` tests.

```ts
// packages/domain/test/year-plan/cancel-year-line.test.ts
import { InMemoryYearLineGateway } from '../fakes/in-memory-year-line-gateway';

describe('CancelYearLineUseCase', () => {
  it('refuses to cancel a paid yearly item and leaves it unchanged', async () => {
    const yearLines = new InMemoryYearLineGateway();
    await yearLines.save(paidSchoolFees);                 // state 'done'
    const cancel = new CancelYearLineUseCase(yearLines);

    await expect(cancel.execute({ actor: admin, yearLineId: paidSchoolFees.id }))
      .rejects.toBeInstanceOf(YearLineNotCancellableError);
    expect((await yearLines.findById(FAMILY_ID, paidSchoolFees.id))?.state).toBe('done');
  });
});
```

Test an adapter against the real thing it talks to (a real Postgres from the local Supabase or the dev project).
Its SQL, its `family_id` filtering and its row mapping are the parts a fake cannot show.

## What goes where

| Writing | Put it in |
| --- | --- |
| A business rule, a calculation, a default status, a permission check | the use case or the model (`packages/domain`) |
| What the core needs from outside (data, the clock, new IDs, an AI reading, a notification) | a port in the core |
| SQL, a call to Claude, push or email | an outbound adapter (`apps/web/src/adapters/<feature>/`) |
| Reading a request, resolving the session to an `Actor`, choosing an HTTP status | a route handler, plus the shared error mapper |
| Request and response shapes (Zod) | `packages/api-contract`: outside the core, shared with the future mobile app |
| Starting and committing a transaction | an adapter, behind a port the use case calls (a unit-of-work port) |
| Rendering data on a page | a Server Component that calls a query use case |
| Calling an SDK (Claude, push, email) correctly | the outbound adapter, following that SDK's own rules (for Claude, the claude-api skill) |

## Mistakes to avoid

- **A framework or I/O import in the core.** That means `next/server`, `drizzle-orm`, `@supabase/*`, `@anthropic-ai/sdk`, a Drizzle `$inferSelect` row type, or a Zod schema from `api-contract`.
- **A rule in a route handler, Server Action or adapter.** The next caller of the use case (the mobile app, the cron job, the offline sync) will not get it.
- **A port that returns the wrong shape.** It must return the core's own model, never a Drizzle row, a Supabase response or a `Response`.
- **One `*Service` object collecting every operation of a feature.** Write one use case per intent instead.
- **Going round the use case.** A route handler, Server Component or Server Action that talks to the database directly skips it, and with it every rule and the family-isolation check.
