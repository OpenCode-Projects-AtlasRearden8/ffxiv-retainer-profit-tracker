'use strict';
/*
 * Tests for the FFXIV Retainer Profit Tracker's pure math core.
 * Run with:  node tests.js
 *
 * Zero dependencies: the core script is extracted verbatim from
 * index.html and evaluated in a fresh sandbox, so the math the app
 * ships with is exactly the math that gets tested.
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const html = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');
const coreMatch = html.match(/<script id="core">([\s\S]*?)<\/script>/);
if (!coreMatch) {
  console.error('FAIL: could not find core script block in index.html');
  process.exit(1);
}

const sandbox = {};
vm.createContext(sandbox);
vm.runInContext(coreMatch[1], sandbox, { filename: 'core.js' });

const {
  computeTax, entryTotals, summarize, byRetainer,
  bestMargins, weekStart, weeklyProfits, chartText,
  round2, formatGil, DEFAULT_TAX_PRESETS
} = sandbox;

let passed = 0;
let failed = 0;
function check(name, actual, expected) {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a === e) {
    passed++;
    console.log('  ok  ' + name);
  } else {
    failed++;
    console.error('FAIL  ' + name + '\n      expected: ' + e + '\n      actual:   ' + a);
  }
}

function entry(id, date, item, retainer, qty, buy, sell, taxRate) {
  return { id, date, item, retainer, qty, buy, sell, taxRate };
}

/* ---------- Tax math (the "boutique tax" presets) ---------- */
console.log('\n== tax math ==');
check('5% of 10,000 gil', computeTax(10000, 5), 500);
check('5% of 999 gil rounds to nearest gil (49.95 -> 50)', computeTax(999, 5), 50);
check('5% of 749 gil rounds down (37.45 -> 37)', computeTax(749, 5), 37);
check('0% tax yields 0 gil', computeTax(54321, 0), 0);
check('0 gil sale yields 0 tax even at 5%', computeTax(0, 5), 0);
check('3% tax (Crystal preset)', computeTax(1000, 3), 30);
check('7% custom rate', computeTax(1234, 7), 86);
check('fractional custom rate 0.5%', computeTax(999, 0.5), 5);

let threw = false;
try { computeTax(100, 101); } catch (e) { threw = true; }
check('tax rate over 100% throws', threw, true);
threw = false;
try { computeTax(100, -1); } catch (e) { threw = true; }
check('negative tax rate throws', threw, true);

check('default presets cover major data centers',
  ['Aether', 'Primal', 'Crystal', 'Chaos', 'Light', 'Elemental (JP)', 'Gaia (JP)', 'Mana (JP)']
    .every(k => typeof DEFAULT_TAX_PRESETS[k] === 'number'), true);
check('preset rates are all 0..100',
  Object.values(DEFAULT_TAX_PRESETS).every(r => r >= 0 && r <= 100), true);

/* ---------- Entry totals ---------- */
console.log('\n== entry profit math ==');
const e1 = entry(1, '2026-10-05', 'Grade 6 Tektite', 'Brie', 20, 480, 700, 5);
check('totals: tax on 14,000 at 5%', entryTotals(e1).tax, 700);
check('totals: net', entryTotals(e1).net, 13300);
check('totals: profit (net - 9,600 spent)', entryTotals(e1).profit, 3700);
check('totals: margin rounded to 2 places', entryTotals(e1).marginPct, 38.54);
check('totals: buy total', entryTotals(e1).buyTotal, 9600);
check('totals: sell total', entryTotals(e1).sellTotal, 14000);

const e2 = entry(2, '2026-10-06', 'Celery', 'Onion', 60, 95, 160, 0);
check('zero-tax entry keeps everything', entryTotals(e2).profit, 60 * 160 - 60 * 95);
check('zero-tax entry pays no tax', entryTotals(e2).tax, 0);

const e3 = entry(3, '2026-10-07', 'Snacks', 'Onion', 5, 100, 90, 5);
check('losing sale has negative profit', entryTotals(e3).profit, -73);
check('losing sale has negative margin', entryTotals(e3).marginPct, -14.6);

const e4 = entry(4, '2026-10-07', 'Self-gathered', 'Brie', 10, 0, 500, 5);
check('free items have null margin (excluded from rankings)', entryTotals(e4).marginPct, null);
check('free item still records profit', entryTotals(e4).profit, 4750);
check('per-item profit', entryTotals(e1).profitPerUnit, 185);

