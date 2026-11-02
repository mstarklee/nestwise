---
name: clean-architecture
description: >
  Clean / hexagonal architecture conventions for the NestWise Next.js + TypeScript pnpm monorepo. Use this skill
  whenever you scaffold a domain feature, add a use case, write a Next.js API route handler, Server Component
  data read, Drizzle gateway adapter, unit-of-work/transaction, domain error or domain test with fakes, wire use
  cases into apps/web, or review code for module-boundary leaks (Next.js, Drizzle, Supabase or SDK imports in
  packages/domain, *Service god-classes, vi.mock in domain tests). Use it even when the user only says "add an
  endpoint", "add a feature" or "where should this go".
argument-hint: [feature-name] [use-case-name?]
user-invocable: true
---

# Clean architecture for NestWise (Next.js API + TypeScript)

**REQUIRED BACKGROUND:** the **hexagonal-architecture** skill (the one rule, the parts, and the worked example).
This skill is the concrete NestWise convention set: packages, folders, naming, wiring, errors, tests and
checklists.

## How to invoke

| Mode | Example | What to do |
| --- | --- | --- |
| Scaffold a feature | `/clean-architecture pot` | Create the feature folder with all its files, its fakes and tests. Follow §11. |
| Add a use case | `/clean-architecture pot ConfirmPotDeposit` | Reuse the feature's models, ports, errors and fakes. Follow §12. |
| General guidance | `/clean-architecture` | Apply these conventions to the current code, review, or question. |

---

## 1. Packages and how the boundary is enforced

```text
nestwise/
├── pnpm-workspace.yaml          packages: ["apps/*", "packages/*"]
├── apps/web/                    Next.js app: route handlers, pages, adapters, wiring   (outside)
├── packages/domain/             the core: pure TypeScript                              (inside)
├── packages/api-contract/       Zod request/response schemas, shared with the future mobile app (outside)
└── packages/db/                 Drizzle schema + migrations                            (outside)
```

`apps/web` depends on `@nestwise/domain`. `@nestwise/domain` depends on nothing in the workspace.

The boundary is enforced by tooling, so a framework import in the core fails the build rather than waiting
for a code review:

1. **Package dependencies.** `packages/domain/package.json` declares no framework, I/O, or workspace packages.
   pnpm's strict `node_modules` means an undeclared import (`next`, `drizzle-orm`) does not resolve. Never fix
   that by adding the dependency to the domain, or by hoisting (`shamefully-hoist`, `node-linker=hoisted`).
2. **No runtime globals.** `packages/domain/tsconfig.json` uses `"lib": ["ES2023"]` and `"types": []`. Then
   `window`, `fetch`, `process`, `Buffer`, `crypto` and timers are type errors in the core.
3. **Lint backstop.** ESLint `no-restricted-imports` in `packages/domain` blocks:
   - `next`, `next/*`, `react`, `react-dom`, `server-only`
   - `drizzle-orm*`, `postgres`, `@supabase/*`, `@anthropic-ai/*`, `web-push`, `nodemailer`
   - `@nestwise/db`, `@nestwise/api-contract`
4. **Public surface.** The domain's `package.json` `exports` lists only `./<feature>` entry points (each
   feature's `index.ts`) and `./shared`. Deep imports into a feature's internals do not resolve.

A plain library (no framework, no I/O) is allowed in the domain when it does the job better than hand-written
code. Add it deliberately, to `packages/domain/package.json`.

---

## 2. Folder layout (screaming architecture)

Top-level folders in the core are **features**, not component types. Inside a feature, use one file per
concern:

```text
packages/domain/src/
├── shared/                 cross-feature kernel
│   ├── money.ts            minor-unit arithmetic and parsing (no formatting: that's presentation)
│   ├── period.ts           IsoDate, Period (year, month), period of a date
│   ├── actor.ts            Actor, Role, assertCan(actor, permission)
│   ├── ports.ts            Clock, IdGenerator
│   └── errors.ts           DomainError root + ErrorCategory
├── expenses/               ← a feature
│   ├── models.ts           entity, command and value-object types, string-literal unions, pure rule functions
│   ├── ports.ts            gateway interfaces (+ a unit-of-work port if the feature needs atomic writes)
│   ├── errors.ts           ExpensesError base + specific errors
│   ├── use-cases/
│   │   ├── record-expense.ts       RecordExpenseUseCase
│   │   ├── refund-expense.ts       RefundExpenseUseCase
│   │   └── duplicate-finder.ts     internal service: not exported from index.ts
│   └── index.ts            public surface: models, ports, errors, use cases
├── family/  plan/  month-budget/  year-plan/  pot/  forecast/  reminders/  capture/
packages/domain/test/
├── fakes/                  in-memory-<port>.ts, fixed-clock.ts, sequential-ids.ts
└── <feature>/              <use-case>.test.ts
```

**Use string-literal unions, not TS `enum`.** For example: `type TransactionKind = 'expense' | 'refund'`.

- Enums emit runtime objects, and numeric enums accept any number.
- Literal unions are the same strings the database and the API use, so nothing needs mapping.

**Anti-pattern:** top-level `models/`, `services/`, `types/` folders in the core. They scatter a feature
across the tree, so it can't be read or deleted as a unit.

---

## 3. Naming

| Component | Convention | Example | Avoid |
| --- | --- | --- | --- |
| Input model | `*Command` interface | `RecordExpenseCommand` | `*Request`, `*Dto`, `*Input`, `*Params` |
| Entity | plain noun type | `Transaction`, `YearLine` | `*Entity`, `*Row`, `*Model` |
| Value object | plain noun type | `Allocation`, `Period` | — |
| Use case | `*UseCase` class with `execute()`, file named verb-noun | `RecordExpenseUseCase` in `record-expense.ts` | `*Service`, `*Manager`, `*Handler`, `*Action` |
| Outbound port | `*Gateway` interface | `TransactionGateway`, `ReceiptReaderGateway` | `*Repository`, `I*` prefix |
| Adapter | technology + port name | `DrizzleTransactionGateway`, `ClaudeReceiptReaderGateway` | `*GatewayImpl` |
| Fake | `InMemory` + port name | `InMemoryTransactionGateway` | `Mock*`, `Stub*` |
| Error | `*Error` class | `InvalidExpenseCommandError` | `*Exception` |
| Wiring | `make` + use case name | `makeRecordExpenseUseCase` | — |

**Why each name:**

- **`*UseCase`, not `*Service`.** Services grow into god-classes. One class per operation keeps single responsibility.
- **`*Gateway`, not `*Repository`.** "Repository" is kept for single-store Drizzle helpers in `apps/web`, so the two layers never get confused.
- **`*Command`, not `*Request`.** The same use case is called from a route handler, a Server Component, the cron job, the offline outbox sync and, later, the mobile app. A request is just one of those transports.
- **Technology prefix on adapters.** It shows which implementation you're looking at when an in-memory fake and a Drizzle adapter sit side by side.

---

## 4. Use case pattern

