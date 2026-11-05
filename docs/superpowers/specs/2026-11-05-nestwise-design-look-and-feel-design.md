# NestWise Design stage — look and feel

**Status:** approved by the owner (2026-11-05).
**Builds on:** Stages 1a, 1b and 2 (Voice). Every screen today is a plain placeholder built from hand-copied shadcn/ui
parts (`apps/web/src/components/ui/`), deliberately waiting for this stage (PRD §9, TRD §15 "Design").
**Binding sources:** `docs/NestWise_PRD.md` §6.10 (Home) and §9 (the design brief), `docs/NestWise_TRD.md` §8.1
(installed app) and §8.2 (offline). Where this document is silent they apply. Server code (the Home data additions in
§6.3) follows the project skills `hexagonal-architecture` and `clean-architecture`. Visual work follows the
`frontend-design` skill.
**Approved mockup:** `docs/superpowers/specs/2026-11-05-nestwise-design-home-mockup.html`. Open it in a browser and
scroll inside the phone. It is the reference for Home. The plan amounts in it are the family's real ones; the pot
balance and November spending are invented for the picture and must not go into any data.

## 1. Intent

The owner's words: the app must look *"vibrant"*, *"presentable"*, and *"not like a ledger"*. It must feel like *"a
proper mobile application"*. They named three things Home must do:

1. Show the **Speak** (microphone) and **Scan** buttons.
2. Show **the things the app was built to solve**: no yearly bill arrives as a surprise, none is forgotten, and the pot
   is never empty when a bill is due (PRD §1).
3. Make it **easy to see and decide on at least the next 3 months** of upcoming yearly bills.

The earlier brief still holds (2026-11-03): budgets and upcoming bills come first, adding and editing expenses take
little effort, and phone, tablet and desktop all get proper layouts, with page changes that feel like a phone app.

The family is two adults in Tamil Nadu, mainly on iPhone, using the app installed to the Home Screen. The look borrows
from their world. Peacock blue and gold come from a Kanchipuram silk saree, and a zigzag "temple border" runs under
the Home header like a saree's border.

## 2. Goals, non-goals, anti-goals

**Goals**
- Every screen uses one look: the colours, fonts, shapes and motion in §4.
- Home matches the approved mockup and answers, at a glance:
  - are the next bills covered?
  - what is due in the next 3 months?
  - what is the biggest month ahead?
  - which bills still have no month?
  - how is this month's spending going?
- Going deeper into the app slides like an iPhone app. Switching tabs does not slide.
- Tablet and desktop get real layouts (§5.5), not a stretched phone.
- The owner approves the screens on their iPhone (TRD §15 exit for this stage).

**Non-goals**
- Dark mode. The owner picked the light silk look; a dark version can come later.
- A Tamil translation. The fonts are chosen so one can be added later (§4.2), but every string stays English in
  `apps/web/messages/en.json`.
- Photo receipts. The Scan button appears now but only says it is coming (§6.2). Scanning is Stage 3.
- Any change to the money rules, the forecast maths, roles, offline behaviour or reminders.
- New features beyond the few Home figures in §6.3.

**Anti-goals** (a failure even if it technically works)
- Adding a typed expense takes more taps than it does today (the Stage 1b anti-goal still stands).
- Home is pretty but the owner still cannot tell, in a few seconds, whether the coming bills are covered.
- Colour is the only signal of a status (a colour-blind person, or a phone in bright sun, must still be able to read it).
- A screen looks like a spreadsheet: rows of small grey text with tables of numbers.
- The service worker starts precaching pages, or a font or icon fails to load with no signal (TRD §8.2).

## 3. What the owner decided

- **The look:** option A, "Silk and gold":
  - a peacock-blue Home header with a gold temple-border zigzag and a thin pink line under it
  - big Speak, Scan and Type buttons under it
  - the next 3 months as month rows
  - a dark "biggest month ahead" card
  - a "no month yet" card
- **From option B:** the spending **rings**, and the **floating rounded bottom bar** with a big centre button.
  Both are recoloured to A's palette.
