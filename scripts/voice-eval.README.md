# voice-eval — which speech service hears your Tamil?

This is the test behind the Stage 2 gate. It takes your own recordings, sends each one to **both** speech services,
runs both parse models over what each heard, and tells you how often the amount and the item came out right.

You decide from the result. Nothing in the app depends on a guess.

## 1. Record

Five or six to start with, from **both adults**. Use Voice Memos on the iPhone — no need for NestWise.

Say each one the way you really would: a batch of expenses in one go, not one item per recording.

Mix them on purpose:

- two mostly Tamil, using Tamil number words (*irunooru*, *aayiram*)
- one with Tamil and English in the same sentence
- one in a noisy place — the market, or the car with the window down
- one with a yearly bill in it ("bike insurance 1500 paid")
- one deliberately long, over 30 seconds, to prove the long-clip path

## 2. Put them somewhere outside this repository

They are recordings of your family, so they must never reach git. Somewhere like:

```
D:/Mouni/voice-samples/
  market-1.m4a
  kitchen-1.m4a
  car-1.m4a
  expected.json
```

The script refuses a folder inside the repository.

## 3. Write down the right answers

`expected.json` sits beside the audio. For each clip, list what *should* come out, in whatever order:

```json
{
  "market-1.m4a": {
    "seconds": 15,
    "entries": [
      { "amountMinor": 25000, "itemId": "groceries" },
      { "amountMinor": 50000, "itemId": "non_veg" }
    ]
  },
  "car-1.m4a": {
    "seconds": 9,
    "entries": [{ "amountMinor": 150000, "yearLineId": "bike_ins" }]
  }
}
```

- `amountMinor` is **paise**: ₹250 is `25000`.
- `itemId` for everyday spending, `yearLineId` for a yearly bill. Use the keys from the plan — `groceries`,
  `fruits`, `vegetables`, `non_veg`, `outside_food`, `petrol`, `books_cloud`, `bike_ins`, `car_ins`, and so on. They
  are listed in `docs/NestWise_Sample_Budget_and_Expense_Data.md`. `miscellaneous` is there too, for one-offs.
- `seconds` is optional but worth adding: neither service reports the length of a Sarvam clip, so without it the
  speech cost for Sarvam reads as zero.

A clip with no entry in `expected.json` still runs — you will see what each service heard — but it is reported as
**unscored** rather than wrong.

## 4. Run it

```bash
pnpm voice-eval --audio "D:/Mouni/voice-samples"
```

Keys come from the two `.env.local` files automatically: `OPENAI_API_KEY` at the repo root, `SARVAM_API_KEY` in
`apps/web`. A service whose key is missing is skipped with a warning, so you can run with one of them.

## 5. Read it

You get a summary table — amount right and item right, as a percentage, per service and parse model — then every
clip with the exact words each service heard.

The pass marks are **amount ≥ 90%** and **item ≥ 80%** (PRD §8 decision 18). On a handful of clips the percentages
are rough; they are there to show whether one service is clearly better at Tamil before the full set of 30.

Two files are written next to your recordings: `voice-eval-report.txt` and `voice-eval-result.json`. Neither goes
into git.
