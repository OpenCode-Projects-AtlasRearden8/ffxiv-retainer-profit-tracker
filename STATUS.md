# STATUS — FFXIV Retainer Profit Tracker

Date: 2026-10-25
Owner: Asdale Dynamics, LLC

## What was built

A static, zero-dependency, offline single-file web app (`index.html`,
HTML/CSS/JS inline, localStorage only) for tracking FFXIV retainer venture
sales and marketboard reselling profit from **manual entries only** — no
scraping, no game-client access, no network calls of any kind.

Features shipped:

- Sale-entry form: date, item, retainer, quantity, buy/sell price per item,
  with a live profit preview as you type.
- Market-tax presets per data center (best-effort defaults for Aether,
  Primal, Crystal, Chaos, Light, JP, OCE, CN, KR), a Custom rate option, and
  an in-app editor to correct/adjust preset rates (persisted to localStorage).
- Overall summary: gil spent, net earned, tax paid, total profit, avg profit
  per entry.
- Per-retainer summaries ranked by profit.
- Best-margin rankings (percent return on gil spent; zero-cost items
  excluded from margin ranking since a margin is undefined there, though
  they still count toward profit).
- Weekly profit chart rendered in plain `#` characters (Monday-start weeks,
  plain numbers always visible).
- All-entries table with delete; JSON + CSV export; JSON import; bulk
  delete with confirmation.
- Starter example data (10 fictional entries, fictional item prices) loaded
  on first run via the "Load starter example data" button.

Math model: `tax = round(sellTotal x rate)`, `profit = sellTotal - tax -
buyTotal`, `margin = profit / buyTotal`. Documented in README and asserted
by tests.

## How to run

- Open `index.html` in any modern browser (double-click works; fully
  offline from the filesystem).
- Run checks with plain Node (v14+):
  - `node tests.js` — 53 assertions on tax/profit/summary/ranking/chart math.
  - `node smoke-test.js` — 20 assertions running the app's actual script
    blocks in a stubbed browser DOM, including an end-to-end form add,
    validation, persistence, example-data reload and preset editing.

## Verification results (2026-10-25)

- `node tests.js` — **53 passed, 0 failed**.
- `node smoke-test.js` — **20 passed, 0 failed**.
- Unit tests include tax rounding edge cases (5% of 999 -> 50 gil, 5% of
  749 -> 37 gil), boutique-tax preset bounds, negative-margin losing sales,
  zero-cost entrants exclusion, ISO-Monday week rolling (incl. New Year
  wrap), and plain-ASCII chart output.
- Smoke test found and fixed a real bug during development: the tax-preset
  editor's select was never populated (its key stayed empty), which would
  have written a bogus `''` preset key. Now populated and regression-tested.
- Test harness design: `tests.js` extracts the `<script id="core">` block
  verbatim from `index.html` and runs it in a `vm` sandbox, so the tested
  math and the shipped math are guaranteed identical.

## Known gaps / honest limitations

- Tax preset rates are static starting defaults; data-center market tax
  changes over time. The app labels this clearly and offers both Custom
  rates and an in-app preset editor, but it does not (and will not) fetch
  live rates.
- Tax is modeled per-entry as `round(sellTotal x rate)`; FFXIV applies tax
  at the moment of sale with its own rounding, and stack-size edge cases
  (tax computed per listing) may differ from bulk-entry math by a gil or
  two in rare cases.
- No editing of existing entries (delete + re-add only) — flagged as future
  work.
- No multi-currency or multi-character bookkeeping beyond the retainer
  field.
- localStorage data is per-browser-profile; there is no sync — export JSON
  is the only backup mechanism.
- Accessibility is decent (text-first chart, labeled inputs) but not yet
  audited with a screen reader.