- **Approved with "looks good" (2026-11-05).** I put these to the owner as guesses, and they approved them:
  1. Cards that only appear sometimes go just above "Next 3 months". These are the 1st-of-month checklist, the Inbox
     count, the month-end review, next year's check and the year-end review.
  2. Ring colour carries meaning: peacock means fine, gold means nearly used up, and pink means over plan.
  3. The centre Add button reaches Speak, Scan and Type from any screen, and Home keeps its own big buttons too.
     How this works without adding a tap is my call, in §5.1.
  4. Scan shows "Coming soon" until Photo receipts is built.
  5. The fonts are Baloo Thambi 2 and Mukta Malar, both made in India and both with Tamil letters.
  6. On tablet and desktop, the same pieces sit in two columns.
- **"Just write it up"** (2026-11-05). The owner did not want mockups of the other screens first. They follow Home's
  look using the rules in §7, and the owner sees them when they are built.

## 4. The look

### 4.1 Colours

| Name | Hex | Used for |
|---|---|---|
| Peacock | `#00566E` | Headers, primary buttons, links, the "fine" ring, the active month |
| Peacock deep | `#003F52` | The bottom bar, the "biggest month" card, pressed states |
| Gold | `#F2B233` | The temple border, the Add button, Scan, the "nearly used up" ring, small highlights |
| Rani pink | `#D61F69` | Speak, the line under the border, over plan, short, errors |
| Leaf | `#0F7A49` | Covered, paid, on plan (text and icons) |
| Mist | `#ECF3F4` | Page background behind cards |
| Ink | `#0F2A33` | Main text |
| Muted | `#557078` | Secondary text |
| Line | `#E3ECEE` | Dividers, empty ring track |
| White | `#FFFFFF` | Cards |

- Text on gold is Ink, never white. Text on peacock, peacock deep and rani pink is white.
- The mockup used a lighter leaf green (`#13965A`). For small text use the darker `#0F7A49` above, so it is easy to
  read on white.
- Every status shown in colour also says it in words or with an icon. Examples: "Covered" with a tick, "₹2,300 over",
  "Short by ₹23,000 in June".
- Define the colours once, as Tailwind v4 theme tokens in `apps/web/app/globals.css` (`@theme`), and use them by name.
  No hex values in components.

### 4.2 Fonts

- **Baloo Thambi 2** (Ek Type, weights 600–800) is for headings, every money amount and the big numbers. Its round
  numerals are part of the personality.
- **Mukta Malar** (Ek Type, weights 400–700) is for all other text.
- Both fonts have Latin and Tamil letters, so a Tamil version of the app needs no font change.
- Load both with `next/font/google`, which bundles them with the app. They must work with no signal, so check that the
  service worker's app-shell precache includes the font files (static assets, not pages).
- Money always uses Baloo with tabular figures. Mukta Malar's own figures sit low beside text, so any number inside a
  sentence is wrapped in the money style too.
- **Type sizes on a phone:**

  | Role | Size |
  |---|---|
  | Hero amount | 46 px (the ₹ sign at 26 px) |
  | Screen title | 22–28 px |
  | Section heading | 19–20 px |
  | Body | 15 px |
  | Secondary | 13.5 px |
  | Tab bar and small labels | 11.5 px |

- Every text input is at least 16 px, or iPhone zooms the page when it is tapped.
- No all-caps labels and no letter-spaced eyebrow text. Sentence case everywhere.

### 4.3 Shapes and depth

- **Corner rounding:** cards 24 px, big action buttons 20 px, small chips and month badges 16 px, pills fully round.
  Bigger things get rounder corners. Not everything is the same.
- **Cards:** white on Mist, with no border. Use at most a very faint peacock-tinted shadow. The hierarchy comes from
  colour blocks (the peacock header, the dark "biggest month" card), not from shadows.
- **Touch targets:** at least 44 × 44 px.
- **Icons:** simple line icons with a 2 px stroke and round ends, as in the mockup. A small icon set such as
  `lucide-react` is fine; the Pongal pot is a custom drawing. Each bill or group row gets an icon picked by matching
  the group's name ("insurance" → shield, "school" or "education" → book, "festival" → pot, "birthday" → cake,
  "travel" → plane, "vehicle" → car, and so on), with a plain fallback icon. This needs no change to the data. (My
  call.)
