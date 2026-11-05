# NestWise Stage 2 — Voice: design

**Status:** approved by the owner (2026-11-05).
**Builds on:** Stage 1a and 1b, live at https://nestwise-alpha.vercel.app since 2026-11-03.
**Binding sources:** `docs/NestWise_PRD.md` (§5.3, §6.11, §7 test 15, §8) and `docs/NestWise_TRD.md` (§3, §5.6, §9,
§11, §14.3). This document records what the owner decided on top of them, and **corrects them where they are now out
of date** (§12). Where it is silent, the PRD and TRD apply. Code structure follows the project skills
`hexagonal-architecture` and `clean-architecture`.

---

## 1. Intent

The owner's own words for the problem:

> "Every time after an expense happened, making an entry into the application is very difficult — it's time
> consuming. I need to open, I need to type, I need to select the category, for each and every item. Instead I can
> tell it in voice, English or Tamil… It should recognize the category, create an expense ledger. I don't need to
> keep track of and select every category."

The slow part is not the thinking, it is the **sorting**: picking the right item for every line. Typing is already
fast in Stage 1a — amount, item, save. What voice removes is the hunting.

**The moment it is used:** standing in the shop, or at home just afterwards, right after money has gone out.

**What is said:** a whole batch in one go, not one purchase at a time. Tamil, English, or the two mixed in one
sentence. Sometimes with a count up front as a hint ("three entries today").

**What happens next, in the owner's words:** "I'll definitely check every time." So the review screen is the main
path, not an exception, and nothing reaches the family's totals without a tap.

---

## 2. Goals, non-goals, anti-goals

**Goals**

- Speaking a batch of expenses and confirming them takes less effort and less thinking than typing one of them.
- Tamil, English and mixed speech all work, including Tamil number words and romanised Tamil.
- One recording can produce several expenses (PRD §7 test 15 / AC-11).
- A yearly bill can be ticked off by voice, and doing so moves the pot and the forecast exactly as it does by hand.
- Nothing is counted until the family taps to add it.
- The speech service is chosen on **evidence from this family's own recordings**, not on a vendor's claim.

**Non-goals**

- Savings (gold, RD) and the monthly pot deposit by voice. The owner's decision: those already take one tap on the
  1st-of-month checklist, at a moment the family is sitting with the app, so voice adds nothing.
- Voice with no signal. The owner confirmed he normally has a signal where he shops.
- Refunds by voice. Typed, as today.
- Editing or deleting an existing expense by voice.
- Live or streaming transcription.
- Knowing *which* adult spoke from the audio. The signed-in person is the speaker.
- Receipt photos (Stage 3) and the visual design pass, which follows Voice.

**Anti-goals** (a failure even if it technically works)

- Speaking and confirming ends up slower, or more thinking, than typing the same expenses.
- An amount is invented, guessed or rounded. A number that was not heard clearly must come through as missing.
- A yearly bill is ticked off that was not actually paid. That moves the pot and the 12-month forecast, so it is the
  most expensive mistake on the screen.
- Audio survives anywhere after transcription.
- Any real recording or transcript reaches git.
- The family is interrupted in the shop with questions that could wait. Unconfirmed entries go to the Inbox
  (Stage 1b), which already exists for exactly this.

---

## 3. Step 1: choose the speech service (a gate, before any screens)

The owner's instruction: *"compare the best model and costs will decide on it for tamil language and english."*
Candidates are **OpenAI** and **Sarvam**. Google Chirp is dropped — the owner chose not to open a third account.

### 3.1 Verified facts (checked 2026-11-04 — the TRD's figures are stale)

**OpenAI**

- `gpt-transcribe` is the current recommended transcription model, about **$0.0045/minute**. It accepts `prompt`,
  `keywords`, and `languages` (plural), so Tamil *and* English can be declared together for one recording — which is
  exactly how this family speaks.
- `gpt-4o-transcribe`, `gpt-4o-mini-transcribe`, `whisper-1` and `gpt-4o-transcribe-diarize` are **all deprecated,
  shutting down 26 February 2027**. The TRD names `gpt-4o-transcribe`; do not build on it.
