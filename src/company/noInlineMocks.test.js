// noInlineMocks.test.js — keeps the owner console's honesty structural rather
// than a matter of remembering.
//
// The console mixes measured and invented numbers. That is defensible only
// while the invented ones are (a) all in one file and (b) all badged. Both
// properties decay silently the moment someone types a plausible number into a
// panel, so this test fails the build instead.

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const PANELS = join(HERE, "panels");

const panelFiles = readdirSync(PANELS).filter((f) => f.endsWith(".jsx"));
const read = (f) => readFileSync(join(PANELS, f), "utf8");

test("there are panels to check (guards against a silently-empty sweep)", () => {
  assert.ok(panelFiles.length >= 6, `expected ≥6 panels, found ${panelFiles.length}`);
});

test("no panel hard-codes a currency amount — mocks belong in mockData.js", () => {
  const offenders = [];
  for (const f of panelFiles) {
    const src = read(f);
    for (const [i, line] of src.split("\n").entries()) {
      // Ignore comments — prose may legitimately mention "$29".
      const code = line.replace(/\/\/.*$/, "").replace(/\/\*.*?\*\//g, "");
      // A literal like $18,400 or $1_250 typed straight into JSX.
      if (/\$\d[\d_,]{2,}/.test(code)) {
        offenders.push(`${f}:${i + 1} ${line.trim()}`);
      }
    }
  }
  assert.deepEqual(offenders, [],
    "hard-coded currency in a panel; move it to src/company/mockData.js and badge it as mock");
});

test("every panel importing mockData also imports the Provenance badge", () => {
  const offenders = [];
  for (const f of panelFiles) {
    const src = read(f);
    if (!src.includes("mockData.js")) continue;
    if (!/from\s+"\.\.\/provenance\.jsx"/.test(src)) offenders.push(f);
  }
  assert.deepEqual(offenders, [],
    "a panel renders mock data without importing Provenance — every mock must be badged");
});

test("every mock section in mockData.js states what would make it real", () => {
  const src = readFileSync(join(HERE, "mockData.js"), "utf8");
  // Each `export const MOCK_<X> = {` block must contain a `need:` key. The
  // series exports are plain arrays and carry their caveat at the use site.
  const blocks = src.split(/export const MOCK_/).slice(1);
  const objectBlocks = blocks.filter((b) => /^\w+\s*=\s*\{/.test(b));
  assert.ok(objectBlocks.length >= 5, `expected ≥5 mock objects, found ${objectBlocks.length}`);
  for (const b of objectBlocks) {
    const name = b.split(/\s|=/)[0];
    assert.match(b.split("\n};")[0], /need:/,
      `MOCK_${name} has no \`need\` — a placeholder without a route to becoming real is just a lie`);
  }
});

test("mockData.js is the only source of fabricated business figures", () => {
  // Any panel that shows revenue/churn/CAC language must get it from mockData.
  const suspicious = /\b(mrrUsd|arrUsd|cacUsd|ltvUsd|churnPct|csatPct|runwayMonths)\b/;
  const offenders = [];
  for (const f of panelFiles) {
    const src = read(f);
    if (suspicious.test(src) && !src.includes("mockData.js")) offenders.push(f);
  }
  assert.deepEqual(offenders, [], "business figures used without importing mockData.js");
});
