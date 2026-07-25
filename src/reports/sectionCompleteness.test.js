// Sprint 13 follow-up — the user-reported contradiction (2026-07-24): the
// rail said "6/6 · 100%" while finalize refused with missing_icd10. The
// progress helper must mirror the validator's known requirements: a
// diagnosis with prose but no confirmed code is NOT done; typed sections
// need a CONFIRMED value; min_chars counts.
//
//   npm run test:unit
import { test } from "node:test";
import assert from "node:assert/strict";

import { sectionProgress, countComplete, gapLabel } from "./sectionCompleteness.js";

const diag = { id: "preop_diagnosis", field_type: "structured_diagnosis", required: true, min_chars: 10 };
const prose = { id: "procedure", field_type: "free_text", required: true, min_chars: 100 };
const choice = { id: "smoking", field_type: "choice", required: true, min_chars: 0 };

test("THE reported bug: diagnosis with prose but no code is partial with an icd10 gap — never filled", () => {
  const body = { preop_diagnosis: "Цукровий діабет другого типу. Діабетична остеоартропатія." };
  assert.deepEqual(sectionProgress(diag, body, {}), { state: "partial", gap: "icd10" });
  // Adding a confirmed code completes it.
  const meta = { preop_diagnosis: { icd10: [{ code: "E11.9" }] } };
  assert.deepEqual(sectionProgress(diag, body, meta), { state: "filled", gap: null });
});

test("diagnosis edge states: empty → missing; code without prose → partial", () => {
  assert.deepEqual(sectionProgress(diag, {}, {}), { state: "missing", gap: null });
  const codeOnly = { preop_diagnosis: { icd10: [{ code: "E11.9" }] } };
  assert.equal(sectionProgress(diag, {}, codeOnly).state, "partial");
});

test("free_text honors min_chars (the «Хід операції» case): short prose is partial", () => {
  assert.deepEqual(
    sectionProgress(prose, { procedure: "Тестовий хід операції" }, {}),
    { state: "partial", gap: "min_chars" });
  assert.equal(sectionProgress(prose, { procedure: "х".repeat(120) }, {}).state, "filled");
  // Pre-S13 behavior preserved: short prose without a min_chars rule is
  // "partial" under the old 30-char heuristic, no gap chip.
  assert.deepEqual(
    sectionProgress({ id: "note", field_type: "free_text", min_chars: 0 }, { note: "коротко" }, {}),
    { state: "partial", gap: null });
});

test("typed sections need a CONFIRMED value: proposals are partial with a confirm gap", () => {
  const extracted = { smoking: { field_specific_metadata: { source: "extracted", confidence: 0.9, selected: "never" } } };
  assert.deepEqual(sectionProgress(choice, {}, extracted), { state: "partial", gap: "confirm" });
  const manual = { smoking: { field_specific_metadata: { source: "manual", selected: "never" } } };
  assert.deepEqual(sectionProgress(choice, {}, manual), { state: "filled", gap: null });
});

test("non-required diagnosis/typed sections demand nothing finalize won't enforce", () => {
  // The validator only checks typed completeness on required sections —
  // a non-required diagnosis with prose but no code is DONE, no gap.
  const optDiag = { id: "preop_diagnosis", field_type: "structured_diagnosis", required: false, min_chars: 10 };
  const body = { preop_diagnosis: "Цукровий діабет другого типу. Діабетична остеоартропатія." };
  assert.deepEqual(sectionProgress(optDiag, body, {}), { state: "filled", gap: null });
  // A machine proposal on a non-required typed section counts as filled too.
  const optChoice = { id: "smoking", field_type: "choice", required: false };
  const extracted = { smoking: { field_specific_metadata: { source: "extracted", confidence: 0.9, selected: "never" } } };
  assert.deepEqual(sectionProgress(optChoice, {}, extracted), { state: "filled", gap: null });
  // Empty is still empty, required or not.
  assert.equal(sectionProgress(optDiag, {}, {}).state, "missing");
});

test("countComplete reproduces the honest counter (4/6, not 6/6)", () => {
  const sections = [
    diag, prose, choice,
    { id: "op", field_type: "free_text", min_chars: 10 },
    { id: "an", field_type: "free_text", min_chars: 10 },
    { id: "postop", field_type: "structured_diagnosis", required: true, min_chars: 10 },
  ];
  const body = {
    preop_diagnosis: "Цукровий діабет другого типу тексту достатньо",
    procedure: "х".repeat(120),
    op: "Тестова операція при діабеті тестова операція при діабеті",
    an: "Тестова анестезія при діабеті тестова анестезія при діабеті",
    postop: "Цукровий діабет 2 типу, ампутація стопи",
  };
  const meta = { smoking: { field_specific_metadata: { source: "manual", selected: "never" } } };
  // Both REQUIRED diagnosis sections lack their codes → 4 of 6, matching
  // what finalize would say.
  assert.equal(countComplete(sections, body, meta), 4);
});

test("non-required typed sections never show gaps finalize would not enforce", () => {
  const optDiag = { id: "d2", field_type: "structured_diagnosis", required: false, min_chars: 0 };
  assert.deepEqual(sectionProgress(optDiag, { d2: "додатковий діагноз текстом" }, {}),
    { state: "filled", gap: null });
  const optChoice = { id: "c2", field_type: "choice", required: false };
  const extracted = { c2: { field_specific_metadata: { source: "extracted", confidence: 0.8, selected: "x" } } };
  assert.deepEqual(sectionProgress(optChoice, {}, extracted), { state: "filled", gap: null });
});

test("gap labels are short and localized", () => {
  assert.equal(gapLabel("icd10", "uk"), "+ код МКХ-10");
  assert.equal(gapLabel("icd10", "en"), "+ ICD-10 code");
  assert.equal(gapLabel("confirm", "uk"), "підтвердіть");
  assert.equal(gapLabel(null, "uk"), "");
});
