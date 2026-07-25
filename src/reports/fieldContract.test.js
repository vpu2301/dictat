// Sprint 13 step 01 — the typed field_specific_metadata contract, pinned
// against the backend's report_models/field_metadata.py (read from source):
// source/confidence coupling, per-field-type shapes, extra-key rejection,
// the confirm transition (manual + confidence dropped), and the
// section-meta round-trip helpers.
//
//   npm run test:unit
import { test } from "node:test";
import assert from "node:assert/strict";

import {
  ICD10_CODE_RE,
  FIELD_TYPES,
  METADATA_FIELD_TYPES,
  fieldTypeAcceptsMetadata,
  parseFieldMeta,
  isProposal,
  isConfirmed,
  confirmMeta,
  normalizeIcd10Code,
  normalizeIcd10List,
  sectionMetaFromContent,
  optionLabel,
  confirmChoice,
  overrideChoice,
  overrideMultiChoice,
  overrideNumeric,
  overrideDate,
  confirmDiagnosis,
  removeDiagnosisCode,
  confidenceBand,
  FINALIZE_VIOLATION_CODES,
  violationsBySection,
  VOICE_FIELD_OPS,
} from "./fieldContract.js";

// ── registry shape ─────────────────────────────────────────────────────────

test("field type registry matches the backend enum", () => {
  assert.deepEqual(
    [...FIELD_TYPES].sort(),
    ["choice", "date", "date_with_note", "free_text", "multi_choice",
     "numeric_with_unit", "structured_diagnosis"].sort(),
  );
  assert.equal(fieldTypeAcceptsMetadata("free_text"), false);
  for (const ft of METADATA_FIELD_TYPES) assert.equal(fieldTypeAcceptsMetadata(ft), true);
});

// ── empty is always valid (every pre-S13 report) ───────────────────────────

test("empty metadata is valid for every field type, including free_text", () => {
  for (const ft of FIELD_TYPES) {
    assert.deepEqual(parseFieldMeta(ft, {}), { ok: true, meta: null });
    assert.deepEqual(parseFieldMeta(ft, null), { ok: true, meta: null });
    assert.deepEqual(parseFieldMeta(ft, undefined), { ok: true, meta: null });
  }
});

test("free_text rejects any non-empty metadata", () => {
  const r = parseFieldMeta("free_text", { source: "manual", selected: "x" });
  assert.equal(r.ok, false);
});

// ── source/confidence coupling (backend _StrictMeta) ───────────────────────

test("extracted requires confidence in [0,1]; manual must omit it", () => {
  assert.equal(parseFieldMeta("choice", { selected: "yes", source: "extracted" }).ok, false);
  assert.equal(parseFieldMeta("choice", { selected: "yes", source: "extracted", confidence: 1.2 }).ok, false);
  assert.equal(parseFieldMeta("choice", { selected: "yes", source: "extracted", confidence: 0.9 }).ok, true);
  assert.equal(parseFieldMeta("choice", { selected: "yes", source: "manual", confidence: 0.9 }).ok, false);
  assert.equal(parseFieldMeta("choice", { selected: "yes", source: "manual" }).ok, true);
  assert.equal(parseFieldMeta("choice", { selected: "yes", source: "robot" }).ok, false);
  // source is required whenever any other key is present
  assert.equal(parseFieldMeta("choice", { selected: "yes" }).ok, false);
});

test("unknown keys are rejected (extra=forbid)", () => {
  const r = parseFieldMeta("choice", { selected: "yes", source: "manual", note: "hi" });
  assert.equal(r.ok, false);
  assert.match(r.reason, /unknown key/);
});

// ── per-type shapes ────────────────────────────────────────────────────────

test("choice: selected is a 1..64-char string", () => {
  assert.equal(parseFieldMeta("choice", { selected: "", source: "manual" }).ok, false);
  assert.equal(parseFieldMeta("choice", { selected: "x".repeat(65), source: "manual" }).ok, false);
  const ok = parseFieldMeta("choice", { selected: "left_side", source: "manual" });
  assert.deepEqual(ok, { ok: true, meta: { source: "manual", selected: "left_side" } });
});