- **The temple border** (14 px of gold with peacock zigzag teeth, then a 3 px pink line) is the one decorative element.
  It appears only under the Home header and under the header of the other tab screens (§5.2). It never appears inside
  cards.

### 4.4 Motion

- **Going deeper** (tapping a row or card that opens another screen): the new screen slides in from the right, and
  Back slides it out to the right, as on an iPhone.
- **Switching tabs:** the screen swaps in place with a very short fade. No slide.
- **Sheets** (for example the "Same purchase?" question): they slide up from the bottom over a dimmed backdrop.
- **Press feedback:** buttons and tappable cards shrink very slightly while pressed.
- **No other motion.** No entrance animations on cards and no counting-up numbers.
- **Reduced motion:** when the phone's "Reduce Motion" setting is on, every transition is instant.
- **Technique:** left to the builder. React's `ViewTransition` with Next.js's view-transition support is the likely
  route, since Safari supports view transitions. A slide that only works in some browsers is fine, provided that the
  screens still change correctly everywhere.

## 5. The app frame

### 5.1 The bottom bar

A floating rounded bar in Peacock deep, 10 px in from each side and 16 px above the bottom safe area. It holds five
buttons, left to right:

| Button | Opens | Marked active on |
|---|---|---|
| Home | `/home` | `/home` |
| Budgets | §7.3 | `/budgets`, `/month`, `/templates` |
| **Add** (gold square, centre) | `/add` | `/add`, `/capture` |
| Bills | §7.4 | `/forecast`, `/year` |
| Activity | `/activity` | `/activity`, `/ledger`, `/inbox`, `/settings`, `/install` |

- **Look:** icons only, white at 60% opacity, with the active one fully white and a small gold dot under it. Each
  button still has its name for screen readers (`aria-label` from `en.json`). The phone test finds links by those
  names (`Home`, `Add`), so they must not change.
- **Add (my call):** the centre button goes straight to the Add screen, exactly as today. The Add screen now opens with
  big **Speak** and **Scan** buttons above the typing form (§7.1).
  - **Why:** a pop-up menu (Speak / Scan / Type) would add a tap to every typed expense, which the Stage 1b anti-goal
    forbids. This way Speak, Scan and Type are all reachable from any screen in one tap, and typing costs nothing
    extra.
  - **If the owner wants the pop-up menu instead,** it is a contained change to this one button.
- **Viewers** cannot add, so they get a four-button bar with no Add.
- The page's bottom padding leaves room for the bar, so the last card can scroll fully into view above it.

### 5.2 Headers and Back

- **Home:** the big peacock header (§6.1).
- **The other tab screens** (Budgets, Bills, Activity): a compact peacock header with the screen title in white Baloo,
  then the temple border.
- **Deeper screens** (a month, the year plan, templates, a review, the Inbox, settings, an expense, voice review):
  - a compact peacock header with no temple border
  - a round **Back** button on the left (white chevron icon, accessible name "Back")
  - the title in white Baloo
  - any screen action on the right
  - **Why Back:** an installed iPhone app has no browser Back button, so every deeper screen needs its own. Back
    returns to where the person came from, or to the screen's tab if they arrived by a link.
  - **Why peacock and not Mist (my call):** the iPhone's clock and battery are white (§5.4), so every header must be
    dark enough for them to show.
- **Behind the status bar:** every header runs under the iPhone status bar (§5.4), so the top of the phone is one
  colour block. A peacock strip the height of the status bar stays fixed at the top of every screen. When Home's tall
  header scrolls away, the clock and battery still sit on peacock and never over light cards.

### 5.3 Loading and empty

- **Loading:** a skeleton in the shape of the screen's cards, as plain Line-coloured blocks, replaces the "Loading…"
  text. It does not shimmer, because nothing moves (§4.4).
