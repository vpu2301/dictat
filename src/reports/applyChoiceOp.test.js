// Sprint 13 step 07 — voice choice ops: set/add/remove semantics per field
// type, voice⇒manual provenance (identical fragments to a tapped chip —
// convergence), precise no-op reasons, registry routing over the WS
// fixture, mark_diagnosis_text as a hint-never-a-code, and the no-focus-
// theft guard (encoded as a source grep: the op path cannot contain a
// focus() call).
//
//   npm run test:unit
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

import { applyChoiceOp, voiceOpErrorMessage } from "./applyChoiceOp.js";
import { buildOverride } from "./fieldActions.js";
import { applyOperations } from "../dictation/operations.js";
import { FIXTURE_TEMPLATE, FIXTURE_VOICE_OPS } from "./fieldFixtures.js";

const ctxOf = (sectionMeta = {}) => ({ template: FIXTURE_TEMPLATE, sectionMeta });
const op = (name, arg) => ({ op: name, arg });
const choiceSec = FIXTURE_TEMPLATE.sections.find((s) => s.id === "pain_location");
const multiSec = FIXTURE_TEMPLATE.sections.find((s) => s.id === "risk_factors");

test("set_choice on choice: manual fragment, byte-identical to a manual tap (convergence VERIFY)", () => {
  const res = applyChoiceOp(op("set_choice", { section_id: "pain_location", value: "left_arm" }), ctxOf());
  assert.equal(res.sectionKey, "pain_location");
  assert.deepEqual(res.patch, { field_specific_metadata: { source: "manual", selected: "left_arm" } });
  // A voice set and a manual tap persist identically through draft-save.
  assert.deepEqual(res.patch, buildOverride(choiceSec, "left_arm"));
});

test("set_choice on multi_choice REPLACES the set with [value] (backend semantics)", () => {
  const meta = { risk_factors: { field_specific_metadata: { source: "manual", selected: ["smoking", "diabetes"] } } };
  const res = applyChoiceOp(op("set_choice", { section_id: "risk_factors", value: "hypertension" }), ctxOf(meta));
  assert.deepEqual(res.patch, { field_specific_metadata: { source: "manual", selected: ["hypertension"] } });
});

test("add_choice: appends to the manual set; idempotent when present; errors on single choice", () => {
  const meta = { risk_factors: { field_specific_metadata: { source: "manual", selected: ["smoking"] } } };
  const add = applyChoiceOp(op("add_choice", { section_id: "risk_factors", value: "diabetes" }), ctxOf(meta));
  assert.deepEqual(add.patch, { field_specific_metadata: { source: "manual", selected: ["smoking", "diabetes"] } });

  const dup = applyChoiceOp(op("add_choice", { section_id: "risk_factors", value: "smoking" }), ctxOf(meta));
  assert.equal(dup.patch, null); // idempotent, no toast

  const single = applyChoiceOp(op("add_choice", { section_id: "pain_location", value: "left_arm" }), ctxOf());
  assert.deepEqual(single.error, { code: "single_choice_add", value: "left_arm" });
});

test("add_choice overriding an EXTRACTED set promotes the whole edited set to manual (override semantics)", () => {
  const meta = { risk_factors: { field_specific_metadata: { source: "extracted", confidence: 0.7, selected: ["smoking"] } } };
  const res = applyChoiceOp(op("add_choice", { section_id: "risk_factors", value: "diabetes" }), ctxOf(meta));
  assert.deepEqual(res.patch, { field_specific_metadata: { source: "manual", selected: ["smoking", "diabetes"] } });
});