- Maximum file 25 MB. A 60-second iPhone recording is about 0.5 MB.
- No published Tamil accuracy figure, from OpenAI or from any independent benchmark.

**Sarvam**

- Saaras, about **₹0.49/minute**, billed per second. Their docs now default to **`saaras:v4`**; the TRD says v3. Use
  whatever is current on the account and record which version the comparison ran against.
- The quick REST endpoint takes recordings **under 30 seconds**; longer ones go through a batch route.
- An Indian company training on Indian languages, so the plausible favourite for Tamil — but with no independent
  benchmark either.

**The understanding step** (turning the transcript into expenses) runs on OpenAI whichever service listens. Checked
against OpenAI's pricing page on 2026-11-04: **`gpt-6.1-terra`** ($1.00 / $0.05 cached / $5.00 per 1M tokens) is the
default — flagship-tier at a tenth of the flagship price. **`gpt-6-luna`** ($0.10 / $0.01 / $0.50) is the cheap
alternative, and the eval in §3.2 reports both so the owner can see whether the cheap one is good enough on Tamil.
Model names move fast; the builder confirms them against the current docs at build time (TRD §10.2).

**Cost is not a deciding factor anywhere in this stage.** At the owner's stated volume (~150 notes a month, ~15
seconds each, ≈ 37 minutes, ≈ 1.5k input + 0.5k output tokens per parse):

| Piece | Cost a month |
| --- | --- |
| Transcription, either service | ≈ 20 cents |
| Understanding, `gpt-6.1-terra` | ≈ 60 cents |
| Understanding, `gpt-6-luna` | ≈ 6 cents |

So the whole feature runs at **well under a dollar a month** — about ₹70. The TRD's §10.3 estimate of $5–10 a month
assumed Anthropic Opus and is superseded. **Accuracy on Tamil decides this; cost does not.**

### 3.2 How the comparison runs

The owner chose a **handful first**, then the full set, so an hour of recording is not spent before we know Tamil
works at all.

1. **A handful: 5–6 recordings**, from both adults, including at least two hard Tamil ones (Tamil number words,
   background noise, mixed script). `scripts/voice-eval.ts` runs each clip through **both** services and then through
   the parse step, and prints, per clip: what each service heard, the expenses each parse produced, and the cost.
2. **The owner reads that and decides** whether to carry on, switch, or look wider.
3. **The full gate: 30+ recordings** from both adults, in real places (kitchen, market, car), with the correct answers
   written down by hand first. Pass mark, from PRD §8 decision 18: **amount right ≥ 90%, item right ≥ 80%.**
4. **If both services miss the gate on Tamil**, stop and reconsider the service before building further (PRD §6.11).
   Candidates to look at then: ElevenLabs Scribe, Google Chirp.

**The handful is the checkpoint inside the plan; the 30+ gate is Stage 2's exit criterion.** This matters for
sequencing, so it is stated plainly rather than left to be discovered:

- The eval cannot run at all until the two speech adapters, the parse port and the parse prompt exist. So those are
  built first, the handful runs, and the owner's decision at step 2 unblocks the screens.
- The 30+ set needs **both adults**, and the spouse has not been invited yet (`docs/PROGRESS.md`, "Waiting on you").
  Making it a mid-plan stop would idle the build on a task that has been open for days. It is therefore treated the
  way Stage 1a and 1b treat "use it for a full month": the work is finished, and the stage is not *exited* until the
  gate passes.
- **The handful may be the owner's voice alone** if the spouse is not yet set up. The 30+ set may not — a service
  that only hears one of them is the wrong service.

### 3.3 Practicalities

- **Recordings and expected answers stay outside git**, in a folder on the owner's machine. The runbook gets the path
  and an iPhone Voice Memos → folder recipe. Nothing in `.superpowers/` or the repo.
- **Keys, already in place:** `OPENAI_API_KEY` in the repo-root `.env.local`; `SARVAM_API_KEY` in
  `apps/web/.env.local`. The eval script loads **both** files, so the owner does not have to move either key.
  `STT_PROVIDER` and `STT_API_KEY` stay as the app's runtime pair, set to the winner once chosen.
