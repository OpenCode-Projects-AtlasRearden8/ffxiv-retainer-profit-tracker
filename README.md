# FFXIV Retainer Profit Tracker

A static, offline, single-file web app for tracking Final Fantasy XIV retainer
venture sales and marketboard reselling profit. You log each sale by hand —
no scraping, no automation, nothing that touches the game client or fansites
— and the app turns your own entries into plain, honest numbers.

Built by **Asdale Dynamics, LLC** as part of its collection of
beginner-friendly, local-first tools. Plain English, step by step, never
condescending. MIT licensed.

## What it does

- **Log a sale**: date, item name, retainer, quantity, buy price per item,
  sell price per item, and a market-tax preset.
- **Tax presets per data center** (per "data-center economy"): best-effort
  default rates for Aether, Primal, Crystal, Chaos, Light, the JP, OCE, CN
  and KR data centers, plus a Custom option. Preset rates are editable right
  in the app and stored locally — see the "Tax presets" disclosure section.
- **Overall summary**: gil spent, gil earned net of tax, tax paid, total
  profit, average profit per entry.
- **Per-retainer summaries**: each retainer's sales, quantity, spend, tax,
  net and profit, ranked best-first.
- **Best-margin rankings**: your top items ranked by percent return on the
  gil you spent (sourcing/self-gathered items, which have no buy cost, are
  excluded because a margin there would be meaningless).
- **Weekly profit chart**: a Monday-start week-by-week profit line rendered
  in plain `#` characters — the numbers are first-class, the bars are
  decoration, so screen readers and text readers get the same picture.
- **Imports/exports**: JSON and CSV export for your own files, JSON import
  to move data between browsers.
- **Starter example data**: ships with a small fictional dataset so you can
  click "Load starter example data" and explore before logging anything real.

## The math (no magic)

Every entry is taxed like FFXIV's market tax mechanic:

```
sell total = sell price x quantity
tax        = round(sell total x tax rate)        # rounded to the nearest gil
net        = sell total - tax
profit     = net - (buy price x quantity)
margin %   = profit / gil spent x 100            # only defined when you spent gil
```

That's it. The same functions (`computeTax`, `entryTotals`, `summarize`,
`bestMargins`, `weeklyProfits`) power the UI and the test suite.

**Note on tax presets:** FFXIV market tax rates vary by data center and
change over time as players set rates in each city. The shipped presets are
reasonable starting points, clearly labelled as possibly out of date — check
your ingame market tax and either pick the Custom rate or edit the preset.

## How to run it

Open `index.html`. That's the whole install. Double-click it, or open it in
any modern browser. It works offline from the file system; there are no
requests, no CDN, no analytics, no keys.

- Your entries live in `localStorage` under your browser profile. Clearing
  site data deletes them — use **Export JSON** for backup.
- To reset and start over: **Delete all entries** (asks first), or load the
  starter example data.
- Run tests:

```
node tests.js        # 53 checks on the profit and tax math
node smoke-test.js   # 20 checks running the real app scripts in a stubbed DOM
```

No dependencies, no build step — plain Node (v14+) and nothing else.

## Privacy

Everything is manual entry, stored only in your browser's localStorage.
Nothing is uploaded, fetched, or logged anywhere. No scraping, no
third-party plugins, no terms-of-service gray areas — just your numbers,
typed in by you.

## Files

| File           | Purpose                                          |
| -------------- | ------------------------------------------------ |
| `index.html`   | The entire app (HTML + CSS + JS in one file)     |
| `tests.js`     | Unit tests for the profit/tax math core          |
| `smoke-test.js`| Runs the full app against a stubbed browser DOM  |
| `STATUS.md`    | Current build status, verification, known gaps   |

## License

MIT — see `LICENSE`. Copyright (c) 2026 Asdale Dynamics, LLC.

FFXIV is a registered trademark of Square Enix. This is an unaffiliated
fan tool: it reads nothing from the game and talks to nothing online.
