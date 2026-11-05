# NestWise Design Stage — Look and Feel Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
> **REQUIRED for every task that touches server code** (Task 4 and the dev seed in Task 5): the project skills
> `hexagonal-architecture` and `clean-architecture` (`.claude/skills/`). **REQUIRED for every screen task** (3, 6–11):
> the `frontend-design:frontend-design` skill (the owner asked for it by name). This plan does not repeat either.

**Goal:** Every NestWise screen gets the approved "Silk and gold" look: a peacock-and-gold Home that says at a glance
whether the coming bills are covered, a floating bottom bar, iPhone-style page slides, and proper tablet and desktop
layouts.

**Architecture:**
- **Tokens:** colours, fonts and corner sizes become Tailwind v4 theme tokens in `globals.css`, with the two fonts
  loaded by `next/font`.
- **Rules:** small pure helpers in `apps/web/src/client/` decide the presentation rules: ring tone, bill status line,
  icon choice, tabs, Back target and greeting. Each has a unit test.
- **Frame:** shared frame components in `apps/web/src/components/`: the bar, the headers, Back, icons, sheet,
  skeleton, rings and month row.
- **Home data:** Home's few new figures are added to `GetHomeSummaryUseCase` in `packages/domain` from data the
  forecast and month summary already compute.
- **Screens:** each screen is then restyled in turn, keeping its data, behaviour and the wording the tests read.

**Tech Stack:** As Stage 2 (Next.js 16.4.3, React 19.3, TypeScript strict, Tailwind v4, next-intl, Serwist, Vitest,
Playwright WebKit at iPhone 15). New: `next/font/google` (Baloo Thambi 2, Mukta Malar), React `ViewTransition` with
Next `<Link transitionTypes>` (both in the installed versions). No new npm dependency; icons are inline SVG.

**Spec:** `docs/superpowers/specs/2026-11-05-nestwise-design-look-and-feel-design.md` (approved 2026-11-05). The Home
reference is `docs/superpowers/specs/2026-11-05-nestwise-design-home-mockup.html`; open it in a browser and scroll
inside the phone.

**Ledger:** `.superpowers/sdd/2026-11-05-nestwise-design/progress.md`. Stage 1a, 1b and 2 rulings still bind.

## Global Constraints

These apply to every task, on top of the earlier plans' Global Constraints (still binding).

- **Colours.** Use the tokens only, never hex in components:

  | Token | Hex |
  |---|---|
  | `peacock` | `#00566E` |
  | `peacock-deep` | `#003F52` |
  | `gold` | `#F2B233` |
  | `rani` | `#D61F69` |
  | `leaf` | `#0F7A49` |
  | `mist` | `#ECF3F4` |
  | `ink` | `#0F2A33` |
  | `muted` | `#557078` |
  | `line` | `#E3ECEE` |
  | `white` | `#FFFFFF` |

  Text on gold is ink; text on peacock, peacock-deep and rani is white.
- **Fonts.** Baloo Thambi 2 (600–800) for headings and every money amount; Mukta Malar (400–700) for other text. Money
  is always Baloo with tabular figures, including amounts inside sentences.
- **Type sizes on a phone:**

  | Role | Size |
  |---|---|
  | Hero amount | 46 px (₹ sign 26 px) |
  | Screen title | 22–28 px |
  | Section heading | 19–20 px |
  | Body | 15 px |
  | Secondary | 13.5 px |
  | Small labels | 11.5 px |

  Every text input is at least 16 px.
- **Corners:** cards 24 px, big action buttons 20 px, chips and month badges 16 px, pills fully round. Cards are white
  on mist with no border and at most a faint peacock-tinted shadow.
- **Touch targets:** at least 44 × 44 px.
- **Copy style:** no all-caps labels, no letter-spaced eyebrows, sentence case. No middle-dot (`·`) separators in new
  copy.
- **Colour never carries a status alone.** Every coloured status also has a word or an icon.
- **The temple border appears only** under the Home header and under the tab-root headers (Budgets, Bills,
  Activity). It never appears inside cards.
- **Empty states say what to do next** (spec §5.3). For example: "No expenses yet this month. Tap Add to log one."
- **`Money`** means `ReturnType<typeof moneyOf>` from `apps/web/src/http/page-session.ts`. Export that alias if it
  isn't exported already.
- **Motion:**
  - Going deeper slides in from the right, and Back slides out to the right.
  - Tab switches use a short fade.
  - Sheets slide up.
  - Presses shrink slightly.
  - Nothing else moves, apart from the recording pulse (Task 7).
  - With `prefers-reduced-motion: reduce`, all of it is instant.
- **Wording:** every string is in `apps/web/messages/en.json`, and none is written in a component. Keep every wording
  and `data-testid` the e2e test reads (`apps/web/test/e2e/core.spec.ts`): link names `Home` and `Add`, the heading
  `Add an expense`, labels `Amount` and `Item`, the button `Save`, the `Saved …` messages, `See the month`, and the
  test ids `pot-balance`, `home-voice`, `outbox-status`, `duplicate-question`, `line-<item name>`,
  `forecast-months`, `no-red`, and `voice-start` / `voice-expense-row` / `voice-confirm` / `voice-discard`. If a test
  must change, change it in the same task and say why in the ledger.
- **No changes to the money side:** the money rules, the forecast maths, roles, the offline outbox and reminders all
  stay as they are. The only domain change is Task 4's new Home fields.
- **The service worker still never precaches pages.** Fonts are static assets and must load with no signal.
- **The made-up data in Task 5 is FICTIONAL.** It lives only in `fixtures/` and the local dev database. It never goes
  into production data or into a production code path.
- **No dark mode** and no Tamil strings in this stage.
- **Commits:** one local commit per finished task, as in Stages 1a–2, with the message given. **Never push or deploy
  without the owner's word.**

## Review Focus

Inputs the spec implies but no spec line tests. Each has a test in the task that owns the code.

1. **Long names and big amounts at phone width.** The family's plan has "Household Electronics & Appliance Repairs"
   and "Health Insurance — In-laws", and amounts reach lakhs. Nothing may push the page sideways or cut off an amount.
   Covered by Task 3's no-sideways-scroll e2e check, run on every tab root.
