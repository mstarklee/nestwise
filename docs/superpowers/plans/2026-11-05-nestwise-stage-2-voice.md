# NestWise Stage 2 — Voice Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
> **REQUIRED for every task that touches server code:** the project skills `hexagonal-architecture` and `clean-architecture` (`.claude/skills/`). They define layout, naming, wiring, errors and fakes. This plan does not repeat them.

**Goal:** The family adds a batch of expenses — and ticks yearly bills off the year plan — by speaking once in Tamil,
English or both, checking the list, and tapping to add.

**Architecture:** A new `capture` slice in `packages/domain/src/capture/` (models, `SpeechToText` / `ExpenseParser` /
`CaptureGateway` ports, pure rules, use cases), with provider adapters in `apps/web/src/adapters/capture/`, `make*`
wiring in `apps/web/src/composition/capture.ts`, Zod shapes in `packages/api-contract/src/capture.ts`, thin
`/api/v1/capture/*` routes, and Server Component screens. Spoken entries wait in their own staging tables and become
real transactions only at confirm, through the existing `RecordExpenseUseCase`.

**Tech Stack:** As Stage 1b (Next.js 16.4.3, React 19, TypeScript strict, pnpm, Drizzle + node-postgres, Zod,
next-intl, Serwist, Vitest, Playwright WebKit), plus the browser's `MediaRecorder` and two HTTP speech services
(OpenAI `gpt-transcribe`, Sarvam Saaras). No provider SDK is added to `packages/domain`.

**Spec:** `docs/superpowers/specs/2026-11-04-nestwise-stage-2-voice-design.md` (approved 2026-11-05).
Also binding: `docs/NestWise_PRD.md` (§6.11, §7 test 15, §8 decisions 14 and 18) and `docs/NestWise_TRD.md` (§9, §10,
§11), **as corrected by spec §12** — the TRD's model names, cost figures, recording gesture and storage plan are out
of date and must not be followed where the spec contradicts them.

**Ledger:** `.superpowers/sdd/2026-11-05-nestwise-stage-2-voice/progress.md`. Stage 1a's and 1b's rulings still bind.

**One change from the spec, flagged for the owner (spec §7).** The spec keeps a 60-second limit and has the Sarvam
adapter split longer clips at a silence gap. Splitting needs PCM decoding inside a serverless function — a large
piece of work for a case that only exists if Sarvam wins *and* someone talks for over 30 seconds. This plan instead
makes **the limit follow the chosen service: 60 s on OpenAI, 30 s on Sarvam**, and keeps the splitting as Task 14,
to be built only if the owner wants 60 s after Sarvam wins. The owner's own example runs about 15 seconds.

## Global Constraints

These apply to every task, on top of the Stage 1a and 1b plans' Global Constraints (still binding).

- **Audio is never stored.** It is processed in memory and dropped the moment `transcribe()` returns — never written
  to disk, to Storage, or to any log, and never included in an error message.
- **The transcript is kept** as an `evidence` row of `kind = 'voice'`.
- **Real recordings and transcripts never enter git.** Test audio lives outside the repo; fixtures in the repo are
  written transcripts only, and invented, not the family's.
- **Nothing counts until confirmed.** The staging store is excluded from actuals, the pot, year-line paid amounts and
  the forecast, because it holds no transactions at all.
- **`transactions.status = 'pending'` keeps its Stage 1b meaning** — waiting for a duplicate answer. Voice must not
  reuse it, and must not change `list-inbox`, `release-matches` or `restore-expense` semantics.
- **Voice never calls `MarkYearLineDoneUseCase`.** A bill payment is an ordinary expense whose allocation carries the
  yearly item and its `plan_year`. See spec §6 for why.
- **Only the batch's creator may confirm it.** No admin override.
- **Voice never creates a plan item**, only ever offers the Miscellaneous item.
- **Never invent an amount or a date.** Unheard amount → `null` and low confidence. Date defaults to today in the
  family's time zone (`todayIn`).
- Every UI string lives in `apps/web/messages/en.json`; the domain returns message keys and values only.
- **No provider SDK type may appear in `packages/domain`.** The two speech services must be interchangeable behind
  `SpeechToText`.