test("multi_choice: 1..50 unique values; empty selection is an empty dict, not []", () => {
  assert.equal(parseFieldMeta("multi_choice", { selected: [], source: "manual" }).ok, false);
  assert.equal(parseFieldMeta("multi_choice", { selected: ["a", "a"], source: "manual" }).ok, false);
  const ok = parseFieldMeta("multi_choice", { selected: ["a", "b"], source: "extracted", confidence: 0.7 });
  assert.equal(ok.ok, true);
  assert.deepEqual(ok.meta.selected, ["a", "b"]);
  assert.equal(ok.meta.confidence, 0.7);
});

test("structured_diagnosis: proposals 1..20, codes normalized to upper-case", () => {
  assert.equal(parseFieldMeta("structured_diagnosis", { proposals: [], source: "extracted", confidence: 0.8 }).ok, false);
  const ok = parseFieldMeta("structured_diagnosis", {
    source: "extracted", confidence: 0.8,
    proposals: [{ code: "i25.1", display: "ІХС", confidence: 0.8 }],
  });
  assert.equal(ok.ok, true);
  assert.deepEqual(ok.meta.proposals, [{ code: "I25.1", display: "ІХС", confidence: 0.8 }]);
  // proposal without confidence is invalid (the extractor always knows it)
  assert.equal(parseFieldMeta("structured_diagnosis", {
    source: "extracted", confidence: 0.8, proposals: [{ code: "I25.1" }],
  }).ok, false);
  // bad code shape
  assert.equal(parseFieldMeta("structured_diagnosis", {
    source: "extracted", confidence: 0.8, proposals: [{ code: "25.1", confidence: 0.8 }],
  }).ok, false);
});

test("numeric_with_unit: finite value + 1..32-char unit", () => {
  assert.equal(parseFieldMeta("numeric_with_unit", { value: NaN, unit: "mm", source: "manual" }).ok, false);
  assert.equal(parseFieldMeta("numeric_with_unit", { value: "5", unit: "mm", source: "manual" }).ok, false);
  assert.equal(parseFieldMeta("numeric_with_unit", { value: 5, unit: "", source: "manual" }).ok, false);
  const ok = parseFieldMeta("numeric_with_unit", { value: 5.4, unit: "mmol/L", source: "extracted", confidence: 0.66 });
  assert.equal(ok.ok, true);
  assert.equal(ok.meta.value, 5.4);
  assert.equal(ok.meta.unit, "mmol/L");
});

test("date / date_with_note: real ISO calendar dates only", () => {
  for (const ft of ["date", "date_with_note"]) {
    assert.equal(parseFieldMeta(ft, { date: "2026-02-30", source: "manual" }).ok, false);
    assert.equal(parseFieldMeta(ft, { date: "2026-7-2", source: "manual" }).ok, false);
    const ok = parseFieldMeta(ft, { date: "2026-02-28", source: "manual" });
    assert.deepEqual(ok, { ok: true, meta: { source: "manual", date: "2026-02-28" } });
  }
});

// ── proposal vs confirmed, and the confirm transition ──────────────────────

test("isProposal/isConfirmed key off source; confirmMeta flips and drops confidence", () => {
  const extracted = { source: "extracted", confidence: 0.9, selected: "yes" };
  assert.equal(isProposal(extracted), true);
  assert.equal(isConfirmed(extracted), false);

  const confirmed = confirmMeta(extracted);
  assert.deepEqual(confirmed, { source: "manual", selected: "yes" });
  assert.equal(isProposal(confirmed), false);
  assert.equal(isConfirmed(confirmed), true);
  // The confirmed shape must itself be contract-valid.
  assert.equal(parseFieldMeta("choice", confirmed).ok, true);
  // Original untouched (no mutation).
  assert.equal(extracted.confidence, 0.9);
});

// ── Icd10Code helpers ──────────────────────────────────────────────────────