```ts
// packages/domain/src/expenses/use-cases/record-expense.ts
export class RecordExpenseUseCase {
  constructor(
    private readonly transactions: TransactionGateway,
    private readonly items: ItemGateway,
    private readonly clock: Clock,
  ) {}

  async execute(command: RecordExpenseCommand): Promise<Transaction> {
    assertCan(command.actor, 'record_expense');
    validate(command);                                    // pure checks first: nothing read or written yet

    const familyId = command.actor.familyId;              // never a familyId from the request body
    const existing = await this.transactions.findById(familyId, command.id);
    if (existing) return existing;                        // same client id retried by the offline outbox

    await this.assertItemsUsable(familyId, command.allocations);
    return this.transactions.save({
      id: command.id,
      familyId,
      kind: 'expense',
      status: 'confirmed',                                // the domain owns default state
      amountMinor: command.amountMinor,
      txnDate: command.txnDate,
      period: periodOf(command.txnDate),
      allocations: command.allocations,
      enteredBy: command.actor.userId,
      paidBy: command.paidBy ?? command.actor.userId,
      createdAt: this.clock.now(),
    });
  }

  private async assertItemsUsable(familyId: string, allocations: readonly Allocation[]) { /* … */ }
}

function validate(command: RecordExpenseCommand): void {
  if (!Number.isSafeInteger(command.amountMinor) || command.amountMinor <= 0) {
    throw new InvalidExpenseCommandError('amountMinor must be a positive whole number of minor units');
  }
  if (sumMinor(command.allocations.map((a) => a.amountMinor)) !== command.amountMinor) {
    throw new InvalidExpenseCommandError('allocations must add up to amountMinor');
  }
  // … one check per rule
}
```

**Rules:**

1. **One use case = one class = one public `execute()`.** Private methods and module-level functions in the
   same file are fine.
2. **Check permission and validate first, then act.** The same checks run whichever inbound adapter called.
   Zod in `api-contract` checks the *shape* at the edge. It never replaces the use case's business validation.