- **Empty states:** they say what to do next. Example: "No expenses yet this month. Tap Add to log one."

### 5.4 iPhone details

- **Status bar:** `appleWebApp.statusBarStyle` becomes `black-translucent`, so the peacock header shows under the
  status bar. This makes the iPhone's clock and battery white, which is why every header is peacock and a peacock
  strip stays fixed behind the status bar (§5.2). The header already pads by `env(safe-area-inset-top)`. Settle this
  before the owner installs the app, because iPhone reads it at install time.
- **Theme colour:** `theme_color` in `app/manifest.ts` and `viewport.themeColor` become Peacock. `background_color`
  becomes Mist.
- **App icon:** the generated icon (`app/pwa-icon/[size]`) is redrawn in Peacock and Gold, so the Home Screen matches.
  The exact mark is left to the builder; a gold temple-border band on peacock is a natural fit.
- **No-signal banner:** the "Offline — figures as of 08:14" banner becomes a slim gold strip just under the status bar,
  with Ink text.

### 5.5 Tablet and desktop

- **Under 768 px wide:** the phone layout.
- **768 px and wider:** the content may grow to about 1,100 px, and Home goes to two columns (§6.5). Other screens use
  two columns where they have two natural halves; otherwise their content stays at a readable width of about 640 px,
  centred.
- **1,024 px and wider:** the bottom bar becomes a **left side rail** in Peacock deep, with the same five buttons, their
  names shown beside the icons, and the gold Add button at the top.
- **On a desktop:** hover gives the same subtle feedback as pressing does on a phone.

## 6. Home in detail

### 6.1 Top to bottom

Follow the approved mockup.

1. **Header (peacock):**
   - "Good evening" (or morning or afternoon, by the family's time zone), then the family name.
   - On the right:
     - the person's **initial** in a round chip, which opens Settings (my call: Settings needs a home now that the
       text link is gone)
     - a **bell**, which opens the Inbox, with a gold dot when anything is waiting.
2. **The pot (inside the header):**
   - "In the yearly bills pot", then the balance as the hero amount.
   - A pill: when no month in the 12-month forecast goes short, a gold tick and "Every dated bill for the next year is
     covered". When a month would go short, the pill turns pink and gives the PRD's warning with its fix. Example:
     "Short by ₹23,000 in June. Add ₹3,300 a month to fix it." A one-off top-up is shown the same way when only a
     top-up can fix it.
   - Then one line: "You add ₹36,917 to it each month".
   - Then one line: "Safe to spend now ₹X". This is kept from PRD §6.10, which lists it. The mockup left it out. (My
     call.)
3. **The temple border.**
4. **Speak, Scan, Type:** three equal buttons:
   - Speak (rani pink, white text) opens `/capture`; keep `data-testid="home-voice"`.
   - Scan (gold, Ink text) is "coming soon" (§6.2).
   - Type (white, peacock text) opens `/add`.

   Viewers do not see this row.
5. **Cards that appear only sometimes**, in this order: the 1st-of-month checklist, last month's review, next year's
   check, the year-end review, the Inbox count. They use the white card style, with a coloured icon tile on the left
   and the action as a peacock button or link.
6. **Next 3 months:** a white card with one row per month:
   - **The month badge:** a rounded square with the short month name and the year. The current month's badge is
     filled peacock.
   - **Each bill:** its icon, its name, the amount still owed, and a status line in words, taken from the bill's own
     status:
     - Planned or due soon, in the current month: "Due this month" (Ink).
     - Planned, in a later month: no status line; the month badge says when.
     - Overdue (an unpaid bill from an earlier month, which the forecast lists in the current month): "Overdue. Still
       to pay." (pink, with a warning icon). A bill that slipped past its month must stand out, because "nothing
       forgotten" is one of Home's three jobs.
     - Part paid: "Part paid" (gold). The amount shown is what is left.
     - Paid: "Paid" (leaf, with a tick).
   - **Whether the pot covers it:** said once per month, under that month's bills, from the forecast's end-of-month
     balance:
     - "The pot covers this month." (leaf, with a tick) when the balance is zero or more.
     - "The pot is short by ₹X at the end of this month." (pink) when it is below zero, where X is the shortfall.
   - **The shortfall belongs to the pot, not to a bill.** The forecast knows shortness only per month. It is never
     shared out between that month's bills (that would be a new money rule, and §2 rules those out). A month that is
     short only because an earlier month's shortfall carries forward reads the same way, because the figure is the
     pot's.
   - **A month with no bills:** "No yearly bills. The pot grows to ₹1,83,084." That is the forecast's end-of-month pot
     balance. If that balance is below zero, the short line above replaces it.
   - **Link:** "See the year" opens the Bills tab.