- **CI runs with fakes.** No task's unit or integration tests may need an API key or the network.
- Env: `AI_MODEL` default `gpt-6.1-terra`; `STT_PROVIDER` / `STT_API_KEY` select the speech service;
  `SARVAM_API_KEY` lives in `apps/web/.env.local` and `OPENAI_API_KEY` in the repo-root `.env.local`.
- `CAP_VOICE_PER_MONTH = 400`.
- Visual design stays plain shadcn/ui at phone width; the redesign is the next stage. Do not gold-plate the
  recording screen.
- Commits: one local commit per finished task, with the message given. **Never push or deploy without asking the owner.**

## Review Focus

Inputs the spec implies but no spec test exercises. Each has a test in the task that owns the code.

1. **Two real expenses with the same amount in one breath** ("KPN 250, chicken 250"). `RecordExpenseUseCase` calls
   `listNear`, which matches on amount and date, so confirming the batch would make each row ask "Same purchase?"
   about the other. Rows of the same batch must never raise a duplicate question against each other. Covered by Task 8.
2. **A recording with no expenses in it** ("hello, testing one two"). The screen says nothing was caught, and no empty
   batch is left behind to clutter the Inbox. Covered by Task 7.
3. **An amount spoken only in Tamil words** ("irunooru rubaai", no digits). It must become ₹200, and "irunooru" must
   not be read as the item name. Covered by Task 3.
4. **A bill payment spoken for a bill already fully paid, or dated into next year's plan.** Shown as already paid and
   not offered; never counted twice, never silently applied to a different year's line. Covered by Task 8.
5. **The speech or parse service failing, timing out, or the cap being reached after the audio was sent.** The person
   gets "couldn't read it — type it instead", the audio is still dropped, and no half-written batch survives.
   Covered by Task 7.

---

### Task 1: The capture slice — models, ports and pure rules

**Files:**
- Create: `packages/domain/src/capture/models.ts`, `packages/domain/src/capture/ports.ts`,
  `packages/domain/src/capture/rules.ts`, `packages/domain/src/capture/errors.ts`,
  `packages/domain/src/capture/index.ts`
- Test: `packages/domain/test/capture/rules.test.ts`

**Interfaces:**
- Consumes: `Actor`, `IsoDate`, `Period` from `../shared`; `Evidence` from `../duplicates`.
- Produces:
  - `type CaptureKind = 'expense' | 'yearly_bill'`
  - `interface ParsedEntry { readonly amountMinor: number | null; readonly itemId: string | null; readonly yearLineId: string | null; readonly kind: CaptureKind; readonly txnDate: IsoDate; readonly merchant: string | null; readonly note: string; readonly heard: string; readonly confidence: { readonly amount: number; readonly item: number } }`
  - `interface ParseContext { readonly items: readonly { id: string; name: string; group: string }[]; readonly yearLines: readonly { id: string; name: string; plannedMinor: number; paidMinor: number; dueMonth: number | null }[]; readonly today: IsoDate; readonly currencyCode: string; readonly minorUnits: number }`
  - `interface CaptureBatch { readonly id: string; readonly familyId: string; readonly createdBy: string; readonly transcript: string; readonly sttModel: string; readonly parseModel: string; readonly entries: readonly CaptureEntry[]; readonly createdAt: Date; readonly resolvedAt: Date | null }`
  - `CaptureEntry` = `ParsedEntry` plus `readonly id: string` and `readonly dropped: boolean`
  - `SpeechToText`, `ExpenseParser`, `CaptureGateway`, `UsageGateway` (exact signatures given in Tasks 4, 3, 6 and 11
    respectively; declare them here to match)
  - `function needsAttention(entry: ParsedEntry): boolean`
  - `function splitByKind(entries): { expenses, bills }`
  - `CaptureNotUnderstoodError`, `CaptureCapReachedError`, `NotYourBatchError`

- [ ] **Step 1: Write the failing tests** in `packages/domain/test/capture/rules.test.ts`

```ts
test('an entry with no amount needs attention', () => expect(needsAttention({ ...entry, amountMinor: null })).toBe(true));
test('an entry with no item needs attention', () => expect(needsAttention({ ...entry, itemId: null })).toBe(true));
test('low amount confidence needs attention', () => expect(needsAttention({ ...entry, confidence: { amount: 0.4, item: 0.9 } })).toBe(true));
test('low item confidence needs attention', () => expect(needsAttention({ ...entry, confidence: { amount: 0.9, item: 0.4 } })).toBe(true));
test('a clear entry does not', () => expect(needsAttention(entry)).toBe(false));
test('splitByKind keeps bills out of the spending list', () => { const { expenses, bills } = splitByKind([entry, billEntry]); expect(expenses).toEqual([entry]); expect(bills).toEqual([billEntry]); });
```

