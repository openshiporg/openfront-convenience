// Node's built-in test runner: the popover date/time field helpers (same strings as the native inputs).
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const root = path.resolve(__dirname, '..');

function load(relative) {
  const filename = path.resolve(root, relative);
  const output = ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022,
  } }).outputText;
  const module = { exports: {} };
  vm.runInNewContext(output, {
    module, exports: module.exports, Intl, Date, Number, String, BigInt, Math,
    require: (specifier) => load(path.relative(root, `${path.resolve(path.dirname(filename), specifier)}.ts`)),
  }, { filename });
  return module.exports;
}

const { dateKey, formatClock, formatDateKey, parseDateKey, splitLocalDateTime, timeOptions } = load('features/platform/lib/date-fields.ts');

test("date keys round-trip and reject impossible days", () => {
  assert.equal(dateKey(parseDateKey("2026-11-04")), "2026-11-04");
  assert.equal(parseDateKey("2026-02-30"), null);
  assert.equal(parseDateKey(""), null);
  assert.equal(formatDateKey("2026-11-04"), "Nov 4, 2026");
});

test("clock labels are 12-hour", () => {
  assert.equal(formatClock("00:00"), "12:00 AM");
  assert.equal(formatClock("07:05"), "7:05 AM");
  assert.equal(formatClock("12:30"), "12:30 PM");
  assert.equal(formatClock("23:45"), "11:45 PM");
});

test("time options cover the day and keep an off-step saved value", () => {
  const quarter = timeOptions(15);
  assert.equal(quarter.length, 96);
  assert.deepEqual(JSON.parse(JSON.stringify(quarter[0])), { value: "00:00", label: "12:00 AM" });
  const kept = timeOptions(15, "07:10").map((option) => option.value);
  assert.ok(kept.includes("07:10"));
  assert.deepEqual(JSON.parse(JSON.stringify(kept.slice(28, 31))), ["07:00", "07:10", "07:15"]);
});

test("datetime-local strings split into date and time", () => {
  assert.deepEqual(JSON.parse(JSON.stringify(splitLocalDateTime("2026-11-04T07:30"))), { date: "2026-11-04", time: "07:30" });
  assert.deepEqual(JSON.parse(JSON.stringify(splitLocalDateTime("2026-11-04"))), { date: "2026-11-04", time: "" });
  assert.deepEqual(JSON.parse(JSON.stringify(splitLocalDateTime(""))), { date: "", time: "" });
});