7. **Biggest month ahead:** a Peacock deep card for the month, in months 4–12 of the forecast, whose bills total the
   most. Months already shown in "Next 3 months" are skipped. The card shows:
   - "Biggest month ahead: June 2027"
   - the total, and the bill names in plain words
   - a gold bar for how much of that total the pot already holds today (capped at full)
   - one line: "The pot will have ₹X by then. You're on track." That is the balance going into that month: the
     previous month's end, plus that month's deposit. If a month on the way, or that month itself, goes short, the line
     gives the shortfall instead.

   The card is hidden when months 4–12 have no dated bills. (My call on "biggest" and on what the bar measures.)
8. **No month yet:** shown when any undated bills remain. It says "13 bills have no month yet", their total, and the
   names of the three largest. Then: "Give them a month so nothing is forgotten." Tapping it opens that year's plan.
9. **This month's spending:**
   - The heading is "November so far", with an "Open month" link.
   - Under it: "₹31,450 spent of ₹81,500".
   - Then a row of rings, one per spending group, sorted with the most used first. The row scrolls sideways when there
     are more than three. (My call: all groups, not just three.)
   - **Each ring:** the percentage used in the middle, and the group name and amount spent under it.
   - **Ring colour:** the family's spending-alert levels decide it (default 80% and 100%, set in Family settings):
     - Peacock below the first level.
     - Gold from the first level up to the plan.
     - Pink over the plan.
   - **Over plan:** the line under the ring says "₹2,300 over" in pink, so the colour is never the only signal.

### 6.2 Scan before Photo receipts

- The Scan button appears, with a small "Soon" tag. It looks the same as the live button apart from the tag.
- Tapping it shows a short message (a small sheet or toast): "Scanning bills is coming soon. For now, Speak or Type
  it." Nothing else happens.
- Stage 3 makes it live without changing its place.

### 6.3 Home's data additions

Home needs a few figures that `GetHomeSummaryUseCase` (`packages/domain/src/forecast/`) does not return yet. They all
come from data the forecast and month summary already compute. No new tables and no new money rules.

| Figure | Comes from |
|---|---|
| The monthly set-aside ("You add ₹X") | The forecast's set-aside for next month (as the forecast screen already does) |
| Each of the next 3 months' end-of-month pot balance | The forecast months |
| Whether each of those months goes short | The forecast's red months |
| Whether all 12 months are covered | The forecast's red months, empty or not |
| The biggest month in months 4–12: its month, total, bill names, the balance going into it, and whether any month up to it goes short | The forecast months and bills |
| This month's groups, each with planned and actual | The month summary |
| The family's alert levels | Family settings |
| The person's initial | The signed-in user (their email's first letter, until people have names) |

The existing fields stay, so nothing else breaks. These are domain changes, so they follow the architecture skills:
new fields on the use case's output, tested in the domain package. The page itself only formats them.

### 6.4 Home in other situations

- **No signal:** Home shows its last-seen copy with the gold no-signal strip (TRD §8.2). Nothing on Home needs the
  network to draw.
- **No bills at all in the next 3 months:** each month row says the pot grows, so the card is never empty.
- **No plan yet:** Home is not reached before setup, so this case does not arise.
- **A Viewer:** the same Home without the action row, and with the four-button bar.

### 6.5 Home on a tablet or desktop

Two columns:

- **Left:** the header with the pot, the action row, and Next 3 months.
- **Right:** the cards that appear sometimes, Biggest month ahead, No month yet, and This month's spending.

