// Sprint 13 step 01 — the fixtures are only useful if they are EXACTLY the
// pinned shapes: every fixture must survive the contract module's own
// validation, and (mock-data-in-tests-only rule) no app code may import the
// fixtures module.
//
//   npm run test:unit
import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

import {
  parseFieldMeta, sectionMetaFromContent, violationsBySection,
  VOICE_FIELD_OPS, VOICE_OP_FAIL_REASONS, ICD10_CODE_RE,
} from "./fieldContract.js";
import {
  FIXTURE_TEMPLATE, EXTRACTED_META, MANUAL_META, FIXTURE_DRAFT_CONTENT,
  FIXTURE_ICD10_SEARCH, FIXTURE_FINALIZE_PROBLEMS, FIXTURE_VOICE_OPS,
} from "./fieldFixtures.js";

test("every extracted/manual metadata fixture is contract-valid for its field type", () => {
  for (const [ft, meta] of Object.entries(EXTRACTED_META)) {
    const r = parseFieldMeta(ft, meta);
    assert.equal(r.ok, true, `${ft}: ${r.reason}`);
    assert.equal(r.meta.source, "extracted");
  }
  for (const [ft, meta] of Object.entries(MANUAL_META)) {
    const r = parseFieldMeta(ft, meta);
    assert.equal(r.ok, true, `${ft}: ${r.reason}`);
    assert.equal(r.meta.source, "manual");
  }
});

test("the draft-content fixture's sections validate against the template's field types", () => {
  const ftByKey = new Map(FIXTURE_TEMPLATE.sections.map((s) => [s.id, s.field_type]));
  for (const s of FIXTURE_DRAFT_CONTENT.sections) {
    const ft = ftByKey.get(s.section_key);
    assert.ok(ft, `unknown section ${s.section_key}`);
    const r = parseFieldMeta(ft, s.field_specific_metadata || {});
    assert.equal(r.ok, true, `${s.section_key}: ${r.reason}`);
    for (const c of s.icd10 || []) assert.match(c.code, ICD10_CODE_RE);
  }
  // And the Studio round-trip helper picks up exactly the meta-bearing sections.
  const meta = sectionMetaFromContent(FIXTURE_DRAFT_CONTENT);
  assert.deepEqual(
    Object.keys(meta).sort(),
    ["diagnosis", "lvef", "onset_date", "pain_location", "risk_factors"],
  );
});

test("choice/multi_choice template fixtures carry 2..50 options; metadata selections resolve", () => {
  for (const s of FIXTURE_TEMPLATE.sections) {
    if (["choice", "multi_choice"].includes(s.field_type)) {
      assert.ok(s.options.length >= 2 && s.options.length <= 50, s.id);
    } else {
      assert.equal(s.options.length, 0, s.id);
    }
  }
  const pain = FIXTURE_TEMPLATE.sections.find((s) => s.id === "pain_location");
  assert.ok(pain.options.some((o) => o.value === EXTRACTED_META.choice.selected));
});

test("icd10-search, finalize-problems, and voice-op fixtures match the pinned shapes", () => {
  for (const r of FIXTURE_ICD10_SEARCH.results) {
    assert.equal(typeof r.code, "string");
    assert.equal(typeof r.display, "string");
    assert.equal(typeof r.is_leaf, "boolean");
  }
  const grouped = violationsBySection(FIXTURE_FINALIZE_PROBLEMS);
  assert.equal(grouped.diagnosis.length, 2); // diagnosis_not_confirmed AND missing_icd10
  for (const op of FIXTURE_VOICE_OPS) {
    if (op.op === "unknown") {
      assert.ok(VOICE_OP_FAIL_REASONS.includes(op.arg.reason));
    } else {
      assert.ok(VOICE_FIELD_OPS.includes(op.op), op.op);
    }
  }
});

test("no app code imports the fixtures (tests only)", () => {
  const __dir = dirname(fileURLToPath(import.meta.url));
  const srcRoot = join(__dir, "..");
  const offenders = [];
  const walk = (dir) => {
    for (const name of readdirSync(dir)) {
      const p = join(dir, name);
      if (statSync(p).isDirectory()) { walk(p); continue; }
      if (!/\.(js|jsx)$/.test(name) || /\.test\.jsx?$/.test(name) || name.endsWith(".int.test.js")) continue;
      if (/fixtures/i.test(name)) continue; // fixture modules themselves
      if (readFileSync(p, "utf8").includes("fieldFixtures")) offenders.push(p);
    }
  };
  walk(srcRoot);
  assert.deepEqual(offenders, []);
});