- The eval script never runs in CI: it needs live keys and private audio.

---

## 4. What is said, and what it means

### 4.1 The owner's real examples (verbatim, use these as fixtures)

| Said | Should become |
| --- | --- |
| "Today expenses — KPN 250, chicken boneless 500, dress purchase 2000, cloud subscription 20" | 4 expenses: Groceries ₹250 (shop KPN), Non-veg ₹500, *no match* ₹2,000, Books & Cloud ₹20 |
| "pazham 200, kaaikari 300, tea 23, petrol 300" | 4 expenses: Fruits ₹200, Vegetables ₹300, Outside Food ₹23, Petrol ₹300 |
| "bike insurance 1500 paid" | 1 yearly bill payment: Bike Insurance ₹1,500 |
| "three entries today, KPN grocery one, chicken boneless two…" | A leading count, used as a hint only |

### 4.2 Rules the parse must follow

- **Amounts are always rupees.** The currency is never spoken and must never be asked for.
- **Tamil number words** are understood (*nooru* = 100, *irunooru* = 200, *aayiram* = 1,000), in Tamil script or
  romanised.
- **A quantity is not an amount.** "chicken boneless half kg 250" is ₹250 with "half kg" kept in the note. The
  quantity must never become the amount.
- **Never invent an amount.** If a number was not heard clearly, the entry comes through with the amount **missing**
  and low confidence, and the review screen will not let it be added until it is filled in.
- **A leading count is a hint, not a rule.** If the speaker says "three" and four expenses are heard, show four.
- **Confidence is reported per field** (amount, item), so the screen knows what to highlight.

### 4.3 What each parsed entry carries

Amount; item; date; shop; note; **kind** — everyday spending or a yearly bill payment; and a confidence score per
field.

- **Date:** today unless said otherwise. "Yesterday" and a day of the week are understood. A date is **never
  invented** — this is the same rule the year plan already follows for undated bills.
- **Who paid:** the signed-in speaker, changeable on the row.
- **Shop:** kept whenever one is named ("KPN").

---

## 5. Matching to the family's plan

The parse is given the family's **live** lists: this month's monthly items (id, name, group) and this year's **open**
yearly bill lines. It never guesses from a hard-coded list.

**When nothing fits.** The owner's decision, in his words: *"this is not a planned one, this is one of this month
alone it will happen, so maybe miscellaneous would be the correct one."* So an unmatched expense is offered as
**Miscellaneous**, highlighted as a question — never chosen silently, and never forced into a near-miss item like
Spouse's Maintenance.

He first said it should "try to create a new category", then settled on Miscellaneous once it was clear that every
plan item carries a monthly planned amount and a one-off dress purchase is not something to plan for every month.
That is the decision: **voice never creates a plan item on its own.** If the owner decides afterwards that the
spending is recurring, he adds the item himself in Templates, as he does today.

**Miscellaneous does not exist yet.** The family's plan (`docs/NestWise_Sample_Budget_and_Expense_Data.md`) has no
such item. Stage 2 creates it once, with a **zero monthly planned amount**, so spending against it shows plainly as
unplanned and does not quietly inflate the plan.

---

## 6. Yearly bills through voice

The owner asked for this: *"yes that would be great to have option."* It is the riskiest row on the screen, so it is
treated differently throughout.

**How a bill payment is actually recorded.** Confirming a bill row **records an expense whose allocation carries the
yearly item and its `plan_year`** — the same thing the typed Add-expense path does today. That is what moves the pot:
`potBalance` is `opening + deposits + extra_in − taken_out − yearly spend`
(`packages/domain/src/pot/models.ts`), where yearly spend is the sum of confirmed allocations against yearly items.
The line's status then **derives itself**: `isPaid` returns paid once paid ≥ planned, and `part_paid` while
0 < paid < planned (`packages/domain/src/year-plan/models.ts`).