The temple border runs the full width under the header.

## 7. The other screens

The owner has not seen these. They follow Home's look using the rules below. The builder shows each one to the owner
as it is done, so a change of heart costs one screen, not all of them. Keep each screen's data, behaviour and wording
unless a line below says otherwise.

### 7.1 Add an expense (`/add`)

- **Top of the screen:** big Speak and Scan buttons, the same as on Home. Speak opens `/capture`, and Scan is "coming
  soon".
- **The form below** keeps its fields and their order. Only the look changes:
  - The **amount** comes first and largest: Baloo at about 40 px, with the currency sign beside it, on a white card.
    Its accessible name stays "Amount".
  - The item, date, shop and note fields are tall (52 px), filled with Mist, and have 16 px corners. The item picker
    keeps its name "Item".
  - "Yesterday" becomes a chip beside the date.
  - "Split" and "Refund" are quiet secondary controls.
- **Save:** a full-width peacock button, kept visible just above the bottom bar. Its name stays "Save".
- **"Saved ₹300.00." and the other confirmations** appear as a leaf-green toast. The wording does not change, because
  the phone test reads it.
- **"Same purchase?"** becomes a bottom sheet.
- **The heading** "Add an expense" stays, for the test.

### 7.2 Speak (`/capture`) and the voice review

- The record button becomes a large rani-pink circle in the middle of the screen. The time limit shows under it.
- While recording, a gentle pulsing ring is the only moving thing. It answers the person's action, so it is allowed;
  with Reduce Motion it is a steady ring.
- In the voice review, each row is a white card in the add-form style. Confirm is the peacock button and Discard is a
  quiet one.
- Keep every `data-testid` (`voice-start`, `voice-expense-row`, `voice-confirm`, `voice-discard`) and the visible
  wording the test reads.

### 7.3 Budgets

- **The Budgets tab opens straight onto this month**, in place of today's list of four links. (My call.) It has a
  month switcher in the header: ‹ November 2026 ›. Templates stays reachable from a "Templates" button in the header.
- **The month screen:**
  - the total as a spent-of-planned bar
  - then one card per group, with its ring (colours as in §6.1) and its items as rows
  - each item row shows the name, the amount spent, and the plan
  - over-plan amounts in pink with "over"
  - the planned amount stays editable as today
  - savings get their own card
- **Templates** and the month-end review use the same card and row styles. The review's overs and unders get pink and
  leaf amounts, each with a word as well.
- Keep the `line-<item name>` test ids.

### 7.4 Bills (`/forecast` and `/year`)

- **The Bills tab opens on the 12-month view.** At the top, a peacock card with the safe-to-spend figure and the
  covered-or-short message.
- **A simple chart:** one bar per month for the end-of-month pot balance. Leaf bars are fine; a pink bar dips below
  the line where a month goes short. Each bar has its short month name under it.
- **Below the chart:** one row per month in the Home "Next 3 months" style: the month badge, its bills, and the in,
  out and end amounts in plain words. This replaces today's table, and keeps `data-testid="forecast-months"` on the
  list.
- **"No month yet" bills** are listed in their own card, with a button to give each a month.
- **The year plan** (`/year/[y]`) shows every bill with its icon, amount, month (or "No month yet") and status chip.
  The year review and year-end screens reuse those rows.

### 7.5 Activity, All expenses, Inbox

- **Activity:** a timeline. Each entry has the person's initial in a coloured circle (peacock for one adult, rani pink
  for the other), what happened in words, and when. "All expenses", "Install" and Settings are reachable from the
  header.
- **All expenses** (`/ledger`): rows with the item's icon, the shop and item, who added it and how (a small mic, scan
  or keyboard icon), and the amount on the right. The filters become chips across the top.
- **Inbox:** each waiting question is a white card, with its two answers as two buttons.

### 7.6 Settings, setup, sign-in, join, install

- **Sign-in, join and the first screen of setup** use the peacock header with the temple border and the app name in
  Baloo. Below it is a white card holding the form.