2. **A spending group with a plan of ₹0 but some spending** (or one with neither). The ring must say "over" with the
   amount, never `NaN%` or `Infinity%`. Covered by Task 2's ring tests.
3. **Spending-alert levels the family changed**, for example `[50, 90, 100]`, or none at all. The gold "nearly used
   up" tone starts at the lowest level under 100; with no such level there is no gold. Covered by Task 2.
4. **A Viewer.** No Add button in the bar, no Speak/Scan/Type row, and Home still draws. Covered by Task 2's
   `tabsFor('viewer')` test and Task 6's Home step.
5. **Back with no history inside the app.** For example, a reminder notification opens `/year/2027` straight away.
   Back must go to that screen's tab root, never out of the app or to a blank page. Covered by Task 2's
   `backTarget` tests.

---

### Task 1: The look's foundations — tokens, fonts, iPhone settings, app icon

**Files:**
- Modify: `apps/web/app/globals.css` (Tailwind `@theme` tokens, base body style, a `money` utility)
- Modify: `apps/web/app/layout.tsx` (fonts, `themeColor`, `statusBarStyle`)
- Modify: `apps/web/app/manifest.ts`, `apps/web/app/pwa-icon/[size]/route.tsx`
- Modify: `apps/web/src/components/ui/card.tsx`, `button.tsx`, `input.tsx` (restyled to the tokens)
- Test: `apps/web/test/unit/manifest.test.ts`

**Interfaces:**
- Produces:
  - Tailwind colour utilities `bg-peacock`, `text-ink` and the rest for every token in Global Constraints.
  - `font-display` (Baloo) and `font-body` (Mukta).
  - `rounded-card` (24 px), `rounded-action` (20 px) and `rounded-chip` (16 px).
  - A `money` utility class: display font, `tabular-nums lining-nums`.
  - `Card` and `Button` keep their current props. `Button` variants become `default` (peacock), `outline` (white,
    peacock text), `ghost` and `destructive` (rani).

- [ ] **Step 1: Write the failing test**

```ts
import manifest from '../../app/manifest';
test('the installed app uses peacock and mist', () => {
  expect(manifest()).toMatchObject({ theme_color: '#00566E', background_color: '#ECF3F4' });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `pnpm test apps/web/test/unit/manifest.test.ts` → FAIL (`#14532d`).

- [ ] **Step 3: Implement**

- **Fonts:** load `Baloo_Thambi_2` (weights 600, 700, 800) and `Mukta_Malar` (400, 500, 600, 700) from
  `next/font/google` with `variable: '--font-baloo'` / `'--font-mukta'`, subsets `latin` and `tamil`.
- **`layout.tsx`:**
  - `viewport.themeColor` becomes `#00566E`.
  - `appleWebApp.statusBarStyle` becomes `'black-translucent'`.
  - The body gets `bg-mist text-ink font-body`.
- **App icon:** redraw it as a gold temple-border band on peacock, keeping the same sizes. The exact mark is yours.
- **Old colours:** remove every `green-9xx` and `zinc-*` class from the three `ui` parts.

- [ ] **Step 4: Verify**

- Run: `pnpm test` → PASS.
- Run: `pnpm --filter web build && pnpm --filter web start`.
- Then fetch `http://localhost:3000/serwist/sw.js` and confirm the precache list contains the `.woff2` font files.
  If it doesn't, add them to the app-shell precache: static assets only, never pages.

- [ ] **Step 5: Commit**

```bash
git add apps/web/app apps/web/src/components/ui apps/web/test/unit/manifest.test.ts docs/superpowers
git commit -m "feat(design): silk-and-gold tokens, fonts, iPhone status bar and app icon"
```

(This first commit also adds the approved spec, the mockup and this plan.)

---

### Task 2: The presentation rules — ring, bill status, icons, tabs, Back, greeting

Pure functions with no React, each with a unit test. Later tasks only call them.

**Files:**
- Create: `apps/web/src/client/ring.ts`, `bill-status.ts`, `group-icon.ts`, `nav.ts`, `greeting.ts`
- Test: `apps/web/test/unit/client/ring.test.ts`, `bill-status.test.ts`, `group-icon.test.ts`, `nav.test.ts`,
  `greeting.test.ts`

**Interfaces:**
- Produces:

```ts
// ring.ts
export type RingTone = 'fine' | 'near' | 'over';
export interface Ring { readonly percent: number | null; readonly tone: RingTone; readonly overMinor: number }
export function ringOf(actualMinor: number, plannedMinor: number, alertThresholds: readonly number[]): Ring;
export function byMostUsed<T extends { readonly actualMinor: number; readonly plannedMinor: number }>(groups: readonly T[]): T[];

// bill-status.ts
export type BillLineKey = 'dueThisMonth' | 'overdue' | 'partPaid' | 'paid';
export function billLine(status: YearLineStatus, inCurrentMonth: boolean): BillLineKey | null;
export type MonthCover = { readonly key: 'covers' } | { readonly key: 'short'; readonly shortfallMinor: number };
export function monthCover(endMinor: number): MonthCover;

// group-icon.ts
export type IconName = 'shield' | 'pot' | 'cake' | 'book' | 'plane' | 'car' | 'wrench' | 'child' | 'food' | 'house'
  | 'bolt' | 'heart' | 'screen' | 'person' | 'savings' | 'tag';
export function iconFor(name: string): IconName;

// nav.ts
export type TabKey = 'home' | 'budgets' | 'add' | 'bills' | 'activity';
export interface Tab { readonly key: TabKey; readonly href: string; readonly match: readonly string[] }
export function tabsFor(role: Actor['role']): readonly Tab[];
export function activeTab(pathname: string, tabs: readonly Tab[]): TabKey | null;
export function backTarget(pathname: string): string;

// greeting.ts
export function greetingKey(now: Date, timeZone: string): 'morning' | 'afternoon' | 'evening';
```

- [ ] **Step 1: Write the failing tests**