**Voice must not call `mark-year-line-done`.** That use case writes only the line's *state*, moves no money, and
documents itself as "nothing more is owed on the line, **whatever was paid**" — `remainingMinor` returns 0 for a
closed line. So on "bike insurance 1400 paid" against a ₹1,500 line it would quietly drop ₹100 out of the 12-month
forecast. It also requires `edit_plan`, which is admin-only. Recording the expense needs only `record_expense`, which
every Member has, so the member+ rule in §10 holds with no special case.

- Bill lines are matched against **this year's open** lines only.
- **The row shows the pot before and after** ("₹1,47,667 → ₹1,46,167"), so the consequence is visible before the tap.
- **A short payment leaves the rest owed.** The row says so in words — "₹100 will still show as owed" — and the line
  stays part-paid. This matches the year-end rule that a part-paid bill carries only what is left, and the owner's
  standing principle that nothing disappears on its own.
- **Closing a line for less than was planned stays a deliberate admin act** in the year plan, where it is today.
  Voice never does it, because voice cannot know that no more is owed.
- **A payment larger than planned** is recorded as spoken and the line reads paid. No clamping.
- **A line already paid** is shown as already paid and is not offered again.

---

## 7. Recording and sending

- **Tap to start, tap to stop** — the owner's choice over press-and-hold, because his example takes about 15 seconds
  to say and he is often holding shopping. It stops itself at **60 seconds** and after a few seconds of silence, so
  it cannot sit recording forgotten.
- A running timer and a level indicator while recording, so it is obvious it is listening.
- `MediaRecorder`; iPhone produces `audio/mp4`, about 0.5 MB a minute. Sent as `multipart/form-data`.
- **One button, on Home.**
- **No signal:** the button says it needs a signal and offers typing instead. No recordings are stored for later.
- **The 60-second limit stands**, and does not bend to a vendor's limit. Sarvam's quick endpoint stops at 30 seconds,
  so if Sarvam wins, its adapter **splits a longer clip at a silence gap and stitches the text back together** rather
  than submitting to their batch route and polling inside a request the user is waiting on. The eval must include one
  deliberately long clip so this is proven before it ships, not after.
- `maxDuration` is set explicitly on the capture route. Nothing in `apps/web` configures it today, so the Vercel
  Hobby default would apply to a request that waits on two network calls.
- If stitching turns out to lose words at the seam, the limit drops to 30 seconds and the owner is told. 60 stays the
  intent.

---

## 8. The review screen

This is the main path — the owner checks every time, right after speaking.

- The **transcript sits at the top** ("You said: …"), so a bad hearing is obvious at a glance.
- Rows are **grouped: spending this month, then yearly bills**, because only the second kind moves the pot.
- Each row shows the amount, the item, what was heard, and the date.
- **Uncertain or missing fields are highlighted.** A row with no amount cannot be added until it is filled in.
- Any field can be edited in place; any row can be removed. Editing one row never means retyping the others.
- **One button adds them all**, with a summary line showing the split ("4 expenses ₹2,770 · 1 bill ₹1,500").
**Where entries live before they are confirmed.** In a **staging store of their own** — new `capture_batches` and
`capture_entries` tables — written server-side before the screen is shown, so closing the app mid-review loses
nothing. **Not** as `pending` transactions, which is what TRD §9 step 4 says and is wrong on two counts:

- `transactions.amount_minor` is `NOT NULL CHECK > 0` and `allocations.item_id` is `NOT NULL`
  (`packages/db/migrations/0000_init.sql`). An entry with an unheard amount or no item — exactly the entries that
  most need to survive the review — **cannot be a transaction at all.**
- `status = 'pending'` is already taken. In Stage 1b it means "waiting for a duplicate answer", and
  `list-inbox`, `release-matches` and `restore-expense` all read it that way. Reusing it would quietly change the
  meaning of code that is live and working.

So: **transactions are written at confirm**, through the existing `record-expense` use case, so allocations, rules,
activity rows and the duplicate check are identical to typing. The staging store never reaches a total.

- **An abandoned batch stays in the staging store and surfaces in the Inbox**, as a second source alongside duplicate
  questions, with a Home card. PRD §4 already defines the Inbox as the place voice entries wait from Stage 2, so this
  is the intended home — but it does mean the Inbox query and card gain a second source, which is new work on
  Stage 1b code rather than a free ride.