The confidence floor is **0.6** for both fields; put that value in `rules.ts` as a named constant, not inline.

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm test packages/domain/test/capture/rules.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the models, ports, errors and rules**

Ports are declared here as empty-bodied interfaces with the exact signatures named in Tasks 3, 4 and 6; the adapters
come later. `index.ts` re-exports, matching the other slices.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `pnpm test packages/domain/test/capture/rules.test.ts` → PASS
Run: `pnpm typecheck` → clean

- [ ] **Step 5: Commit**

```bash
git add packages/domain/src/capture packages/domain/test/capture
git commit -m "feat(capture): the capture slice's models, ports and rules"
```

---

### Task 2: The Miscellaneous item

Voice needs somewhere to put an expense that matches nothing in the plan (spec §5). The family's plan has no such
item, and voice must never create one itself, so it is created once, up front.

**Files:**
- Create: `packages/domain/src/plan/use-cases/ensure-miscellaneous-item.ts`
- Modify: `packages/domain/src/plan/index.ts`, `apps/web/src/composition/plan.ts`
- Test: `packages/domain/test/plan/ensure-miscellaneous-item.test.ts`

**Interfaces:**
- Consumes: `PlanGateway` from `../ports`, `IdGenerator`, `Clock`.
- Produces: `class EnsureMiscellaneousItemUseCase { execute(command: { familyId: string }): Promise<{ itemId: string }> }`,
  and `makeEnsureMiscellaneousItemUseCase(db?)`.

- [ ] **Step 1: Write the failing tests**

```ts
test('creates a Miscellaneous item with a zero monthly plan, in its own group', ...);
test('is idempotent — a second call returns the same item id and creates nothing', ...);
test('the item is not archived and appears in the item list for matching', ...);
```

Exact values: group name `Miscellaneous`, item name `Miscellaneous`, monthly planned amount `0`. Both strings come
from `messages/en.json`.

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm test packages/domain/test/plan/ensure-miscellaneous-item.test.ts` → FAIL

- [ ] **Step 3: Implement the use case and wire it**

Called from `capture-voice` (Task 7) before building the `ParseContext`, so the parser can always choose it.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `pnpm test packages/domain/test/plan` → PASS

- [ ] **Step 5: Commit**

```bash
git add packages/domain/src/plan packages/domain/test/plan apps/web/src/composition/plan.ts apps/web/messages/en.json
git commit -m "feat(plan): a Miscellaneous item for spending that matches no plan line"
```

---

### Task 3: The OpenAI parse adapter

**Files:**
- Create: `apps/web/src/adapters/capture/openai-expense-parser.ts`,
  `apps/web/src/adapters/capture/parse-prompt.ts`
- Test: `apps/web/test/unit/adapters/capture/openai-expense-parser.test.ts`

**Interfaces:**
- Consumes: `ExpenseParser`, `ParseContext`, `ParsedEntry` (Task 1).
- Produces: `class OpenAiExpenseParser implements ExpenseParser` with
  `constructor(private readonly fetchJson: FetchJson, private readonly model: string)`, where `FetchJson` is a
  narrow injected function type — **not** an OpenAI SDK client — so the test stubs it with no network.
  `ExpenseParser.parse(transcript: string, context: ParseContext): Promise<readonly ParsedEntry[]>`.
  Also `buildParsePrompt(context: ParseContext): { system: string; schema: object }`.

- [ ] **Step 1: Write the failing tests**

```ts
test('sends the family item list and the open bill lines in the system prompt', ...);
test('asks for strict structured output with the entry schema', ...);
test('maps a returned expense row to a ParsedEntry with amountMinor in paise', ...);
test('a Tamil number word amount comes back as minor units', async () => { /* stub returns amount_minor 20000 for "irunooru rubaai" */ expect(entries[0].amountMinor).toBe(20000); });
test('an unheard amount maps to null, not zero', ...);
test('a row naming a yearly bill maps to kind yearly_bill with its yearLineId', ...);
test('a refusal or unparseable response throws CaptureNotUnderstoodError', ...);
test('a quantity is never read as the amount', ...);        // "chicken boneless half kg 250" → 25000, note keeps "half kg"
test('a leading count is a hint, not a rule', ...);          // "three entries" + four rows parsed → four entries returned
```

Review Focus 3 is the Tamil-number test, plus an assertion that `heard` keeps the spoken words ("irunooru rubaai")
and `note` does not become the item name.

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm test apps/web/test/unit/adapters/capture/openai-expense-parser.test.ts` → FAIL