test("ICD-10 code shape is the pinned backend pattern", () => {
  for (const good of ["A00", "I25.1", "M54.5", "C50.911", "Z00.00", "K35.8"]) {
    assert.match(good, ICD10_CODE_RE);
  }
  for (const badCode of ["a00x", "125.1", "I25.", "I2", "I25.12345"]) {
    assert.equal(ICD10_CODE_RE.test(badCode), false, badCode);
  }
  assert.deepEqual(normalizeIcd10Code({ code: "i25.1", display: "CAD" }), { code: "I25.1", display: "CAD" });
  assert.equal(normalizeIcd10Code({ code: "nope" }), null);
  assert.deepEqual(
    normalizeIcd10List([{ code: "i25.1" }, { code: "I25.1", display: "dup" }, { code: "bad" }]),
    [{ code: "I25.1" }],
  );
});

// ── section-meta round-trip ────────────────────────────────────────────────

test("sectionMetaFromContent keeps only sections that carry icd10 or metadata", () => {
  const content = {
    sections: [
      { section_key: "anamnesis", text: "prose only" },
      { section_key: "diagnosis", text: "ІХС", icd10: [{ code: "I25.1", display: "ІХС" }],
        field_specific_metadata: { source: "extracted", confidence: 0.8, proposals: [{ code: "I20.0", confidence: 0.8 }] } },
      { section_key: "pain", text: "", field_specific_metadata: { source: "manual", selected: "no_pain" } },
      { section_key: "empty_meta", text: "x", field_specific_metadata: {} },
    ],
  };
  const meta = sectionMetaFromContent(content);
  assert.deepEqual(Object.keys(meta).sort(), ["diagnosis", "pain"]);
  assert.deepEqual(meta.diagnosis.icd10, [{ code: "I25.1", display: "ІХС" }]);
  assert.equal(meta.diagnosis.field_specific_metadata.source, "extracted");
  assert.deepEqual(meta.pain, { field_specific_metadata: { source: "manual", selected: "no_pain" } });
  assert.deepEqual(sectionMetaFromContent(null), {});
});

// ── typed write-helpers (§6: fragments for the ONE draft-save path) ────────

test("confirmChoice: proposal becomes manual metadata, confidence gone, contract-valid", () => {
  const patch = confirmChoice({ source: "extracted", confidence: 0.87, selected: "retrosternal" });
  assert.deepEqual(patch, { field_specific_metadata: { source: "manual", selected: "retrosternal" } });
  assert.equal(parseFieldMeta("choice", patch.field_specific_metadata).ok, true);
});

test("overrideChoice: new manual value; empty clears to the empty dict", () => {
  assert.deepEqual(overrideChoice("left_arm"),
    { field_specific_metadata: { source: "manual", selected: "left_arm" } });
  assert.deepEqual(overrideChoice(null), { field_specific_metadata: {} });
});

test("overrideMultiChoice: dedupes, empty selection is an empty dict (never selected: [])", () => {
  assert.deepEqual(overrideMultiChoice(["smoking", "smoking", "diabetes"]),
    { field_specific_metadata: { source: "manual", selected: ["smoking", "diabetes"] } });
  assert.deepEqual(overrideMultiChoice([]), { field_specific_metadata: {} });
});