test("remove_choice: clears a matching single choice, prunes a multi set, idempotent otherwise", () => {
  const singleSel = { pain_location: { field_specific_metadata: { source: "manual", selected: "left_arm" } } };
  const clear = applyChoiceOp(op("remove_choice", { section_id: "pain_location", value: "left_arm" }), ctxOf(singleSel));
  assert.deepEqual(clear.patch, { field_specific_metadata: {} });
  const miss = applyChoiceOp(op("remove_choice", { section_id: "pain_location", value: "none" }), ctxOf(singleSel));
  assert.equal(miss.patch, null);

  const multiSel = { risk_factors: { field_specific_metadata: { source: "manual", selected: ["smoking", "diabetes"] } } };
  const prune = applyChoiceOp(op("remove_choice", { section_id: "risk_factors", value: "smoking" }), ctxOf(multiSel));
  assert.deepEqual(prune.patch, { field_specific_metadata: { source: "manual", selected: ["diabetes"] } });
});

test("unknown section / option / non-choice section → precise error codes with copy", () => {
  assert.deepEqual(
    applyChoiceOp(op("set_choice", { section_id: "ghost", value: "x" }), ctxOf()).error.code,
    "section_not_found");
  assert.deepEqual(
    applyChoiceOp(op("set_choice", { section_id: "pain_location", value: "misheard" }), ctxOf()).error,
    { code: "option_not_found", value: "misheard" });
  assert.deepEqual(
    applyChoiceOp(op("set_choice", { section_id: "anamnesis", value: "x" }), ctxOf()).error.code,
    "not_a_choice_section");

  assert.equal(voiceOpErrorMessage({ code: "option_not_found", value: "misheard" }, "uk"),
    "Не знайдено опцію «misheard»");
  assert.equal(voiceOpErrorMessage({ code: "not_a_choice_section" }, "uk"),
    "Цей розділ не підтримує вибір");
  assert.equal(voiceOpErrorMessage({ code: "single_choice_add" }, "uk"),
    "У цьому розділі можна обрати лише одне значення");
  assert.equal(voiceOpErrorMessage({ code: "whatever_else" }, "uk"),
    "Голосову команду не застосовано");
});

test("registry routing (VERIFY): the WS fixture ops reach the ctx; unresolved reason → precise toast path", () => {
  const routed = [];
  const r = applyOperations(FIXTURE_VOICE_OPS, {
    applyChoiceOp: (o) => routed.push(["choice", o.op, o.arg.section_id, o.arg.value]),
    markDiagnosisText: (t) => routed.push(["diag", t]),
    choiceOpFailed: (reason) => routed.push(["failed", reason]),
  });
  assert.deepEqual(routed, [
    ["choice", "set_choice", "pain_location", "left_arm"],
    ["choice", "add_choice", "risk_factors", "diabetes"],
    ["choice", "remove_choice", "risk_factors", "smoking"],
    ["diag", "нестабільна стенокардія"],
    ["failed", "option_not_found"],
  ]);
  assert.equal(r.applied, 4);
  assert.equal(r.skipped, 1); // the unresolved one — surfaced, not silently dropped
});

test("mark_diagnosis_text is a HINT: the registry hands over text only — no code write path exists", () => {
  // The ctx receives a string; the only ways into section.icd10 are
  // buildConfirmProposal/buildPickCode (step 05) — mark_diagnosis_text
  // never touches them. Assert the routed payload is the bare text.
  let got = null;
  applyOperations([{ op: "mark_diagnosis_text", arg: { text: "стенокардія" } }], {
    markDiagnosisText: (t) => { got = t; },
  });
  assert.equal(got, "стенокардія");
});

test("NO FOCUS THEFT (VERIFY guard): the voice-op path contains no focus() call", () => {
  const dir = dirname(fileURLToPath(import.meta.url));
  for (const rel of ["applyChoiceOp.js", "../dictation/operations.js"]) {
    const src = readFileSync(join(dir, rel), "utf8");
    assert.doesNotMatch(src, /\.focus\(/, `${rel} must never touch focus`);
  }
  // And the reveal is scroll-only.
  const src = readFileSync(join(dir, "applyChoiceOp.js"), "utf8");
  assert.match(src, /scrollIntoView/);
});