- **The setup steps** show their step progress in the header. They are a real sequence, so numbered steps fit.
- **The Install guide** keeps its pictures, framed in white cards.
- **Settings** uses grouped white cards with rows, in the iPhone Settings style.

## 8. The quality floor

- **Accessibility:**
  - Colour contrast meets WCAG AA for text (check the gold and leaf cases).
  - Every icon-only button has a name.
  - Keyboard focus is visible: a 2 px gold ring on peacock, or a peacock ring on white.
  - The page still reads in order with styles off.
- **Reduced motion is respected** (§4.4).
- **The tests keep passing:** the phone test (`apps/web/test/e2e/core.spec.ts`) finds things by their accessible names,
  their visible wording and the `data-testid`s listed above. Keep those, or update the test in the same change with
  the reason given.
- **Wording:** every new string goes in `apps/web/messages/en.json`, including the bottom-bar names, "Coming soon",
  the greetings and every status line. No string is written in a component.
- **Offline:** the service worker still never precaches pages. Fonts and icons are part of the app shell and must work
  with no signal.
- **Old parts:** the hand-copied shadcn/ui parts (`Card`, `Button`, `Input`) are restyled to the new tokens or replaced.
  No screen keeps the old green-and-zinc look.

## 9. How the owner approves

- **The owner's choice (2026-11-05): computer first.**
  - While building, the owner checks each screen on their computer. The builder runs the app locally
    (`docs/RUNBOOK.md` §7) with the fictional `pnpm seed:dev` data and shows it in a phone-sized window (iPhone 15
    width).
  - The fictional data has to produce every case worth seeing: a ring over plan, a ring nearly used, a short month, an
    overdue bill, a part-paid bill, an empty month, undated bills and a waiting Inbox item. If it doesn't, the builder
    adds fictional rows to the dev seed. None of these ever goes into production data.
  - The owner checks on their iPhone once the approved work is deployed live. Committing and deploying still wait for
    the owner to ask (CLAUDE.md).
- **Not used:**
  - a local copy on the iPhone, which can't sign in over the home network because the session cookie needs HTTPS
  - a Vercel preview, which would use the production database
- The order is the frame first, then Home, then Add, then Budgets, Bills, Activity, and the rest.
- The owner approves Home and Add before the rest are restyled.
- The stage is done when the owner approves the screens (TRD §15).

## 10. My calls (for the owner to check)

1. **Add goes straight to the typing screen**, which now has Speak and Scan at its top. It does not open a pop-up menu,
   so typing costs no extra tap (§5.1).
2. **Settings moves behind your initial** on Home's header, and the bell opens the Inbox (§6.1).
3. **"Safe to spend now" stays** as a line in the pot header, because the PRD lists it (§6.1).
4. **"Biggest month ahead"** looks at months 4–12. Its gold bar shows how much of that month's total the pot already
   holds (§6.1).
5. **All spending groups get a ring**, sorted most-used first, in a row you can swipe sideways (§6.1).
6. **Ring colours follow your spending-alert levels** (80% and 100% unless you change them) (§6.1).
7. **Budgets opens straight onto this month**, and Bills opens on the 12-month view (§7.3, §7.4).
8. **Icons are picked from each group's name**, with a plain fallback, so no data changes (§4.3).
9. **No dark mode** in this stage (§2).
10. **The leaf green is a shade darker** than in the mockup, so small text is easy to read (§4.1).
11. **"Next 3 months" says once per month whether the pot covers it**, not on each bill. It says "Short by ₹X" for the
    month when the pot would run short. Overdue bills say "Overdue. Still to pay." in pink, so none is missed (§6.1).
12. **Every screen's header is peacock**, including the deeper screens, so the iPhone's white clock and battery
    always show (§5.2).

## 11. Left to the builder

- How the slide transitions are built (§4.4), and the exact skeleton shapes.
- The icon set, and the exact app-icon mark.
- Whether the old `components/ui` parts are restyled or replaced.
- Small spacing and size adjustments, within the type sizes and corner rounding above.
- How the Home data additions are named and shaped in the domain, within the architecture skills.