- [ ] **Step 3: Implement `buildParsePrompt` and `OpenAiExpenseParser`**

The prompt carries the rules from spec §4.2 verbatim: rupees always, Tamil number words (*nooru* 100, *irunooru*
200, *aayiram* 1,000) in Tamil script or romanised, a quantity is never an amount, never invent an amount or a date,
a leading count is a hint only, confidence per field. Keep the system prompt and item list as a **stable prefix** so
OpenAI's prompt caching applies (spec §12). Use OpenAI structured outputs with a strict JSON schema; confirm the
exact call shape against the current API docs at build time.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `pnpm test apps/web/test/unit/adapters/capture` → PASS

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/adapters/capture apps/web/test/unit/adapters/capture
git commit -m "feat(capture): OpenAI parse adapter turning a transcript into entries"
```

---

### Task 4: The two speech adapters

**Files:**
- Create: `apps/web/src/adapters/capture/openai-speech-to-text.ts`,
  `apps/web/src/adapters/capture/sarvam-speech-to-text.ts`
- Test: `apps/web/test/unit/adapters/capture/speech-to-text.test.ts`

**Interfaces:**
- Produces: both implement
  `SpeechToText.transcribe(audio: Uint8Array, mimeType: string, options: { languages: readonly string[] }): Promise<{ text: string; model: string; seconds: number }>`,
  each taking an injected `FetchJson`-style function so the tests need no network.
  Also `maxClipSeconds(provider: 'openai' | 'sarvam'): number` → `60` / `30`.

- [ ] **Step 1: Write the failing tests**

```ts
test('OpenAI adapter calls gpt-transcribe and passes both languages', ...);   // languages: ['ta', 'en']
test('OpenAI adapter returns the text and the model it used', ...);
test('Sarvam adapter calls Saaras with the audio and returns its text', ...);
test('Sarvam adapter rejects a clip longer than 30 seconds with a clear error', ...);
test('neither adapter keeps the audio buffer after returning', ...);           // asserts no retained reference
test('a service error throws CaptureNotUnderstoodError and includes no audio or transcript in the message', ...);
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm test apps/web/test/unit/adapters/capture/speech-to-text.test.ts` → FAIL

- [ ] **Step 3: Implement both adapters**

OpenAI: model `gpt-transcribe`, `languages: ['ta', 'en']` (plural — do not also send `language`). Sarvam: Saaras,
whatever version the account serves; record the version string in the returned `model`.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `pnpm test apps/web/test/unit/adapters/capture` → PASS

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/adapters/capture apps/web/test/unit/adapters/capture
git commit -m "feat(capture): OpenAI and Sarvam speech-to-text adapters behind one port"
```

---

### Task 5: The comparison script — and the owner's gate

This is the gate in spec §3. Nothing after it is wasted if Tamil fails, but the screens are not built until the
owner has read the result of the handful.

**Files:**
- Create: `scripts/voice-eval.ts`, `scripts/voice-eval.README.md`
- Modify: root `package.json` (a `voice-eval` script)

**Interfaces:**
- Consumes: both speech adapters (Task 4), `OpenAiExpenseParser` (Task 3), `ParseContext` built from a family in the
  dev database.
- Produces: a printed report, and a JSON file next to the recordings.

- [ ] **Step 1: Write the failing test** in `apps/web/test/unit/adapters/capture/eval-report.test.ts`

```ts
test('scores an amount right only on an exact minor-unit match', ...);
test('scores an item right only when the item id matches the expected one', ...);
test('reports per service and per parse model, with cost per clip', ...);
test('a clip with no expected answers is reported as unscored, not as a failure', ...);
```

