// Sprint 13 step 02 — confirm/override/dismiss build EXACTLY the pinned
// draft-PUT fragments (§8: assert the exact fragment), invalid input is a
// null no-op (never a destructive write), and the diagnosis variants route
// through the move-to-icd10 mechanics.
//
//   npm run test:unit
import { test } from "node:test";
import assert from "node:assert/strict";

import {
  buildConfirm,
  buildOverride,
  buildDismiss,
  buildConfirmProposal,
  buildRemoveCode,
  buildConfirmOne,
  buildDismissValue,
  nextMultiSelection,
} from "./fieldActions.js";

const sec = (field_type) => ({ id: "s1", field_type });
const proposalEntry = {
  field_specific_metadata: { source: "extracted", confidence: 0.87, selected: "retrosternal" },
};

test("confirm: exact fragment — source manual, confidence dropped, value unchanged", () => {
  assert.deepEqual(buildConfirm(sec("choice"), proposalEntry), {
    field_specific_metadata: { source: "manual", selected: "retrosternal" },
  });
});

test("confirm is proposal-only: nothing, manual, and diagnosis all no-op", () => {
  assert.equal(buildConfirm(sec("choice"), {}), null);
  assert.equal(buildConfirm(sec("choice"), {
    field_specific_metadata: { source: "manual", selected: "x" },
  }), null);
  // structured_diagnosis has no whole-field confirm — per-code only.
  assert.equal(buildConfirm(sec("structured_diagnosis"), {
    field_specific_metadata: { source: "extracted", confidence: 0.8, proposals: [{ code: "I10", confidence: 0.8 }] },
  }), null);
});

test("override: exact fragments per field type", () => {
  assert.deepEqual(buildOverride(sec("choice"), "left_arm"),
    { field_specific_metadata: { source: "manual", selected: "left_arm" } });
  assert.deepEqual(buildOverride(sec("multi_choice"), ["smoking", "diabetes"]),
    { field_specific_metadata: { source: "manual", selected: ["smoking", "diabetes"] } });
  assert.deepEqual(buildOverride(sec("numeric_with_unit"), { value: 42, unit: "%" }),
    { field_specific_metadata: { source: "manual", value: 42, unit: "%" } });
  assert.deepEqual(buildOverride(sec("date"), "2026-07-15"),
    { field_specific_metadata: { source: "manual", date: "2026-07-15" } });
  assert.deepEqual(buildOverride(sec("date_with_note"), "2026-07-15"),
    { field_specific_metadata: { source: "manual", date: "2026-07-15" } });
});

test("override: clearing is legal for choice kinds (empty dict, never selected: [])", () => {
  assert.deepEqual(buildOverride(sec("choice"), null), { field_specific_metadata: {} });
  assert.deepEqual(buildOverride(sec("multi_choice"), []), { field_specific_metadata: {} });
});

test("override: malformed values are null no-ops, never destructive writes", () => {
  assert.equal(buildOverride(sec("numeric_with_unit"), { value: NaN, unit: "%" }), null);
  assert.equal(buildOverride(sec("numeric_with_unit"), { value: 42, unit: "" }), null);
  assert.equal(buildOverride(sec("date"), "2026-02-30"), null);
  assert.equal(buildOverride(sec("date"), "next tuesday"), null);
  assert.equal(buildOverride(sec("free_text"), "anything"), null);
  assert.equal(buildOverride(sec("structured_diagnosis"), "I10"), null);
});

test("dismiss: clears metadata only when a proposal exists; prose is never touched", () => {
  const patch = buildDismiss(sec("choice"), proposalEntry);
  assert.deepEqual(patch, { field_specific_metadata: {} });
  assert.equal("icd10" in patch, false); // diagnosis: staging cleared, confirmed codes untouched
  assert.equal(buildDismiss(sec("choice"), {}), null);
  assert.equal(buildDismiss(sec("choice"), {
    field_specific_metadata: { source: "manual", selected: "x" },
  }), null);
});

// ── multi_choice per-chip mechanics (step 03) ──────────────────────────────

const multiProposal = {
  field_specific_metadata: { source: "extracted", confidence: 0.74, selected: ["smoking", "hypertension"] },
};

