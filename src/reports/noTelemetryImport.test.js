// Sprint 13 step 02 — hygiene tripwires (§4.3), extending the S10/S11
// pattern from src/patients/noTelemetryImport.test.js:
//  1. No report-fields module may import the telemetry sink — option
//     values and ICD codes are safe to RENDER, but nothing routes them to
//     analytics. Build-time grep, not a convention.
//  2. The proposal chrome (pgm- class vocabulary) lives ONLY in
//     src/reports/proposal/ (+ the stylesheet) — renderers in steps 03–05
//     must compose the primitives, never restyle the grammar (§9).
//
//   npm run test:unit
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, dirname, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";

const REPORTS = dirname(fileURLToPath(import.meta.url));
const SRC = join(REPORTS, "..");

const FORBIDDEN_IMPORTS = [
  /from\s+["'][^"']*autocomplete\/telemetry(\.js)?["']/,
  /import\s+[^;]*\btelemetry\b[^;]*from/,
];

const walk = (dir, out = []) => {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.(js|jsx)$/.test(name)) out.push(p);
  }
  return out;
};

test("no report-fields module imports the telemetry sink", () => {
  const offenders = [];
  for (const p of walk(REPORTS)) {
    if (p.endsWith(".test.js")) continue;
    const src = readFileSync(p, "utf8");
    if (FORBIDDEN_IMPORTS.some((re) => re.test(src))) offenders.push(relative(SRC, p));
  }
  assert.deepEqual(offenders, []);
});

test("proposal chrome (pgm- classes) lives only in reports/proposal/ and the stylesheet", () => {
  const offenders = [];
  for (const p of walk(SRC)) {
    if (p.split(sep).includes("proposal")) continue;   // the grammar's home
    if (p.endsWith(".test.js")) continue;              // tests assert on the classes
    if (readFileSync(p, "utf8").includes("pgm-")) offenders.push(relative(SRC, p));
  }
  assert.deepEqual(offenders, []);
});