Only the pure scoring/report function is tested. The script's I/O is not.

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm test apps/web/test/unit/adapters/capture/eval-report.test.ts` → FAIL

- [ ] **Step 3: Implement the scoring function and the script**

The script loads **both** `.env.local` files (repo root and `apps/web`), reads a folder of audio plus an
`expected.json` beside it, and runs every clip through `{ openai, sarvam } × { gpt-6.1-terra, gpt-6-luna }`. It
prints, per clip: what each service heard, the entries each parse produced, amount-right and item-right, and the
cost. The recordings folder is passed as an argument and **must be outside the repo**; the script refuses a path
inside it.

- [ ] **Step 4: Run the tests and a dry run**

Run: `pnpm test apps/web/test/unit/adapters/capture` → PASS
Run: `pnpm typecheck && pnpm lint` → clean

- [ ] **Step 5: Commit**

```bash
git add scripts/voice-eval.ts scripts/voice-eval.README.md package.json apps/web/test/unit/adapters/capture
git commit -m "feat(capture): the Tamil/English speech comparison script"
```

- [ ] **Step 6: STOP — hand to the owner**

Ask the owner for the handful of recordings and the expected answers (spec §3.2), run the script, and show the
report. **The owner chooses the service**; set `STT_PROVIDER` and `STT_API_KEY` to the winner. Do not start Task 6
until that choice is made, because it fixes the recording limit (60 s or 30 s) that Task 10 builds against.

---

### Task 6: The staging store

**Files:**
- Create: `packages/db/migrations/0005_stage_2_capture.sql`,
  `apps/web/src/adapters/capture/drizzle-capture-gateway.ts`
- Modify: `packages/db/src/schema.ts`
- Test: `apps/web/test/integration/adapters/capture/drizzle-capture-gateway.test.ts`

**Interfaces:**
- Produces: `CaptureGateway` with
  `create(batch: CaptureBatch): Promise<void>`,
  `find(familyId: string, id: string): Promise<CaptureBatch | undefined>`,
  `listWaiting(familyId: string): Promise<readonly CaptureBatch[]>` (unresolved, oldest first, any creator),
  `resolve(familyId: string, id: string, at: Date): Promise<boolean>` (false if already resolved — the guard against
  a double confirm).

- [ ] **Step 1: Write the failing integration tests**

```ts
test('a batch round-trips with its entries, including a null amount and a null item', ...);
test('listWaiting returns only unresolved batches, oldest first, across both members', ...);
test('resolve returns true once and false on a second call', ...);
test('a batch is scoped to its family — another family never sees it', ...);
```

The null-amount test is the reason this store exists: `transactions.amount_minor` is `NOT NULL CHECK > 0`.

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm test:integration apps/web/test/integration/adapters/capture` → FAIL

- [ ] **Step 3: Write the migration and the adapter**

`capture_batches` (id, family_id, created_by, transcript, stt_model, parse_model, created_at, resolved_at) and
`capture_entries` (id, batch_id, family_id, amount_minor **nullable**, item_id nullable, year_line_id nullable,
kind, txn_date, merchant, note, heard, confidence jsonb, dropped boolean). Family-scoped guards and indexes follow
`0001_guards.sql`. Generate with `pnpm --filter @nestwise/db generate`, then apply with `pnpm migrate`.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `pnpm migrate && pnpm test:integration apps/web/test/integration/adapters/capture` → PASS

- [ ] **Step 5: Commit**

```bash
git add packages/db apps/web/src/adapters/capture apps/web/test/integration/adapters/capture
git commit -m "feat(capture): staging tables for spoken entries waiting to be checked"
```

---

### Task 7: `capture-voice` — listen, understand, stage

**Files:**
- Create: `packages/domain/src/capture/use-cases/capture-voice.ts`,
  `apps/web/app/api/v1/capture/voice/route.ts`,
  `apps/web/src/composition/capture.ts`,
  `packages/api-contract/src/capture.ts`
- Modify: `packages/api-contract/src/index.ts`
- Test: `packages/domain/test/capture/capture-voice.test.ts`,
  `apps/web/test/integration/api/capture-voice.test.ts`

**Interfaces:**
- Consumes: `SpeechToText`, `ExpenseParser`, `CaptureGateway`, `UsageGateway`, `EvidenceGateway`,
  `EnsureMiscellaneousItemUseCase` (Task 2), `PlanGateway`, `YearPlanGateway`, `FamilyGateway`, `Clock`, `IdGenerator`.