test("confirmOne: the manual set becomes exactly that value (partial staging is unrepresentable)", () => {
  assert.deepEqual(buildConfirmOne(sec("multi_choice"), multiProposal, "smoking"),
    { field_specific_metadata: { source: "manual", selected: ["smoking"] } });
  assert.equal(buildConfirmOne(sec("multi_choice"), multiProposal, "diabetes"), null); // not proposed
  assert.equal(buildConfirmOne(sec("multi_choice"), {
    field_specific_metadata: { source: "manual", selected: ["smoking"] },
  }, "smoking"), null); // manual → nothing to confirm
  assert.equal(buildConfirmOne(sec("choice"), multiProposal, "smoking"), null);
});

test("dismissValue: shrinks the extracted set keeping source+confidence; last one clears", () => {
  assert.deepEqual(buildDismissValue(sec("multi_choice"), multiProposal, "smoking"),
    { field_specific_metadata: { source: "extracted", confidence: 0.74, selected: ["hypertension"] } });
  const one = { field_specific_metadata: { source: "extracted", confidence: 0.74, selected: ["smoking"] } };
  assert.deepEqual(buildDismissValue(sec("multi_choice"), one, "smoking"),
    { field_specific_metadata: {} });
  assert.equal(buildDismissValue(sec("multi_choice"), multiProposal, "diabetes"), null);
});

test("nextMultiSelection: toggle add/remove from the current set (extracted or manual)", () => {
  const s = sec("multi_choice");
  assert.deepEqual(nextMultiSelection(s, multiProposal, "diabetes"),
    ["smoking", "hypertension", "diabetes"]);
  assert.deepEqual(nextMultiSelection(s, multiProposal, "smoking"), ["hypertension"]);
  assert.deepEqual(nextMultiSelection(s, {}, "smoking"), ["smoking"]);
});

test("nextMultiSelection honors a backend-flagged exclusive option (and only then)", () => {
  const flagged = {
    id: "s1", field_type: "multi_choice",
    options: [
      { value: "penicillin", label: "Пеніцилін" },
      { value: "none_known", label: "Немає відомих", exclusive: true },
    ],
  };
  const cur = { field_specific_metadata: { source: "manual", selected: ["penicillin"] } };
  assert.deepEqual(nextMultiSelection(flagged, cur, "none_known"), ["none_known"]); // clears others
  const none = { field_specific_metadata: { source: "manual", selected: ["none_known"] } };
  assert.deepEqual(nextMultiSelection(flagged, none, "penicillin"), ["penicillin"]); // clears exclusive
  // No flag from the backend → plain toggle (the documented limitation).
  const unflagged = { ...flagged, options: flagged.options.map(({ exclusive, ...o }) => o) };
  assert.deepEqual(nextMultiSelection(unflagged, none, "penicillin"), ["none_known", "penicillin"]);
});

test("confirmProposal: moves the code, null on a miss or wrong field type", () => {
  const entry = {
    icd10: [{ code: "I10" }],
    field_specific_metadata: {
      source: "extracted", confidence: 0.82,
      proposals: [{ code: "I20.0", display: "НС", confidence: 0.82 }],
    },
  };
  const patch = buildConfirmProposal(sec("structured_diagnosis"), entry, "I20.0");
  assert.deepEqual(patch.icd10.map((c) => c.code), ["I10", "I20.0"]);
  assert.deepEqual(patch.field_specific_metadata, {}); // last proposal consumed
  assert.equal(buildConfirmProposal(sec("structured_diagnosis"), entry, "Z99"), null);
  assert.equal(buildConfirmProposal(sec("choice"), entry, "I20.0"), null);
});

test("removeCode: removes only that code, null when absent", () => {
  const entry = { icd10: [{ code: "I10" }, { code: "I20.0" }] };
  assert.deepEqual(buildRemoveCode(sec("structured_diagnosis"), entry, "I10"),
    { icd10: [{ code: "I20.0" }] });
  assert.equal(buildRemoveCode(sec("structured_diagnosis"), entry, "E11.9"), null);
  assert.equal(buildRemoveCode(sec("choice"), entry, "I10"), null);
});
