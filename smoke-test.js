'use strict';
/*
 * Smoke test: runs the full browser app (all script blocks extracted
 * verbatim from index.html) against a minimal DOM + localStorage stub,
 * then simulates real interactions: adding an entry from the form,
 * replacing with example data, and rendering every section.
 *
 * Run with:  node smoke-test.js
 *
 * This catches typos, missing element ids, stray references and other
 * runtime errors that pure math tests can't see.
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const html = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');
const scripts = [...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)]
  .map(m => m[1]);
if (scripts.length < 2) {
  console.error('FAIL: expected at least 2 script blocks (core + app) in index.html');
  process.exit(1);
}

let passed = 0, failed = 0;
function check(name, actual, expected) {
  const a = JSON.stringify(actual), e = JSON.stringify(expected);
  if (a === e) { passed++; console.log('  ok  ' + name); }
  else { failed++; console.error('FAIL  ' + name + '\n      expected: ' + e + '\n      actual:   ' + a); }
}

/* Seed stub inputs with the defaults declared in the HTML markup
 * (e.g. <input ... value="1">), matching real browser behaviour. */
const inputDefaults = new Map();
for (const m of html.matchAll(/<input\b[^>]*>/g)) {
  const tag = m[0];
  const id = /id="([^"]+)"/.exec(tag);
  const val = /\bvalue="([^"]*)"/.exec(tag);
  if (id && val && !val[1].includes('file')) inputDefaults.set(id[1], val[1]);
}

function makeElement(id) {
  return {
    id, value: inputDefaults.get(id) || '', innerHTML: '', textContent: '', hidden: false, dataset: {}, files: [],
    _listeners: {},
    addEventListener(type, fn) { (this._listeners[type] ||= []).push(fn); },
    focus() {}, click() {
      (this._listeners.click || []).forEach(fn => fn());
    },
    setAttribute() {}
  };
}

const elements = new Map();
function $(id) {
  if (!elements.has(id)) elements.set(id, makeElement(id));
  return elements.get(id);
}

const store = new Map();
const sandbox = {
  console,
  document: {
    getElementById: $,
    querySelectorAll: () => [],       // del buttons are re-queried; none in stub
    createElement: (tag) => makeElement(tag)
  },
  localStorage: {
    getItem: k => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => store.set(k, String(v)),
    removeItem: k => store.delete(k)
  },
  confirm: () => true,
  URL: { createObjectURL: () => 'blob:x', revokeObjectURL: () => {} },
  Blob: function (parts) { this. size = (parts && parts[0] || '').length; },
  FileReader: function () { this.readAsText = () => { if (this.onload) this.onload(); }; },
  setTimeout, clearTimeout, Number, String, Date, Array, Map, Set,
  JSON, Error, Object, Math, RegExp, Promise
};
Object.keys(sandbox.dailyTest || {}).length; // no-op
sandbox.window = sandbox;
vm.createContext(sandbox);

try {
  scripts.forEach((code, i) => {
    vm.runInContext(code, sandbox, { filename: 'script-' + i + '.js' });
  });
  check('app scripts evaluated without throwing', true, true);
} catch (err) {
  console.error('FAIL: app script threw on load: ' + err.stack);
  process.exit(1);
}

/* Default form state after load */
check('date input pre-filled to today', /^\d{4}-\d{2}-\d{2}$/.test($('date').value), true);
check('starter example data loaded by default', sandbox.entries.length, 10);
check('overall stats rendered', $('overall-stats').innerHTML.includes('Total profit'), true);
check('retainer table rendered rows', $('retainer-table').innerHTML.includes('<tr>'), true);
check('ranking table rendered', $('ranking-table').innerHTML.includes('Grade 6 Tektite'), true);
check('weekly chart has week lines', $('weekly-chart').textContent.includes('Week of 2026-10-05'), true);
check('entries table rendered', $('entries-table').innerHTML.includes('Raider\u2019s Crafted Vest'), true);
check('live preview computed', $('live-preview').textContent.length > 0, true);

/* Simulate filling the form and clicking Add */
$('item').value = 'Test Nagoya Soba';
$('retainer').value = 'SmokeTest';
$('qty').value = '3';
$('buy').value = '500';
$('sell').value = '1000';
$('taxpreset').value = 'Chaos';
$('add').click();
check('Add accepted the entry (10 -> 11)', sandbox.entries.length, 11);
const added = sandbox.entries[10];
check('added entry fields', [added.item, added.retainer, added.qty, added.buy, added.sell, added.taxRate],
  ['Test Nagoya Soba', 'SmokeTest', 3, 500, 1000, 4]);
check('added entry persisted to localStorage', (store.get('ffxiv_rpt_entries_v1') || '').includes('Test Nagoya Soba'), true);
check('profit shown correctly somewhere (tax 4% on 3000 gil)', (() => {
  const t = sandbox.entryTotals(added);
  return [t.sellTotal, t.tax, t.profit];
})(), [3000, 120, 1380]);

/* Invalid form input is rejected with a message */
$('item').value = '';
$('add').click();
check('empty item rejected', sandbox.entries.length, 11);
check('error message shown', $('form-error').textContent.includes('item'), true);

/* Example data reload */
$('examples').click();
check('example data restore works', sandbox.entries.length, 10);

/* Preset rates render into the select and rate editing path is wired */
check('tax preset list non-empty', Object.keys(sandbox.taxPresets).length > 5, true);
check('preset editor populated with a valid key', sandbox.taxPresets[$('preset-edit').value] !== undefined, true);
$('preset-rate').value = '6';
$('save-presets').click();
check('preset rate saved', sandbox.taxPresets[$('preset-edit').value], 6);
check('save message confirmed', $('preset-msg').textContent.includes('Saved'), true);

console.log('\n===============================');
console.log(`${passed} passed, ${failed} failed`);
console.log('===============================');
process.exit(failed === 0 ? 0 : 1);