- Produces: `class CaptureVoiceUseCase { execute(command: { actor: Actor; audio: Uint8Array; mimeType: string }): Promise<CaptureBatch> }`
  and `POST /api/v1/capture/voice` (multipart), returning the batch for the review screen.

- [ ] **Step 1: Write the failing tests** (domain, with fakes)

```ts
test('a Viewer may not capture', ...);                                  // assertCan(actor, 'record_expense')
test('transcribes, parses, and stores one batch with an evidence row of kind voice', ...);
test('the audio is not passed to the gateway or the evidence row — only the transcript', ...);
test('a recording with no expenses throws CaptureNotUnderstoodError and stores no batch', ...);   // Review Focus 2
test('the cap being reached throws CaptureCapReachedError and nothing is stored', ...);           // Review Focus 5
test('a speech service failure stores no batch and leaks no transcript into the error', ...);     // Review Focus 5
test('the Miscellaneous item is in the parse context', ...);
test('the parse context carries only this family\'s items and open year lines', ...);
test('entries default to today in the family time zone', ...);
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm test packages/domain/test/capture/capture-voice.test.ts` → FAIL

- [ ] **Step 3: Implement the use case, the Zod contract, the wiring and the route**

Order inside the use case: permission → cap → rate limit → transcribe → **drop the audio** → parse → build the batch
→ write batch + evidence in one unit of work. The route sets `export const maxDuration` explicitly (nothing in
`apps/web` configures it today) and rejects a clip over `maxClipSeconds(provider)`.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `pnpm test packages/domain/test/capture && pnpm test:integration apps/web/test/integration/api/capture-voice.test.ts` → PASS

- [ ] **Step 5: Commit**

```bash
git add packages/domain/src/capture packages/domain/test/capture packages/api-contract apps/web/src/composition/capture.ts apps/web/app/api/v1/capture
git commit -m "feat(capture): capture-voice — transcribe, understand and stage a batch"
```

---

### Task 8: `confirm-voice-entries` — turn checked rows into real money

The riskiest task in the plan. Spec §6 and §8 govern it.

**Files:**
- Create: `packages/domain/src/capture/use-cases/confirm-voice-entries.ts`,
  `apps/web/app/api/v1/capture/voice/[id]/confirm/route.ts`
- Modify: `packages/domain/src/capture/index.ts`, `apps/web/src/composition/capture.ts`,
  `packages/api-contract/src/capture.ts`
- Test: `packages/domain/test/capture/confirm-voice-entries.test.ts`

**Interfaces:**
- Consumes: `CaptureGateway`, `RecordExpenseUseCase`, `YearPlanGateway`, `Clock`, `IdGenerator`.
- Produces: `class ConfirmVoiceEntriesUseCase { execute(command: { actor: Actor; batchId: string; entries: readonly ConfirmedEntry[] }): Promise<{ created: readonly Transaction[] }> }`
  where `ConfirmedEntry` is `{ id: string; amountMinor: number; itemId: string | null; yearLineId: string | null; kind: CaptureKind; txnDate: IsoDate; merchant: string | null; note: string; paidBy: string | null; dropped: boolean }`.

- [ ] **Step 1: Write the failing tests**

```ts
test('only the batch creator may confirm — the other adult gets NotYourBatchError even as an Admin', ...);
test('an entry with no amount cannot be confirmed', ...);
test('a bill row is recorded as an allocation against the yearly item carrying its plan_year', ...);
test('paying a bill by voice leaves the pot, the line status and the forecast identical to the typed path', ...);
test('paying 1400 against a 1500 bill leaves 100 owed and the line part_paid', ...);   // must NOT match mark-year-line-done
test('a Member may record a bill payment — no path reaches edit_plan', ...);
test('a bill already fully paid is rejected, not counted twice', ...);                 // Review Focus 4
test('a bill line from another year is rejected', ...);                                // Review Focus 4
test('two rows of the same batch with the same amount raise no duplicate question about each other', ...); // Review Focus 1
test('a dropped row writes nothing', ...);
test('confirming twice creates the transactions once', ...);                           // resolve() guard
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm test packages/domain/test/capture/confirm-voice-entries.test.ts` → FAIL

- [ ] **Step 3: Implement the use case, the contract and the route**