```ts
// ring.test.ts — thresholds are the family's alert levels
expect(ringOf(890_000, 2_400_000, [80, 100])).toEqual({ percent: 37, tone: 'fine', overMinor: 0 });
expect(ringOf(2_000_000, 2_000_000, [80, 100])).toEqual({ percent: 100, tone: 'near', overMinor: 0 }); // used up, not over
expect(ringOf(2_630_000, 2_400_000, [80, 100])).toEqual({ percent: 110, tone: 'over', overMinor: 230_000 });
expect(ringOf(500_000, 0, [80, 100])).toEqual({ percent: null, tone: 'over', overMinor: 500_000 }); // Review Focus 2
expect(ringOf(0, 0, [80, 100])).toEqual({ percent: null, tone: 'fine', overMinor: 0 });
expect(ringOf(1_100_000, 2_000_000, [50, 90, 100]).tone).toBe('near'); // Review Focus 3: lowest level under 100
expect(ringOf(1_900_000, 2_000_000, []).tone).toBe('fine'); // no levels → no gold
test('byMostUsed puts over-plan and zero-plan spending first, then highest share, ties in original order', ...);

// bill-status.test.ts
expect(billLine('overdue', true)).toBe('overdue');
expect(billLine('part_paid', false)).toBe('partPaid');
expect(billLine('paid', true)).toBe('paid');
expect(billLine('due_soon', true)).toBe('dueThisMonth');
expect(billLine('planned', false)).toBeNull();
expect(monthCover(0)).toEqual({ key: 'covers' });
expect(monthCover(-3_650_000)).toEqual({ key: 'short', shortfallMinor: 3_650_000 });

// group-icon.test.ts — the family's own names (fixtures/sample-plan.ts)
expect(iconFor('Health Insurance — In-laws')).toBe('shield');
expect(iconFor('Pongal')).toBe('pot');
expect(iconFor('Native-place Festival')).toBe('pot');
expect(iconFor('Fourth Family Birthday')).toBe('cake');
expect(iconFor('Kids’ School Fees — Term 1')).toBe('book'); // school wins over kids
expect(iconFor('Family Tour / Vacation')).toBe('plane');   // travel wins over family
expect(iconFor('Car & Bike Servicing')).toBe('car');
expect(iconFor('Household Electronics & Appliance Repairs')).toBe('wrench');
expect(iconFor('Kids’ Games / Indoor Play')).toBe('child');
expect(iconFor('Food & Dining')).toBe('food');
expect(iconFor('Utilities & Bills')).toBe('bolt');
expect(iconFor('Subscriptions & Learning')).toBe('screen');
expect(iconFor('Something new')).toBe('tag');

// nav.test.ts
expect(tabsFor('admin').map((t) => t.key)).toEqual(['home', 'budgets', 'add', 'bills', 'activity']);
expect(tabsFor('viewer').map((t) => t.key)).toEqual(['home', 'budgets', 'bills', 'activity']); // Review Focus 4
expect(activeTab('/month/2026-11', tabsFor('admin'))).toBe('budgets');
expect(activeTab('/capture/abc', tabsFor('admin'))).toBe('add');
expect(activeTab('/year/2027', tabsFor('admin'))).toBe('bills');
expect(activeTab('/inbox', tabsFor('admin'))).toBe('activity');
expect(backTarget('/year/2027')).toBe('/forecast'); // Review Focus 5
expect(backTarget('/month/2026-11/review')).toBe('/budgets');
expect(backTarget('/settings/family')).toBe('/activity');
expect(backTarget('/somewhere-else')).toBe('/home');

// greeting.test.ts — Asia/Kolkata is UTC+5:30
expect(greetingKey(new Date('2026-11-05T03:00:00Z'), 'Asia/Kolkata')).toBe('morning');   // 08:30
expect(greetingKey(new Date('2026-11-05T08:00:00Z'), 'Asia/Kolkata')).toBe('afternoon'); // 13:30
expect(greetingKey(new Date('2026-11-05T13:00:00Z'), 'Asia/Kolkata')).toBe('evening');   // 18:30
expect(greetingKey(new Date('2026-11-05T22:00:00Z'), 'Asia/Kolkata')).toBe('evening');   // 03:30
```

- [ ] **Step 2: Run them to verify they fail**

Run: `pnpm test apps/web/test/unit/client` → FAIL (modules not found).

- [ ] **Step 3: Implement**

- **`ringOf`:**
  - `percent = planned > 0 ? Math.round(actual * 100 / planned) : null`.
  - `over` when `actual > planned`.
  - `near` when not over, `percent !== null`, and `percent >=` the lowest threshold below 100.
  - Otherwise `fine`.
- **`iconFor`:** an ordered, case-insensitive keyword table; the first match wins. The order is: insurance/policy →
  festival names (pongal, deepavali, diwali, festival, tradition) → birthday/celebration → school/education/tuition →
  tour/travel/vacation/visit/trip → car/bike/vehicle/petrol/fuel/servic/transport → repair/appliance →
  kid/child/play/game/recreation → food/grocer/dining/restaurant/fruit/veg → hous/rent/home/clean →
  utilit/electric/internet/gas/bill → health/medic/ayur → subscri/ott/cloud/learning → personal/family/spouse →
  saving/deposit/gold.
  - **Why names and not groups (a note, not a change):** the forecast's bill lines carry the bill's name but no group,
    so bills match on their own name, and the rings match on the group name. Either way the data doesn't change, as
    spec §4.3 requires.
- **Tabs and their `match` lists** are exactly spec §5.1's table. `bills` points to `/forecast`.
- **`backTarget`** is the `href` of the tab whose `match` covers the path, and `/home` otherwise.
- **`greetingKey`:** 05:00–11:59 is morning, 12:00–16:59 is afternoon, and everything else is evening, by the hour in
  `timeZone` (use `Intl.DateTimeFormat` with `hourCycle: 'h23'`).

- [ ] **Step 4: Run them to verify they pass**