3. **IDs come from the `IdGenerator` port** (`this.ids.next()`), generated in the use case, never by the
   gateway or a database default.
   - **Exception:** a client-supplied idempotency id (the offline outbox's UUID v7) arrives in the command.
     The use case validates its format and uses it.
4. **Time comes from the `Clock` port.** Never `new Date()` or `Date.now()` in the core. Periods, statuses
   and the forecast depend on "today", and tests must pin it.
5. **The use case sets default state** (`status: 'confirmed'`, `state: 'open'`).
6. **Every port is a required constructor parameter.** No optional ports, no defaults that build an adapter.
7. **Family scope comes from `command.actor.familyId`.** That is resolved from the session by the inbound
   adapter, and every gateway method takes it.

---

## 5. Models

- **Readonly interfaces or types, not classes.** They cross JSON, the React Server Component boundary and the
  offline outbox intact. Put rules that belong to the data beside the type as pure functions:
  `isPaid(line)`, `remainingMinor(line)`.
- **Commands** carry no `id` (unless it's a client idempotency id), no status and no timestamps. They carry
  the `actor`.
- **Entities** have `id`, a status or state, and timestamps.
- **Money** is integer minor units (`amountMinor: number`, checked with `Number.isSafeInteger`). Never floats.
- **Calendar dates** are an `IsoDate` (a branded `YYYY-MM-DD` string). **Instants** are `Date`.

---

## 6. Ports, adapters, transactions and wiring

### Port (core): only what the core needs, in core types

```ts
// packages/domain/src/expenses/ports.ts
export interface TransactionGateway {
  findById(familyId: string, id: string): Promise<Transaction | undefined>;
  save(transaction: Transaction): Promise<Transaction>;
}
```

### Adapter (outside)

- **Location:** `apps/web/src/adapters/<feature>/`, e.g. `drizzle-transaction-gateway.ts`. Group by
  feature, not by store: an adapter may combine Postgres and Supabase Storage.
- **Mapping:** row ↔ model conversion lives in the adapter (`toTransaction(row)`, `toRow(model)`).
- **Family filter:** every query filters by `family_id`.
- **Single-store helpers:** pure Drizzle helpers shared by several adapters go in
  `apps/web/src/repositories/postgres/`.
- **Server only:** every adapter and composition file starts with `import 'server-only'`.

### Transactions: a unit-of-work port the use case calls

The use case decides what must be atomic. The adapter decides how.

```ts
// packages/domain/src/pot/ports.ts
export interface PotUnitOfWork {
  run<T>(work: (gateways: { pot: PotGateway; activity: ActivityGateway }) => Promise<T>): Promise<T>;
}

// apps/web/src/adapters/pot/drizzle-pot-unit-of-work.ts
export class DrizzlePotUnitOfWork implements PotUnitOfWork {
  constructor(private readonly db: Db) {}
  run<T>(work: Parameters<PotUnitOfWork['run']>[0]) {
    return this.db.transaction((tx) =>
      work({ pot: new DrizzlePotGateway(tx), activity: new DrizzleActivityGateway(tx) }));
  }
}
```

The fake `InMemoryPotUnitOfWork` runs `work` against in-memory gateways. If `work` throws, it restores a
snapshot, so tests can prove that nothing was saved on failure.

### Wiring (the Spring `@Configuration` equivalent)

```ts
// apps/web/src/composition/expenses.ts
import 'server-only';
export const makeRecordExpenseUseCase = (db: Db = getDb()) =>
  new RecordExpenseUseCase(new DrizzleTransactionGateway(db), new DrizzleItemGateway(db), systemClock);
```

- **Plain factory functions.** No DI container and no decorators: `tsyringe` and `inversify` need
  `reflect-metadata` and annotations on core classes.
- **Built per request.** That's cheap. The database pool is the only singleton.

### Uniqueness rules under concurrency

A rule like "one deposit per family per month" is checked by the use case, but two phones can pass that
check at the same moment. So:

- **The database is the real guard.** Back the rule with a unique constraint.
- **The adapter translates the database's answer.** It catches the database's unique violation (Postgres code
  `23505`) and throws the feature's conflict error, e.g. `PotDepositAlreadyExistsError`. The caller then gets the
  same 409 whether the use case's check or the database caught the duplicate.
- **The use case's own check stays** as the fast, readable path.

Test the race in the adapter's integration test: two concurrent saves, and exactly one wins.

### Who is calling: session → `Actor`

`requireActor(request)` in `apps/web/src/http/` reads the Supabase session (a cookie or a Bearer token).

- **The membership lookup is outbound data access like any other.** It goes through a `MembershipGateway`
  port (family feature) and its Drizzle adapter, built by a `make*` factory.
- **Nothing in `apps/web/src/http/` imports Drizzle or queries the database directly.**

### Inbound adapters stay thin

```ts
// apps/web/app/api/v1/transactions/route.ts
export const POST = withApiErrors(async (request: Request) => {
  const actor = await requireActor(request);                       // cookie or Bearer → membership → Actor
  const body = RecordExpenseRequest.parse(await request.json());   // shape only (api-contract)
  const transaction = await makeRecordExpenseUseCase().execute({ ...toRecordExpenseCommand(body), actor });
  return Response.json(toTransactionResponse(transaction), { status: 201 });
});
```

Server Components and the cron job follow the same pattern: resolve the actor, call a `make*` factory, map
the result. A Server Action, if one is used at all, is equally thin and calls the same factory.

---

## 7. Errors

```ts
// packages/domain/src/shared/errors.ts
export type ErrorCategory = 'invalid' | 'not_found' | 'not_allowed' | 'conflict';

export abstract class DomainError extends Error {
  abstract readonly category: ErrorCategory;
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = new.target.name;
  }
}

// packages/domain/src/expenses/errors.ts — one abstract base per feature, specific errors extend it
export abstract class ExpensesError extends DomainError {}
export class InvalidExpenseCommandError extends ExpensesError { readonly category = 'invalid' as const; }
export class ItemNotUsableError extends ExpensesError { readonly category = 'invalid' as const; }
export class TransactionNotFoundError extends ExpensesError { readonly category = 'not_found' as const; }
```

- **Per-feature base.** It keeps the feature identifiable in logs and lets callers catch one feature's
  errors.
- **`DomainError` root plus `category`.** One mapper then handles every feature without listing them.
- **Categories are domain words, not HTTP codes.** The mapper lives in `apps/web/src/http/with-api-errors.ts`:

  | Error | HTTP status |
  | --- | --- |
  | `invalid` | 422 |
  | `not_found` | 404 |
  | `not_allowed` | 403 |
  | `conflict` | 409 |
  | Zod shape error | 400 |
  | anything else | 500, logged, with no internal message returned |

- **Subclass names follow their category:**
  - `Invalid*Error`
  - `*NotFoundError`
  - `*NotAllowedError`
  - `*AlreadyExistsError` or `*Not<Verb>ableError` for state conflicts

---

## 8. Testing

**Domain tests** (`packages/domain/test`):

- **Tools:** Vitest with plain `expect`.
- **Fakes, not mocks.** Use the fakes in `test/fakes/`, which are `Map`-based with helper queries like
  `count()` and `all()`, plus `FixedClock` and `SequentialIds`.
- **No mocking library.** `vi.mock`, `vi.fn` and `vi.spyOn` are banned in `packages/domain`
  (ESLint `no-restricted-properties`), because mocks verify calls instead of behaviour.
- **Categories to cover per use case:**
  - happy path
  - field mapping
  - each validation rule and permission
  - no side effects on failure (the fake is unchanged after a throw)

**Adapter tests:** integration tests against a real Postgres, in
`apps/web/test/integration/adapters/<feature>/`. They check the SQL, the row mapping, and that a gateway
never returns another family's rows.

**Route tests:** call the route handler with a test session. Check the status for each error category and
the response shape against `api-contract`.

---

## 9. Sharing code

| Situation | Mechanism | Lives in |
| --- | --- | --- |
| Pure calculation, no ports (money maths, set-aside split, forecast projection) | exported pure function | the feature's `models.ts`, or `shared/` |
| Same port-using logic in 2+ use cases of one feature | internal service class | `<feature>/use-cases/`, **not** exported from `index.ts` |
| Use case A is a genuine user intent and also a sub-step of B | B depends on A | `<feature>/use-cases/` |
| Coordination across features or infrastructure concerns (daily job, fan-out of notifications, retries) | orchestration | `apps/web/src/orchestration/` |

Internal services:

- They are built by the use case from the ports it already receives, never in `composition/`.
- They are instance-based, with ports as fields, rather than static helpers that thread ports through every
  call.
- Don't extract one before the duplication exists.

---

## 10. Anti-patterns

| Anti-pattern | What goes wrong | Instead |
| --- | --- | --- |
| Business rule in `route.ts`, a Server Action or a Server Component | The mobile app, cron or offline sync skips it | Put it in the use case |
| Route or Server Component queries Drizzle directly | Bypasses rules and the family-isolation check | Call a query use case through its `make*` factory |
| `ExpenseService` with many methods | God-class | One `*UseCase` per intent |
| Core imports `next`, `drizzle-orm`, `@supabase/*`, an SDK, or `api-contract` Zod | The core can't be reused by mobile or tested bare | Port + adapter; map at the edge |
| Port returns `typeof transactions.$inferSelect` | Database shape leaks into the core | Return the domain model; map in the adapter |
| `vi.mock` / `vi.fn` in domain tests | Brittle tests of calls, not behaviour | In-memory fakes |
| `new Date()`, `Date.now()`, `crypto.randomUUID()` in the core | Untestable; fails with `types: []` | `Clock` and `IdGenerator` ports |
| TS `enum` | Runtime object, loose numeric values, awkward JSON | String-literal union |
| Domain models as classes with methods | Methods are lost across JSON, RSC and the outbox | Readonly types + pure functions |
| `familyId` taken from the request body | Cross-family access | `actor.familyId` from the session |
| Only Zod validation at the edge | Other callers skip business rules | Zod for shape + use case `validate()` for rules |
| DI container or decorators on core classes | Framework metadata in the core | `make*` factory functions |
| Transaction opened in a route around several use case calls | Atomicity rules live outside the core | Unit-of-work port the use case calls |
| Error carrying an HTTP status | HTTP leaks into the core | `category` + the shared mapper |
| Gateway adapter in `repositories/` | Misleading when it combines stores | `adapters/<feature>/` |
| A uniqueness rule checked only in the use case | Two concurrent requests both pass | Unique constraint + the adapter maps the violation to the conflict error |
| `requireActor` or another helper querying Drizzle directly | Data access hidden outside the adapters | `MembershipGateway` + a Drizzle adapter |
| Internal service exported or built in `composition/` | Leaks domain internals | Non-exported, built inside the use case |

---

## 11. Checklist: new feature

- [ ] `packages/domain/src/<feature>/` with `models.ts`, `ports.ts`, `errors.ts`, `use-cases/`, `index.ts`
- [ ] String-literal unions for states and kinds in `models.ts`
- [ ] Command type (actor; no id unless client idempotency id; no status; no timestamps)
- [ ] Entity type (id, state, timestamps), value objects, pure rule functions
- [ ] Gateway interface(s) in `ports.ts`, only the methods the core calls, every method taking `familyId`
- [ ] Unit-of-work port if a use case must write atomically
- [ ] Abstract `<Feature>Error extends DomainError` + specific errors with a `category`
- [ ] Use case: `assertCan` → `validate()` → act; ids from `IdGenerator`, time from `Clock`, default state set
- [ ] `index.ts` exports models, ports, errors, use cases (not internal services); add `./<feature>` to `exports`
- [ ] Fakes in `packages/domain/test/fakes/`
- [ ] Tests: happy path, field mapping, each rule and permission, no side effects on failure
- [ ] Adapter in `apps/web/src/adapters/<feature>/` with `import 'server-only'` + integration test incl. cross-family
- [ ] `make*` factory in `apps/web/src/composition/<feature>.ts`
- [ ] Thin route handler under `apps/web/app/api/v1/…` with Zod shapes in `packages/api-contract`
- [ ] Verify: `pnpm --filter @nestwise/domain lint typecheck test` passes, with no framework imports in the core

## 12. Checklist: new use case in an existing feature

- [ ] **Reuse first.** Read the feature's models, ports, errors and fakes before adding anything
- [ ] New command type only if the input shape differs
- [ ] Reuse the feature's entity; add union members rather than new unions
- [ ] Add methods to the existing gateway, never a second gateway for the same data
- [ ] Use case class with constructor-injected ports and one `execute()`
- [ ] `assertCan` + `validate()`: every use case checks independently
- [ ] New error only for a new category; always extend the feature's base error
- [ ] Extend the existing fake (helper queries if needed)
- [ ] Tests: happy path, field mapping, each rule and permission, no side effects on failure
- [ ] `make*` factory + thin inbound adapter; verify the domain still has no framework imports

## 13. What goes where

| Writing… | Location |
| --- | --- |
| Business rule, permission check, default state | `packages/domain/src/<feature>/use-cases/` or `models.ts` |
| Pure calculation | `packages/domain/src/<feature>/models.ts` or `shared/` |
| Command, entity, value object | `packages/domain/src/<feature>/models.ts` |
| Port (gateway, unit of work) | `packages/domain/src/<feature>/ports.ts`; Clock and IdGenerator in `shared/ports.ts` |
| Domain error | `packages/domain/src/<feature>/errors.ts` |
| Internal service | `packages/domain/src/<feature>/use-cases/` (not exported) |
| Fake | `packages/domain/test/fakes/` |
| Gateway adapter | `apps/web/src/adapters/<feature>/` |
| Single-store Drizzle helper | `apps/web/src/repositories/postgres/` |
| Wiring | `apps/web/src/composition/<feature>.ts` |
| Route handler | `apps/web/app/api/v1/…/route.ts` |
| Session → `Actor`, error → HTTP | `apps/web/src/http/` (membership lookup through `MembershipGateway`) |
| Cross-feature job | `apps/web/src/orchestration/` |
| Request and response shapes | `packages/api-contract/src/<feature>.ts` |
| Database schema, migrations | `packages/db/` |