- **Only the person who spoke a batch may confirm it** (the owner's decision). Nobody else heard the words, so
  nobody else can judge whether the app wrote them down correctly — and this follows the Stage 1b precedent, where
  the offline outbox was made per person in the review fixes. The other adult **sees** that a batch is waiting, with
  whose it is, so nothing looks lost; they cannot act on it. There is no admin override. A batch waits until its
  speaker confirms or discards it, and never expires on its own.
- Confirmed voice entries then go through the **existing duplicate check**, so a voice entry and a typed entry for
  the same purchase still asks once.

---

## 9. Privacy, caps and cost

- **Audio is processed in memory and dropped** the moment transcription returns. It is never written to disk, to
  Storage, or to a log. (PRD §8 decision 14; TRD §7.)
- **The transcript is kept** as an `evidence` row of kind `voice`, shown on the expense as proof.
- **The parse prompt carries only this family's own item names**, today's date, the currency and its minor unit.
  Nothing from another family.
- **`CAP_VOICE_PER_MONTH` is raised from 100 to 400.** The TRD's 100 would bite at the owner's stated ~150 a month.
  The owner's own family is also listed in `UNCAPPED_FAMILY_IDS`.
- Usage shows in Settings. At the cap the button explains why, and typing keeps working.

---

## 10. Where the code goes

Per `hexagonal-architecture` and `clean-architecture`, following the existing slices
(`packages/domain/src/<slice>/{ports.ts,use-cases/}` with adapters in `apps/web/src/adapters/<slice>/`):

- **New domain slice `packages/domain/src/capture/`.**
- **Ports:** `SpeechToText` (`transcribe(audio, mime, { languages }) → { text, model, seconds }`), `ExpenseParser`
  (`parse(transcript, context) → ParsedEntry[]`), a `CaptureGateway` for the staging store, and the usage/cap gateway.
- **One migration** adding `capture_batches` and `capture_entries` (§8). Entries allow a null amount and a null item;
  transactions still do not.
- **Use cases:** `capture-voice` (role check `record_expense`, cap, rate limit, transcribe, parse, write the staging
  batch plus an evidence row, return it for review) and `confirm-voice-entries` (write the chosen rows through the
  existing `record-expense` use case — bill rows as an allocation against the yearly item and its `plan_year`, per
  §6 — then run the duplicate check and clear the batch). `confirm-voice-entries` additionally checks that the actor
  **is the batch's creator**, not merely that they hold `record_expense` (§8). This is a rule the Inbox does not have
  today: `resolve-duplicate` lets anyone with `record_expense` answer, so the new source needs its own check rather
  than inheriting the old one.
- **Adapters** in `apps/web/src/adapters/capture/`: an OpenAI speech adapter, a Sarvam speech adapter, and an OpenAI
  parse adapter, selected by `STT_PROVIDER` and `AI_MODEL`. **No provider SDK type may appear in
  `packages/domain`** — the two services must be interchangeable behind the port, since choosing between them is the
  whole point of §3.
- **Routes:** `POST /api/v1/capture/voice` (multipart) and a confirm route alongside it, matching the existing
  `/api/v1/...` shape.
- **`scripts/voice-eval.ts`** for the comparison in §3.

---

## 11. How it is checked

- **PRD §7 test 15 (AC-11):** several expenses from one recording, automated.
- **New test:** a bill paid by voice leaves the pot balance, the line's status and the 12-month forecast identical to
  recording the same payment through the typed Add-expense path.
- **New test:** a bill paid short by voice leaves the remainder owed and the line part-paid — it must *not* match
  `mark-year-line-done`, which would zero the remainder.
- **New test:** an entry with an unheard amount can sit in the staging store, and cannot be confirmed.
- **New test:** an abandoned review leaves nothing in any total, and the entries appear in the Inbox.
- **New test:** a Member can record a bill payment by voice; no path in voice reaches `edit_plan`.
- **New test:** the other adult can see a waiting batch but cannot confirm it, even as an Admin.
- **Unit and integration tests use a fake `SpeechToText` and a fake parser**, so CI needs no key and no network.
- **One iPhone-size browser test** walking record → review → confirm with a stubbed transcript.
- **The quality gate** (§3.2) is the owner's, run on real recordings, outside CI.

---

## 12. Corrections to the PRD and TRD

These are wrong in the current documents and must be fixed when Stage 2 lands:

| Where | Says | Should say |
| --- | --- | --- |
| TRD §3 | Voice/receipt understanding uses Anthropic Claude | OpenAI (already superseded by TRD §14.3 decision 3) |
| TRD §9 | `gpt-4o-transcribe` | `gpt-transcribe`; the 4o transcription models are deprecated, shutdown 26 Feb 2027 |
| TRD §9 | Sarvam Saaras v3 | Whatever is current on the account (`saaras:v4` as of today) |
| TRD §9, PRD §8 d.5 | Three-way test: Sarvam, Google Chirp, OpenAI | Two-way: OpenAI and Sarvam. Google dropped by the owner |
| TRD §9, PRD §6.11 | Press and hold to record | Tap to start, tap to stop; auto-stop at 60 s and on silence |
| TRD §11 | `CAP_VOICE_PER_MONTH = 100` | 400 |
| PRD §6.11 | Voice captures expenses | Voice also ticks a yearly bill off the year plan |
| TRD §9 step 4 | Voice creates `pending` transactions before review | A staging store; transactions at confirm (§8) |
| TRD §10.2 | Entirely Anthropic: `AI_MODEL` default `claude-opus-5-5`, `AI_EFFORT`, `client.messages.parse()` with Zod, `stop_reason: "refusal"` with the server-side-fallback beta | Rewrite for OpenAI: `AI_MODEL` default `gpt-6.1-terra`, OpenAI structured outputs with a strict JSON schema, OpenAI's own refusal/incomplete handling, prompt caching by keeping the system prompt and item list as a stable prefix. Any failure means "couldn't read it — type it instead" |
| TRD §10.3 | ≈ $5–10 a month | Well under $1 a month (§3.1) |
| `.env.example` | Missing `STT_PROVIDER`, `STT_API_KEY`, `SARVAM_API_KEY`, `AI_MODEL`, `AI_EFFORT` | Add the names (names only), in both the root and `apps/web` copies |

---

## 13. Decisions I made, not the owner's

Flagged so the owner can overrule them while reading:

1. **Miscellaneous is created with a zero planned amount**, in its own group, rather than being folded into an
   existing group.
2. **Refunds stay out of voice** for Stage 2.
3. **A bill paid short leaves the remainder owed** and the line part-paid, rather than closing it (§6). Voice never
   closes a line.
4. **The cap goes to 400**, a round number above the owner's stated ~150.
5. **In-review entries get their own staging tables**, and transactions are written at confirm (§8).
6. **The eval script reads both `.env.local` files** so the owner need not move the Sarvam key.
7. **The 60-second recording limit stays**, with long clips split at a silence gap if Sarvam wins (§7).
8. **Voice never creates a plan item**, only ever offers Miscellaneous.
9. **`gpt-6.1-terra` is the default parse model**, with `gpt-6-luna` reported alongside it in the eval (§3.1).
10. **The 30+ recording gate is Stage 2's exit criterion**, not a stop in the middle of the build (§3.2).
11. **A waiting batch is visible to the whole family but actionable only by its speaker** (§8). The owner decided
    the speaker-only rule; making the batch visible rather than hidden is mine, so nothing appears lost.

---

## 14. Left to the builder

- The exact wording of the parse prompt and its JSON schema (structured outputs), and the keyword list fed to
  `gpt-transcribe`.
- The look of the recording screen and the level indicator. The visual design pass follows Voice, and the owner has
  already noted Home-screen display items to revisit then — do not gold-plate this now.
- Rate-limit numbers for the capture route.
- The format of the eval report, as long as it shows per clip what each service heard and whether amount and item
  came out right.
- Where the Miscellaneous item sits in the group ordering.
- Whether the confirm step is one route or two.