Run: `pnpm test apps/web/test/unit/client` → PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/client apps/web/test/unit/client
git commit -m "feat(design): presentation rules for rings, bill status, icons, tabs, Back and greeting"
```

---

### Task 3: The app frame — bar, headers, Back, icons, skeleton, no-signal strip, slides

**Files:**
- Create in `apps/web/src/components/`: `icon.tsx`, `screen-header.tsx`, `temple-border.tsx`, `back-button.tsx`,
  `sheet.tsx`, `nav-link.tsx`
- Modify: `apps/web/src/components/bottom-nav.tsx`, `page-loading.tsx`, `offline-notice.tsx`
- Modify: `apps/web/app/(app)/layout.tsx`, `apps/web/app/globals.css` (view-transition rules),
  `apps/web/messages/en.json` (`nav.bills`, `nav.back`)
- Test: `apps/web/test/e2e/frame.spec.ts`

**Interfaces:**
- Consumes: Task 2's `tabsFor`, `activeTab`, `backTarget` and `IconName`. Task 1's tokens.
- Produces:

```ts
export function Icon(props: { name: IconName | FrameIcon; className?: string }): JSX.Element; // aria-hidden inline SVG
export type FrameIcon = 'home' | 'budgets' | 'add' | 'bills' | 'activity' | 'mic' | 'scan' | 'type' | 'bell'
  | 'settings' | 'check' | 'alert' | 'calendar' | 'back' | 'prev' | 'next' | 'grow';