test("confirmDiagnosis MOVES the proposal's code into icd10 and out of the staging area", () => {
  const entry = {
    icd10: [{ code: "I10", display: "Гіпертензія" }],
    field_specific_metadata: {
      source: "extracted", confidence: 0.82,
      proposals: [
        { code: "I20.0", display: "Нестабільна стенокардія", confidence: 0.82 },
        { code: "I25.1", confidence: 0.61 },
      ],
    },
  };
  const one = confirmDiagnosis(entry, "I20.0");
  assert.deepEqual(one.icd10, [
    { code: "I10", display: "Гіпертензія" },
    { code: "I20.0", display: "Нестабільна стенокардія" },
  ]);
  // Remaining proposal stays staged; metadata still contract-valid.
  assert.deepEqual(one.field_specific_metadata.proposals, [{ code: "I25.1", confidence: 0.61 }]);
  assert.equal(parseFieldMeta("structured_diagnosis", one.field_specific_metadata).ok, true);

  // Consuming the LAST proposal clears the metadata entirely (proposals has
  // min-length 1 — an empty staging area is an empty dict).
  const two = confirmDiagnosis(one, "I25.1");
  assert.deepEqual(two.field_specific_metadata, {});
  assert.deepEqual(two.icd10.map((c) => c.code), ["I10", "I20.0", "I25.1"]);

  // Confirming an already-confirmed code never duplicates it.
  const again = confirmDiagnosis({ ...entry, icd10: two.icd10 }, "I20.0");
  assert.deepEqual(again.icd10.map((c) => c.code), ["I10", "I20.0", "I25.1"]);

  // Unknown code → no-op patch (same icd10, same metadata).
  const miss = confirmDiagnosis(entry, "Z99.9");
  assert.deepEqual(miss.icd10, entry.icd10);
  assert.deepEqual(miss.field_specific_metadata, entry.field_specific_metadata);
});

test("removeDiagnosisCode removes only the confirmed code; proposals untouched", () => {
  const entry = {
    icd10: [{ code: "I10" }, { code: "I20.0" }],
    field_specific_metadata: { source: "extracted", confidence: 0.8, proposals: [{ code: "I25.1", confidence: 0.8 }] },
  };
  const patch = removeDiagnosisCode(entry, "i20.0");
  assert.deepEqual(patch, { icd10: [{ code: "I10" }] });
});

test("overrideNumeric/overrideDate: raw builders (validation happens in fieldActions)", () => {
  assert.deepEqual(overrideNumeric(42, "%"),
    { field_specific_metadata: { source: "manual", value: 42, unit: "%" } });
  assert.deepEqual(overrideDate("2026-07-15"),
    { field_specific_metadata: { source: "manual", date: "2026-07-15" } });
});

test("confidenceBand: pinned thresholds (low < 0.6 ≤ medium < 0.85 ≤ high)", () => {
  assert.equal(confidenceBand(0), "low");
  assert.equal(confidenceBand(0.59), "low");
  assert.equal(confidenceBand(0.6), "medium");
  assert.equal(confidenceBand(0.84), "medium");
  assert.equal(confidenceBand(0.85), "high");
  assert.equal(confidenceBand(1), "high");
  assert.equal(confidenceBand(null), "low");     // absent confidence never inflates
  assert.equal(confidenceBand(NaN), "low");
});

// ── finalize violations + voice ops (pinned) ───────────────────────────────

test("finalize violation codes are pinned; violationsBySection groups and keeps unknown codes", () => {
  for (const c of ["choice_not_selected", "numeric_not_filled", "date_not_filled",
                   "diagnosis_not_confirmed", "missing_icd10", "min_chars"]) {
    assert.ok(FINALIZE_VIOLATION_CODES.includes(c), c);
  }
  const grouped = violationsBySection([
    { field: "sections.pain", code: "choice_not_selected", detail: "d", section_key: "pain", reason: "r" },
    { field: "sections.pain", code: "from_the_future", detail: null, section_key: "pain", reason: null },
    { code: "min_chars", detail: "too short" }, // no section_key → report-level
  ]);
  assert.equal(grouped.pain.length, 2);
  assert.equal(grouped.pain[1].code, "from_the_future"); // forward-compat: kept
  assert.equal(grouped[""].length, 1);
  assert.deepEqual(violationsBySection(null), {});
});

test("voice field ops are pinned", () => {
  assert.deepEqual(VOICE_FIELD_OPS,
    ["set_choice", "add_choice", "remove_choice", "mark_diagnosis_text"]);
});

test("optionLabel prefers the template label, falls back to the raw value", () => {
  const options = [{ value: "left", label: "Ліва сторона", voice_aliases: ["зліва"] }];
  assert.equal(optionLabel(options, "left"), "Ліва сторона");
  assert.equal(optionLabel(options, "gone_value"), "gone_value");
});