/* ---------- Summaries ---------- */
console.log('\n== summaries ==');
const s = summarize([e1, e2, e3]);
check('summary adds profits (3700 + 3900 - 73)', s.profit, 7527);
check('summary adds tax (700 + 0 + 23)', s.tax, 723);
check('summary adds quantities', s.qty, 85);
check('empty entry list', summarize([]).profit, 0);

/* ---------- Per-retainer ---------- */
console.log('\n== per-retainer summaries ==');
const e5 = entry(5, '2026-10-08', 'Vest', 'Brie', 1, 12000, 21000, 5);
const rows = byRetainer([e1, e2, e3, e5]);
check('groups all retainers', rows.map(r => r.retainer).sort(), ['Brie', 'Onion']);
check('sorted by profit, best first', rows.map(r => r.retainer), ['Brie', 'Onion']);
check('Brie totals include both sales', rows[0].totals.profit,
  entryTotals(e1).profit + entryTotals(e5).profit);
check('retainer sale counts', byRetainer([e1, e5])[0].count, 2);

/* ---------- Rankings ---------- */
console.log('\n== best-margin rankings ==');
const ranked = bestMargins([e1, e2, e3, e4, e5]);
check('free items excluded from rankings', ranked.length, 4);
check('ranked strictly by margin descending',
  ranked[0].totals.marginPct >= ranked[1].totals.marginPct &&
  ranked[1].totals.marginPct >= ranked[2].totals.marginPct, true);
check('Celery (68.42% margin) outranks Vest (66.25%)', ranked[0].entry.item, 'Celery');
const tie = bestMargins([e1, entry(9, '2026-10-09', 'BigTiny', 'B', 1, 50, 200, 25)]);
check('higher margin outranks bigger gil profit', tie[0].entry.item, 'BigTiny');

/* ---------- Weeks ---------- */
console.log('\n== weekly chart ==');
check('Monday 2026-10-05 starts its own week', weekStart('2026-10-05'), '2026-10-05');
check('Tuesday 2026-10-06 rolls back to Monday', weekStart('2026-10-06'), '2026-10-05');
check('Sunday 2026-10-11 stays in same week', weekStart('2026-10-11'), '2026-10-05');
check('Sunday 2026-10-25 rolls back to 2026-10-19', weekStart('2026-10-25'), '2026-10-19');
check('New Year wraps correctly (Wed 2027-01-06 -> Mon 2027-01-04)', weekStart('2027-01-06'), '2027-01-04');

const wk = weeklyProfits([e1, e2, e3]);
check('weeks sorted oldest first', wk.map(w => w.week), ['2026-10-05']);
check('week profit sums its entries', wk[0].profit, 7527);
const wk2 = weeklyProfits([e1, entry(6, '2026-10-12', 'Thing', 'Brie', 1, 0, 100, 0)]);
check('separate weeks produce separate rows', wk2.map(w => w.week), ['2026-10-05', '2026-10-12']);

/* ---------- Chart text ---------- */
console.log('\n== chart rendering ==');
const chart = chartText(weeklyProfits([e1, entry(6, '2026-10-12', 'Thing', 'Brie', 1, 0, 100, 0)]), w => 'W' + w);
check('chart has one line per week', chart.split('\n').length, 2);
check('chart shows weeks in order', /2026-10-05/.exec(chart) !== null && chart.indexOf('2026-10-05') < chart.indexOf('2026-10-12'), true);
check('chart uses only plain characters', /^[\x20-\x7E\n]*$/.test(chart), true);
const bigger = chartText(weeklyProfits([e1, entry(6, '2026-10-12', 'Thing', 'Brie', 1, 0, 14000, 0)]), w => w);
const lines = bigger.split('\n');
check('bigger week gets the longer bar', lines[1].split('#').length > lines[0].split('#').length, true);
check('empty chart message', chartText([]), 'No entries yet.');

/* ---------- Formatting helpers ---------- */
console.log('\n== formatting ==');
check('round2(38.541666)', round2(38.54166666666666), 38.54);
check('round2 avoids float dust', round2(0.1 + 0.2), 0.3);
check('formatGil adds thousands separators', formatGil(1234567), '1,234,567');

/* ---------- Summary ---------- */
console.log('\n===============================');
console.log(`${passed} passed, ${failed} failed`);
console.log('===============================');
process.exit(failed === 0 ? 0 : 1);