Each confirmed row goes through the existing `RecordExpenseUseCase` with `captureMethod: 'voice'`, so allocations,
rules, activity rows and the duplicate check are identical to typing. A bill row is the same call, with the
allocation's item being the yearly item and `plan_year` set. **Review Focus 1:** pass the ids already created in
this batch so `findDuplicateCandidates` excludes them — follow the pattern Stage 1b used to exclude an outbox
entry from matching itself. Mark the batch resolved last; `resolve()` returning false means someone already
confirmed it, and the use case returns what was created rather than writing again.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `pnpm test packages/domain/test/capture && pnpm test:integration` → PASS

- [ ] **Step 5: Commit**

```bash
git add packages/domain/src/capture packages/domain/test/capture packages/api-contract apps/web/app/api/v1/capture
git commit -m "feat(capture): confirm spoken entries, including yearly bill payments"
```

---

### Task 9: Waiting batches in the Inbox and on Home

**Files:**
- Modify: `packages/domain/src/duplicates/use-cases/list-inbox.ts`,
  `packages/domain/src/duplicates/models.ts`, `packages/domain/src/forecast/models.ts`,
  `packages/domain/src/forecast/use-cases/*` (the Home summary), the Inbox screen and Home screen components
- Test: `packages/domain/test/duplicates/list-inbox.test.ts`, `packages/domain/test/forecast/*`

**Interfaces:**
- Produces: `InboxEntry` becomes a union of the existing duplicate entry and
  `{ kind: 'capture'; batch: CaptureBatch; mine: boolean }`; `HomeCard` gains `'capture'`.

- [ ] **Step 1: Write the failing tests**

```ts
test('a waiting batch appears in the Inbox for its creator with mine true', ...);
test('a waiting batch appears for the other adult with mine false', ...);
test('a resolved batch does not appear', ...);
test('Home shows the capture card only while a batch is waiting', ...);
test('existing duplicate questions are unchanged by the new source', ...);
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm test packages/domain/test/duplicates packages/domain/test/forecast` → FAIL

- [ ] **Step 3: Implement**

`ListInboxUseCase` gains a `CaptureGateway` and merges `listWaiting` into its result, oldest first across both
sources. The screen shows another person's batch read-only, labelled with whose it is; `mine: false` hides the
confirm control. No existing duplicate behaviour changes.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `pnpm test` → PASS

- [ ] **Step 5: Commit**

```bash
git add packages/domain/src/duplicates packages/domain/src/forecast packages/domain/test apps/web/app apps/web/messages/en.json
git commit -m "feat(capture): waiting voice batches show in the Inbox and on Home"
```

---

### Task 10: The recording button and the review screen

**Files:**
- Create: `apps/web/src/client/voice-recorder.ts`, the record screen and the review screen components
- Modify: the Home screen (the button), `apps/web/messages/en.json`
- Test: `apps/web/test/unit/client/voice-recorder.test.ts`, `apps/web/test/e2e/voice.spec.ts`

**Interfaces:**
- Consumes: `POST /api/v1/capture/voice` and the confirm route (Tasks 7–8).
- Produces: `startRecording(options: { maxSeconds: number; silenceStopMs: number }): Promise<Recording>` with
  `stop()` and `onLevel`.

- [ ] **Step 1: Write the failing tests**

```ts
test('tap starts and a second tap stops', ...);
test('it stops itself at the limit', ...);                       // 60 on OpenAI, 30 on Sarvam
test('it stops itself after the silence window', ...);
test('with no signal it does not record and offers typing', ...);  // no stored recordings
```

E2E (`voice.spec.ts`, WebKit at phone width), with the capture route stubbed so no key is needed: record → review →
edit the highlighted row → confirm → the expenses appear in the month and the bill shows paid.

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm test apps/web/test/unit/client/voice-recorder.test.ts` → FAIL

- [ ] **Step 3: Implement the recorder and the two screens**

The review screen follows spec §8: transcript at the top, rows grouped **spending this month** then **yearly bills**,
each row showing amount, item, what was heard and the date; `needsAttention` rows highlighted; a bill row showing
the pot before and after, and "₹100 will still show as owed" when short; any field editable; any row removable; one
button to add all with the split in a summary line. Plain shadcn/ui.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `pnpm test && pnpm e2e` → PASS

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/client apps/web/app apps/web/test apps/web/messages/en.json
git commit -m "feat(capture): the recording button and the review screen"
```