export function BottomNav(props: { role: Actor['role'] }): JSX.Element;
export function TabHeader(props: { title: ReactNode; action?: ReactNode; children?: ReactNode }): JSX.Element; // compact peacock + temple border
export function DetailHeader(props: { title: ReactNode; action?: ReactNode }): JSX.Element;                // compact peacock, Back, no border
export function TempleBorder(): JSX.Element;
export function BackButton(): JSX.Element; // accessible name from nav.back ("Back")
export function Sheet(props: { open: boolean; onClose: () => void; title: string; children: ReactNode }): JSX.Element;
export function NavLink(props: LinkProps & { direction: 'forward' | 'back' | 'tab'; children: ReactNode }): JSX.Element;
```

- [ ] **Step 1: Write the failing e2e test**

`frame.spec.ts`, iPhone 15 project:

Reuse `core.spec.ts`'s sign-up and setup steps. If they are not shared yet, extract them into
`apps/web/test/e2e/helpers.ts`.

```ts
test('every tab root fits the phone width, with no sideways scroll', async ({ page }) => {
  // signed in, then for each of /home, /add, /budgets, /forecast, /activity:
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true); // Review Focus 1
});
test('the bar has five named buttons and marks the current one', async ({ page }) => {
  for (const name of ['Home', 'Budgets', 'Add', 'Bills', 'Activity']) await expect(page.getByRole('link', { name })).toBeVisible();
  await page.goto('/month/2026-11');
  await expect(page.getByRole('link', { name: 'Budgets' })).toHaveAttribute('aria-current', 'page');
});
test('a deeper screen has Back, and Back with no history goes to its tab root', async ({ page }) => {
  await page.goto(`/year/${new Date().getFullYear()}`); // opened directly, as from a notification
  await page.getByRole('link', { name: 'Back' }).click();
  await expect(page).toHaveURL(/\/forecast$/);
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `pnpm e2e test/e2e/frame.spec.ts` → FAIL (there is no Bills or Back link yet).

- [ ] **Step 3: Implement**

- **`(app)/layout.tsx`:**
  - Read the actor with `pageContext()` inside the existing `Suspense` and pass `role` to `BottomNav`.
  - Add a peacock strip fixed at the top, `env(safe-area-inset-top)` tall, above everything (spec §5.2).
  - Give `main` bottom padding that clears the floating bar plus `env(safe-area-inset-bottom)`.
  - Under 768 px the content is full width with 16 px sides. From 768 px it may grow to 1,100 px. A screen asks for
    the 640 px reading width itself.
- **`BottomNav`:**
  - Under 1,024 px it is spec §5.1's floating bar: peacock-deep, 10 px from each side, 16 px above the safe area,
    26 px corners.
  - Each button is icon only with its `aria-label` from `nav.*`, and the active one is white with a gold dot. Add is
    a 48 px gold square.
  - From 1,024 px it is a left side rail with the icons and their names, and Add at the top.
  - Links carry `aria-current="page"`.
- **`BackButton`:**
  - When the app's own history has an earlier screen, it calls `router.back()`. Track this with a `sessionStorage`
    counter that `NavLink` increments, not with `history.length`.
  - Otherwise it links to `backTarget(pathname)`.
  - It renders as a link named "Back".
- **Slides:**
  - Wrap each screen's content in React `ViewTransition`.
  - `NavLink` passes `transitionTypes={[direction]}`: rows and cards that go deeper use `forward`, Back uses `back`,
    and the bar uses `tab`.
  - In `globals.css`, `forward` slides the new screen in from the right, `back` slides it out to the right, and `tab`
    is a fade of about 120 ms.
  - Under `prefers-reduced-motion: reduce`, set `animation: none` for every view-transition pseudo-element.
  - A browser without view transitions must still change screens normally.
- **`Sheet`:**
  - It slides up over a dimmed backdrop, has 24 px top corners and a drag-handle bar, and closes on the backdrop or
    Escape.
  - It is a `role="dialog"` with `aria-modal` and moves focus into itself.
- **`PageLoading`:** plain `line`-coloured blocks shaped like a header and three cards, with no shimmer. The "Loading…"
  text stays for screen readers only.
- **`OfflineNotice`:** a slim gold strip with ink text, just under the status-bar strip. The wording doesn't change.
- **Presses:** add `active:scale-[.97] transition-transform motion-reduce:transform-none` to `Button` and to tappable
  cards.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `pnpm e2e` → PASS (`frame.spec.ts` and the existing `core.spec.ts`).

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/components apps/web/app apps/web/messages/en.json apps/web/test/e2e/frame.spec.ts
git commit -m "feat(design): the app frame — floating bar, side rail, headers, Back, sheet and page slides"
```

---

### Task 4: Home's new figures (domain)

**Files:**
- Modify: `packages/domain/src/forecast/models.ts`, `packages/domain/src/forecast/use-cases/get-home-summary.ts`,
  `packages/domain/src/forecast/index.ts` (export the new types and the function)
- Test: `packages/domain/test/forecast/forecast.test.ts` (Home section), `packages/domain/test/forecast/biggest-month.test.ts`

**Interfaces:**
- Produces (the existing `HomeSummary` fields stay; these are added):

```ts
export interface HomeMonth extends ForecastBills { readonly endMinor: number }
export interface BiggestMonth {
  readonly period: Period;
  readonly totalMinor: number;
  readonly lines: readonly ForecastBillLine[];
  /** The pot going into the month: the previous month's end plus this month's deposit. */
  readonly openingMinor: number;
  /** The first month, up to and including this one, that ends below zero. */
  readonly shortOnTheWay: { readonly period: Period; readonly shortfallMinor: number } | null;
}
/** Months 4–12 (indexes 3–11) with dated bills; the largest total wins, the earlier month on a tie. */
export function biggestMonthAhead(months: readonly ForecastMonth[], bills: readonly ForecastBills[]): BiggestMonth | null;

// HomeSummary changes
pot: { …existing; readonly setAsideMinor: number; readonly allCovered: boolean; readonly topUpNowMinor: number | null };
next3Months: readonly HomeMonth[];
biggestAhead: BiggestMonth | null;
thisMonth: { …existing; readonly groups: readonly { readonly groupName: string; readonly plannedMinor: number; readonly actualMinor: number }[] };
```

- [ ] **Step 1: Write the failing tests**

In `forecast.test.ts`, using the existing 1 Nov 2026 fixture:

```ts
it('home gives each of the next 3 months its end-of-month pot balance', async () => {
  expect((await home.execute({ actor: admin })).next3Months.map((m) => m.endMinor)).toEqual(NOV_2026_END_BALANCES.slice(0, 3));
});
it('home gives the monthly set-aside and says every month is covered', async () => {
  const [h, f] = [await home.execute({ actor: admin }), await forecast.execute({ actor: admin })];
  expect(h.pot).toMatchObject({ setAsideMinor: f.months[1]!.inMinor, allCovered: true, topUpNowMinor: null });
});
it('home picks June 2027 as the biggest month ahead, from months 4–12', async () => {
  const [h, f] = [await home.execute({ actor: admin }), await forecast.execute({ actor: admin })];
  expect(h.biggestAhead).toMatchObject({
    period: { year: 2027, month: 6 },
    totalMinor: 12_000_000,
    openingMinor: f.months[6]!.endMinor + f.months[7]!.inMinor,
    shortOnTheWay: null,
  });
  expect(h.biggestAhead!.lines.map((l) => l.name)).toEqual(['Health Insurance — In-laws', 'Term Life Insurance']);
});
it('with a ₹20,000 set-aside the pot runs short in June 2027, and Home says so', async () => {
  await families.save(familyRecord({ setAsideOverrideMinor: 2_000_000 }));
  const [h, f] = [await home.execute({ actor: admin }), await forecast.execute({ actor: admin })];
  expect(h.pot.allCovered).toBe(false);
  expect(h.biggestAhead!.shortOnTheWay).toEqual({ period: { year: 2027, month: 6 }, shortfallMinor: -f.months[7]!.endMinor });
});
it('home lists this month’s groups with planned and actual', async () => {
  expect((await home.execute({ actor: admin })).thisMonth.groups).toContainEqual({ groupName: 'Food & Dining', plannedMinor: 2_400_000, actualMinor: 0 });
});
```

In `biggest-month.test.ts`, with hand-built months:

```ts
test('no dated bills in months 4–12 gives null', ...);
test('a bigger bill in months 1–3 is ignored; months 4–12 decide', ...);
test('equal totals pick the earlier month', ...);
test('shortOnTheWay names the first short month up to the biggest, not one after it', ...);
```

Keep the bill names in the order the forecast lists them. If the fixture's order differs from the `toEqual` above,
match the forecast's order and note it in the ledger.

- [ ] **Step 2: Run them to verify they fail**

Run: `pnpm test packages/domain/test/forecast` → FAIL.

- [ ] **Step 3: Implement**

`GetHomeSummaryUseCase` fills the new fields from the `forecast` and `month` it already reads. It makes no new reads
and adds no new port.
- `setAsideMinor` is `forecast.months[1].inMinor`, as the forecast screen does.
- `allCovered` is `redMonths.length === 0`.
- `next3Months[i]` is `{ ...forecast.bills[i], endMinor: forecast.months[i].endMinor }`.
- `biggestAhead` is `biggestMonthAhead(forecast.months, forecast.bills)`.
- `groups` maps `month.groups`.

- [ ] **Step 4: Run them to verify they pass**

Run: `pnpm test && pnpm typecheck` → PASS. The existing Home tests are unchanged.

- [ ] **Step 5: Commit**

```bash
git add packages/domain/src/forecast packages/domain/test/forecast
git commit -m "feat(forecast): Home gets month-end balances, the set-aside, the biggest month ahead and group spending"
```

---

### Task 5: Made-up data that shows every case (`pnpm seed:dev --showcase`)

**Files:**
- Modify: `fixtures/sample-family.ts` (add `showcaseCurrentMonth`, FICTIONAL), `scripts/seed-dev.ts`
- Modify: `docs/RUNBOOK.md` §7 (the new flag)
- Test: `scripts/seed-dev.test.ts`

**Interfaces:**
- Produces:
  - `showcaseRows(today: IsoDate): readonly { itemKey: string; date: IsoDate; amountMinor: number; merchant: string }[]`
    in `fixtures/sample-family.ts`.
  - `runSeedDev(env, injectedDb?, options?: { showcase?: boolean })`.

- [ ] **Step 1: Write the failing tests**

```ts
test('showcase rows are dated in today’s month, never after today', () => {
  const rows = showcaseRows('2026-11-05' as IsoDate);
  expect(rows.every((r) => r.date >= '2026-11-01' && r.date <= '2026-11-05')).toBe(true);
});
test('showcase rows make Food over plan, Kids nearly used up and Housing exactly used', () => {
  const total = (keys: string[]) => showcaseRows('2026-11-05' as IsoDate).filter((r) => keys.includes(r.itemKey)).reduce((s, r) => s + r.amountMinor, 0);
  expect(total(['groceries', 'fruits', 'vegetables', 'non_veg', 'outside_food'])).toBe(2_630_000); // ₹26,300 of ₹24,000
  expect(total(['kids_maintenance', 'football', 'diapers'])).toBe(720_000);                        // ₹7,200 of ₹8,000
  expect(total(['rent'])).toBe(2_000_000);                                                         // 100%
});
test('the seed still refuses production with --showcase', async () => {
  await expect(runSeedDev({ VERCEL_ENV: 'production' }, undefined, { showcase: true })).rejects.toThrow(/production/);
});
```

- [ ] **Step 2: Run them to verify they fail**

Run: `pnpm test scripts/seed-dev.test.ts` → FAIL.

- [ ] **Step 3: Implement**

`--showcase` runs the normal seed, then three more steps:
1. Records `showcaseRows(today)`, where `today` is `todayIn` the family's time zone. This also includes a ₹255.00
   electricity bill, so Utilities is a "fine" ring.
2. Records a ₹500 payment on `bike_ins`, so it shows "Part paid".
3. Sets the family's `setAsideOverrideMinor` to `2_000_000` through the family gateway, so the pot runs short in June
   2027.

Every row is marked FICTIONAL in its comment. Run `pnpm seed:dev --showcase` against the local database.

- [ ] **Step 4: Verify**

- Run: `pnpm test` → PASS.
- Then, signed in as `dev@example.com`, Home's current data shows:
  - a Food ring over plan
  - a Kids ring and a Housing ring nearly used up
  - a "Part paid" bike insurance row
  - "13 bills have no month yet"
  - the short pill
  - the checklist card
- Note in the ledger any case this data does not reach (an overdue row needs an October bill left unpaid, and the
  sample pays both). The unit tests in Task 2 cover those.

- [ ] **Step 5: Commit**

```bash
git add fixtures/sample-family.ts scripts docs/RUNBOOK.md
git commit -m "chore(dev): seed:dev --showcase loads fictional rows that show every Home case"
```

---

### Task 6: Home

**Files:**
- Modify: `apps/web/app/(app)/home/page.tsx`, `apps/web/app/(app)/home/checklist-card.tsx`
- Create in `apps/web/app/(app)/home/`: `pot-header.tsx`, `biggest-month.tsx`, `undated-card.tsx`,
  `occasional-cards.tsx`
- Create in `apps/web/src/components/`: `quick-actions.tsx`, `scan-soon.tsx`, `spending-rings.tsx`, `month-row.tsx`
- Modify: `apps/web/messages/en.json` (`home.*`)
- Test: `apps/web/test/e2e/core.spec.ts` (Home steps), `apps/web/test/e2e/frame.spec.ts`

**Interfaces:**
- Consumes: Task 4's `HomeSummary`; Task 2's `ringOf`, `byMostUsed`, `billLine`, `monthCover`, `iconFor` and
  `greetingKey`; Task 3's `Icon`, `TempleBorder`, `Sheet` and `NavLink`.
- Produces (Tasks 7–9 reuse these):

```ts
export function QuickActions(props: { withType: boolean }): JSX.Element; // Speak (/capture, data-testid="home-voice"), Scan (soon), Type (/add) when withType
export function SpendingRings(props: { groups: readonly { groupName: string; plannedMinor: number; actualMinor: number }[]; alertThresholds: readonly number[]; money: Money }): JSX.Element;
export function MonthRow(props: { month: HomeMonth; isCurrent: boolean; money: Money; detail?: ReactNode }): JSX.Element;
```

(`Money` is the existing `moneyOf(family)` shape.)

- [ ] **Step 1: Write the failing e2e steps**

Add to the Home part of `core.spec.ts`:
- Home shows `In the yearly bills pot`, `Next 3 months` and `Bike Insurance`.
- `getByTestId('home-voice')` links to `/capture`.
- Tapping Scan shows `Scanning bills is coming soon. For now, Speak or Type it.`
- The `Inbox` button opens `/inbox`, and the person's initial opens `/settings/account`.

- [ ] **Step 2: Run them to verify they fail**

Run: `pnpm e2e` → FAIL.

- [ ] **Step 3: Build Home to the mockup and spec §6**

Build it top to bottom exactly as spec §6.1.

- **Copy (put in `home.*`):**

  | Place | Wording |
  |---|---|
  | Greeting | "Good morning" / "Good afternoon" / "Good evening" |
  | Pot label | "In the yearly bills pot" |
  | Covered pill | "Every dated bill for the next year is covered" |
  | Short pill | the existing `shortBy` + `fixPerMonth`, or "Top up {amount} now." |
  | Set-aside line | "You add {amount} to it each month" |
  | Safe-to-spend line | existing `safeToSpend` |
  | Action buttons | "Speak", "Scan", "Type"; tag "Soon" |
  | Scan message | "Scanning bills is coming soon. For now, Speak or Type it." |
  | Next 3 months | "Next 3 months", "See the year" |
  | Bill status lines | "Due this month", "Overdue. Still to pay.", "Part paid", "Paid" |
  | Month cover lines | "The pot covers this month.", "The pot is short by {amount} at the end of this month.", "No yearly bills. The pot grows to {amount}." |
  | Biggest month | "Biggest month ahead: {month}"; "The pot will have {amount} by then. You're on track."; "The pot is short by {amount} in {month}." |
  | No month yet | "{count, plural, one {# bill has} other {# bills have}} no month yet"; "{amount} for {names} and more. Give them a month so nothing is forgotten." (drop "and more" when there are 3 or fewer) |
  | Spending | "{month} so far", "Open month", "{actual} spent of {planned}", "{amount} over" |
  | Header buttons | the `aria-label`s "Settings" and "Inbox" |

- **The biggest-month card:** the bill names are joined with `Intl.ListFormat('en', { type: 'conjunction' })`. Its
  gold bar is `min(1, pot.balanceMinor / totalMinor)`.
- **Header buttons:** the initial is the first letter of `user.email`, upper case, and opens Settings. The bell opens
  `/inbox` and shows a gold dot when the Inbox has anything waiting.
- **Occasional cards:** the 1st-of-month checklist, last month's review, next year's check, the year-end review, the
  Inbox count and the waiting voice note. They sit above Next 3 months and keep their current actions and headings.
  Keep "This month’s checklist", because the test reads it.
- **Viewers:** no `QuickActions` (Review Focus 4).
- **Tablet and desktop:** from 768 px, two columns as spec §6.5.

- [ ] **Step 4: Verify**

- Run: `pnpm e2e && pnpm typecheck && pnpm lint` → PASS.
- Then run `pnpm dev` on the showcase data and screenshot Home at 393 × 852, 820 × 1180 and 1280 × 800. Set each next
  to the mockup and fix anything that differs from it or from §6.1.

- [ ] **Step 5: Commit**

```bash
git add apps/web/app/(app)/home apps/web/src/components apps/web/messages/en.json apps/web/test/e2e
git commit -m "feat(design): Home — the pot, Speak/Scan/Type, next 3 months, biggest month, no-month bills and rings"
```

---

### Task 7: Add, Speak and the voice review — then the owner checks Home and Add

**Files:**
- Modify in `apps/web/app/(app)/add/`: `page.tsx`, `add-expense-form.tsx`, `outbox-failures.tsx`
- Modify in `apps/web/app/(app)/capture/`: `page.tsx`, `[id]/page.tsx`
- Modify in `apps/web/src/components/`: `voice-capture.tsx`, `voice-review.tsx`, `duplicate-question.tsx`
- Modify: `apps/web/messages/en.json`
- Test: `apps/web/test/e2e/core.spec.ts` (unchanged wording must still pass)

**Interfaces:**
- Consumes: `QuickActions` with `withType: false` (Task 6), and `Sheet`, `DetailHeader` and `TabHeader` (Task 3).

- [ ] **Step 1: Restyle to spec §7.1 and §7.2**

- **Add:**
  - `QuickActions` without Type at the top of the screen.
  - The amount first, in Baloo at about 40 px with the currency sign.
  - 52 px mist-filled fields with 16 px corners.
  - "Yesterday" as a chip.
  - Split and Refund as quiet controls.
  - A full-width peacock Save kept just above the bar.
  - Saved messages as a leaf toast that keeps `role="status"` and the link `See the month`.
  - "Same purchase?" in a `Sheet`.
- **Capture:**
  - A large rani record circle with the time limit under it.
  - A pulsing ring only while recording (steady under reduced motion).
  - Review rows as white cards, with Confirm in peacock and Discard quiet.
- **Keep:** every label, heading, test id and string the e2e test reads (Global Constraints).

- [ ] **Step 2: Verify**

- Run: `pnpm e2e && pnpm typecheck && pnpm lint` → PASS.
- Screenshot Add and Capture at 393 × 852.

- [ ] **Step 3: The owner checks Home and Add (spec §9)**

- Run `pnpm dev` on the showcase data, with the browser in a phone-sized window (iPhone 15 width).
- Ask the owner to look at Home and Add and say what to change.
- Make their changes, and **do not start Task 8 until they approve**. Record their words in the ledger.

- [ ] **Step 4: Commit**

```bash
git add apps/web/app/(app)/add apps/web/app/(app)/capture apps/web/src/components apps/web/messages/en.json
git commit -m "feat(design): Add, Speak and the voice review in the new look"
```

---

### Task 8: Budgets — this month, templates, the month-end review

**Files:**
- Modify: `apps/web/app/(app)/budgets/page.tsx` (redirect to this month)
- Modify in `apps/web/app/(app)/month/[ym]/`: `page.tsx`, `planned-editor.tsx`, `review/page.tsx`,
  `review/review-actions.tsx`
- Modify in `apps/web/app/(app)/templates/`: `page.tsx`, `template-editors.tsx`
- Modify: `apps/web/messages/en.json`
- Test: `apps/web/test/e2e/core.spec.ts` (Budgets navigation steps updated if they used the old link list)

**Interfaces:**
- Consumes: `SpendingRings` / `ringOf` (Tasks 2 and 6), and `TabHeader` / `DetailHeader` (Task 3).

- [ ] **Step 1: Restyle to spec §7.3**

- **`/budgets`:** it `redirect()`s to `/month/<current ym>`.
- **The month screen is the Budgets tab root:**
  - a `TabHeader` with the ‹ › month switcher and a "Templates" action
  - the spent-of-planned bar
  - one card per group with its ring (the tone from the family's alert levels)
  - item rows showing the name, the amount spent and the plan, with over-plan amounts in rani plus "over"
  - the planned editor kept as it is
  - a savings card
  - the `line-<item name>` test ids kept
- **Templates and the review** use `DetailHeader` and the same rows. The review's overs and unders are rani and leaf,
  each with a word.

- [ ] **Step 2: Verify**

- Run: `pnpm e2e && pnpm typecheck && pnpm lint` → PASS.
- Screenshot the month screen on the showcase data at 393 × 852 and 1280 × 800.

- [ ] **Step 3: Commit**

```bash
git add apps/web/app/(app)/budgets apps/web/app/(app)/month apps/web/app/(app)/templates apps/web/messages/en.json apps/web/test/e2e
git commit -m "feat(design): Budgets opens on this month, with rings per group; templates and the review restyled"
```

---

### Task 9: Bills — the 12-month view and the year plan

**Files:**
- Modify: `apps/web/app/(app)/forecast/page.tsx`
- Create: `apps/web/src/components/pot-chart.tsx`
- Modify in `apps/web/app/(app)/year/[y]/`: `page.tsx`, `year-line-actions.tsx`, `review/page.tsx`,
  `review/review-actions.tsx`, `year-end/page.tsx`, `year-end/year-end-actions.tsx`
- Modify: `apps/web/messages/en.json`

**Interfaces:**
- Consumes: `MonthRow` (Task 6), `billLine` / `monthCover` / `iconFor` (Task 2), and the existing `ForecastView`.
- Produces: `PotChart(props: { months: readonly ForecastMonth[]; money: Money }): JSX.Element`.
- Each forecast month becomes a `HomeMonth` for `MonthRow` the same way Task 4 builds them:
  `{ ...f.bills[i], endMinor: f.months[i].endMinor }`.

- [ ] **Step 1: Restyle to spec §7.4**

- **`/forecast` is the Bills tab root:**
  - A `TabHeader`.
  - A peacock card with safe to spend and the covered-or-short message. Keep `data-testid="no-red"`.
  - `PotChart`: 12 bars of month-end balance from a zero line. Leaf bars are at or above it; a rani bar dipping below
    marks a short month. The short month names sit under the bars, and the chart has an `aria-label` that reads the
    figures in words.
  - Then one `MonthRow` per month, with in, out and end in plain words. Keep `data-testid="forecast-months"` on the
    list.
  - Then the "No month yet" card, with a button to give each bill a month.
- **Year plan, year review and year-end:** `DetailHeader`, and rows with the icon, amount, month (or "No month yet")
  and a status chip that has a word.

- [ ] **Step 2: Verify**

- Run: `pnpm e2e && pnpm typecheck && pnpm lint` → PASS.
- Screenshot `/forecast` on the showcase data, where June must show short.

- [ ] **Step 3: Commit**

```bash
git add apps/web/app/(app)/forecast apps/web/app/(app)/year apps/web/src/components/pot-chart.tsx apps/web/messages/en.json
git commit -m "feat(design): Bills — pot chart, month rows and the year plan in the new look"
```

---

### Task 10: Activity, All expenses, Inbox, Settings, Install

**Files:**
- Modify: `apps/web/app/(app)/activity/page.tsx`, `ledger/page.tsx` and `inbox/page.tsx`
- Modify in `apps/web/app/(app)/settings/`: `account/page.tsx`, `family/page.tsx`,
  `family/family-settings-form.tsx`, `family/invite-form.tsx`
- Modify in `apps/web/app/(app)/install/`: `page.tsx`, `reminders-button.tsx`
- Modify: `apps/web/messages/en.json`

- [ ] **Step 1: Restyle to spec §7.5 and §7.6**

- **Activity is a tab root** (`TabHeader`), and the All expenses, Install and Settings links move into its header. It
  is a timeline: an initial circle (peacock for the signed-in person, rani for the other adult), the event in words,
  and the time.
- **All expenses:**
  - Rows with the item icon, the shop and item, who added it, and a mic, scan or keyboard icon for how it was added.
  - The amount on the right.
  - The month, item, person and method filters shown as chips. The same form fields stay underneath, so the URLs
    don't change.
- **The Inbox:** white question cards, each with two answer buttons. Keep `duplicate-question`.
- **Settings:** grouped white cards with rows. **Install:** keep the pictures, in white cards.
- **The missing "payer" wording** (PROGRESS "Noted for later") is not part of this task. Leave it, and note it in the
  ledger.

- [ ] **Step 2: Verify**

Run: `pnpm e2e && pnpm typecheck && pnpm lint` → PASS. Then screenshot each screen at 393 × 852.

- [ ] **Step 3: Commit**

```bash
git add apps/web/app/(app)/activity apps/web/app/(app)/ledger apps/web/app/(app)/inbox apps/web/app/(app)/settings apps/web/app/(app)/install apps/web/messages/en.json
git commit -m "feat(design): Activity timeline, All expenses, Inbox, Settings and Install in the new look"
```

---

### Task 11: Sign-in, join and setup

**Files:**
- Modify in `apps/web/app/(auth)/sign-in/`: `page.tsx`, `sign-in-form.tsx`
- Modify in `apps/web/app/join/[token]/`: `page.tsx`, `join-button.tsx`
- Modify in `apps/web/app/setup/`: `page.tsx`, `family-form.tsx`, `plan-step.tsx`, `first-year-check-form.tsx`
- Modify: `apps/web/app/page.tsx` (if it shows anything), `apps/web/messages/en.json`

- [ ] **Step 1: Restyle to spec §7.6**

- **Layout:** each screen has a peacock header with the temple border and "NestWise" in Baloo, then a white card
  holding the form.
- **Setup steps:** they show "Step 1 of 3" in the header. This is a real sequence, so the numbering is right here.
- **Keep:** every label and heading the e2e test reads, including "Which of these are still to come".

- [ ] **Step 2: Verify**

Run: `pnpm e2e && pnpm typecheck && pnpm lint` → PASS.

- [ ] **Step 3: Commit**

```bash
git add apps/web/app/(auth) apps/web/app/join apps/web/app/setup apps/web/app/page.tsx apps/web/messages/en.json
git commit -m "feat(design): sign-in, join and setup in the new look"
```

---

### Task 12: Bring the documents up to date

**Files:**
- Modify: `docs/NestWise_TRD.md`:
  - §3: the UI row becomes "Tailwind CSS v4 with NestWise's own tokens", and the shadcn placeholders are retired.
  - §8.1: the status bar is black-translucent, with a peacock strip; the theme colour is peacock.
  - §14: the line "Exact screen layouts and visuals (design is parked)" is replaced by a pointer to the spec.
- Modify: `docs/NestWise_PRD.md` §9 ("Visual design" now points to the approved spec), `docs/PROGRESS.md` (the Design
  row and "Noted for later"), `CLAUDE.md` (the status date and the "Next" line)

- [ ] **Step 1: Make the changes**

Write them in plain words, as the existing documents are. Remove the "Home page display" item from PROGRESS "Noted for
later", because this stage answers it.

- [ ] **Step 2: Verify**

Re-read spec §1 and §9 and check that nothing in the PRD or TRD still says the design is parked.

- [ ] **Step 3: Commit**

```bash
git add docs CLAUDE.md
git commit -m "docs: the design stage in the PRD, TRD, progress page and project notes"
```

---

### Task 13: Acceptance and the owner's approval

- [ ] **Step 1: Run everything**

Run: `pnpm typecheck && pnpm lint && pnpm test && pnpm test:integration && pnpm e2e`
Expected: everything passes. Record the counts in the ledger.

- [ ] **Step 2: Check that nothing of the old look is left**

Run: `rg -n "zinc-|green-9|red-7|amber-(50|900)" apps/web/app apps/web/src` → no matches.

- [ ] **Step 3: Check the quality floor (spec §8)**

- **Contrast:** gold and leaf text on white, white on rani, and muted on mist, using a contrast checker. AA applies:
  4.5:1 for small text.
- **Keyboard focus:** a 2 px gold ring on peacock, or a peacock ring on white, on every control.
- **Reduced motion:** turn on "Reduce motion" in the browser's rendering settings. Screens change with no slide, and
  the recording ring is steady.
- **Offline:** in DevTools, go offline after one visit. Home draws in Baloo and Mukta, with the gold strip.
- **Tablet and desktop:** at 820 × 1180, Home is two columns. At 1280 × 800, the side rail replaces the bar.

- [ ] **Step 4: Request a fresh whole-branch review**

Use `superpowers:requesting-code-review`. Fix what it finds, and ledger what is deferred.

- [ ] **Step 5: The owner approves the screens (spec §9, TRD §15)**

- Show every screen on the showcase data in a phone-sized window, and make the changes the owner asks for.
- **Ask before deploying.** Once deployed, the owner checks on their iPhone.
- Record the approval in `docs/PROGRESS.md`.