---

### Task 11: Caps, usage and Settings

**Files:**
- Create: `apps/web/src/adapters/capture/drizzle-usage-gateway.ts`
- Modify: the Settings screen, `apps/web/messages/en.json`, env reading
- Test: `packages/domain/test/capture/usage.test.ts`, an integration test for the gateway

**Interfaces:**
- Produces: `UsageGateway` with `countThisMonth(familyId, period): Promise<{ voiceCount: number; voiceSeconds: number }>`
  and `record(familyId, period, seconds): Promise<void>`, over the existing `usage` table.

- [ ] **Step 1: Write the failing tests**

```ts
test('counts a capture against the family month', ...);
test('at CAP_VOICE_PER_MONTH the use case throws CaptureCapReachedError', ...);
test('a family in UNCAPPED_FAMILY_IDS is never capped', ...);
test('Settings shows this month\'s count against the cap', ...);
```

`CAP_VOICE_PER_MONTH` defaults to **400**.

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm test packages/domain/test/capture/usage.test.ts` → FAIL

- [ ] **Step 3: Implement**

At the cap the button explains the limit and typing keeps working (spec §9).

- [ ] **Step 4: Run the tests to verify they pass**

Run: `pnpm test && pnpm test:integration` → PASS

- [ ] **Step 5: Commit**

```bash
git add apps/web packages/domain .env.example
git commit -m "feat(capture): monthly voice cap, usage counting and the Settings display"
```

---

### Task 12: Bring the documents up to date

**Files:**
- Modify: `docs/NestWise_TRD.md` (§3, §9, §10.2, §10.3, §11), `docs/NestWise_PRD.md` (§6.11, §8 decision 5),
  `.env.example`, `apps/web/.env.example`, `docs/RUNBOOK.md`, `docs/PROGRESS.md`

- [ ] **Step 1: Apply every row of spec §12**

Each row is a stated correction with a stated replacement. The TRD §10.2 rewrite is the largest: it is currently
written entirely for Anthropic and must describe OpenAI structured outputs, OpenAI's own refusal handling, the
`gpt-6.1-terra` default and prefix caching.

- [ ] **Step 2: Add the runbook sections**

How the owner records clips and where they live (outside git); how to run `pnpm voice-eval`; which env names Vercel
needs for Stage 2.

- [ ] **Step 3: Verify**

Run: `pnpm lint` → clean. Re-read spec §12 and confirm every row is applied.

- [ ] **Step 4: Commit**

```bash
git add docs .env.example apps/web/.env.example
git commit -m "docs: Stage 2 corrections to the PRD, TRD, runbook and env examples"
```

---

### Task 13: Stage 2 acceptance and release

- [ ] **Step 1: Run everything**

Run: `pnpm typecheck && pnpm lint && pnpm test && pnpm test:integration && pnpm e2e`
Expected: all pass. Record the counts in the ledger.

- [ ] **Step 2: Confirm PRD §7 test 15 (AC-11)**

Several expenses from one recording, automated, plus the new bill-payment test from Task 8.

- [ ] **Step 3: Request a fresh whole-branch review**

Use `superpowers:requesting-code-review`. Fix what it finds; ledger what is deferred.

- [ ] **Step 4: Ask the owner before deploying**

Do not push or deploy without the owner's word.

- [ ] **Step 5: The stage exit (spec §3.2)**

Stage 2 is **not exited** until the owner's 30+ recordings meet the gate: **amount right ≥ 90%, item right ≥ 80%**.
Record the result in `docs/PROGRESS.md`.

---

### Task 14 (conditional): Long clips on Sarvam

**Build this only if Sarvam wins Task 5 and the owner wants the 60-second limit back.** Otherwise the limit stays
30 seconds on Sarvam and this task is dropped.

- [ ] **Step 1: Write the failing test** — a 45-second clip is split at a silence gap and the stitched text contains
      both halves with no word lost at the seam.
- [ ] **Step 2: Run it to verify it fails.**
- [ ] **Step 3: Implement `splitAtSilence(audio, maxSeconds)`** in the Sarvam adapter, decoding to PCM and cutting at
      the lowest-energy window near the limit.
- [ ] **Step 4: Run the tests, plus the eval on a deliberately long real clip.**
- [ ] **Step 5: Commit, and raise the client limit back to 60 s.**
