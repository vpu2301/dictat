// fieldActions.js — Sprint 13 step 02: the confirm/override/dismiss
// mechanics, pure. Every function returns a section-meta PATCH
// ({ icd10?, field_specific_metadata? }) for Studio's onSectionMetaChange —
// the one draft-save path — or null for "invalid, do nothing". No renderer
// ever builds a payload by hand; useFieldConfirm wraps these for React.
//
// Every non-clearing patch is validated against the pinned metadata
// contract (parseFieldMeta) before it leaves this module: a bug in a
// renderer can produce a no-op, never a 422 or a corrupted draft.
//
// Diagnosis is special by contract: confirm MOVES a proposal's code into
// section.icd10 (never a source flip), so buildConfirm refuses
// structured_diagnosis — use buildConfirmProposal(code).

import {
  parseFieldMeta,
  isProposal,
  confirmMeta,
  overrideChoice,
  overrideMultiChoice,
  overrideNumeric,
  overrideDate,
  confirmDiagnosis,
  removeDiagnosisCode,
  exclusiveOptionValue,
  normalizeIcd10Code,
  normalizeIcd10List,
} from "./fieldContract.js";

const CLEAR = { field_specific_metadata: {} };

function validated(fieldType, patch) {
  if (!patch) return null;
  const meta = patch.field_specific_metadata;
  if (meta && Object.keys(meta).length) {
    if (!parseFieldMeta(fieldType, meta).ok) return null;
  }
  return patch;
}

// Confirm the extracted value as-is: source flips to manual, confidence
// dropped. Only valid on a live proposal (confirming nothing, or
// re-confirming a manual value, is a no-op).
export function buildConfirm(section, entry) {
  const ft = section?.field_type;
  if (ft === "structured_diagnosis") return null; // per-code: buildConfirmProposal
  const meta = entry?.field_specific_metadata;
  if (!isProposal(meta)) return null;
  return validated(ft, { field_specific_metadata: confirmMeta(meta) });
}

// Override (or first-fill) with a clinician-chosen value. `value` shape by
// field_type: choice → "slug" | null; multi_choice → ["slug", ...];
// numeric_with_unit → { value, unit }; date/date_with_note → "YYYY-MM-DD".
// Clearing (null choice / empty multi list) is legal; a malformed value
// (bad date, non-finite number) returns null — never a destructive write.
export function buildOverride(section, value) {
  switch (section?.field_type) {
    case "choice":
      return validated("choice", overrideChoice(value));
    case "multi_choice":
      return validated("multi_choice", overrideMultiChoice(value));
    case "numeric_with_unit":
      // null = explicit clear (the confirmed chip's remove affordance);
      // a malformed value stays a null no-op via validation below.
      if (value == null) return CLEAR;
      return validated("numeric_with_unit", overrideNumeric(value.value, value.unit));
    case "date":
    case "date_with_note":
      // null/"" = explicit clear ("" is a native date input being emptied).
      if (value == null || value === "") return CLEAR;
      return validated(section.field_type, overrideDate(value));
    default:
      return null; // free_text / structured_diagnosis have no override
  }
}

// Dismiss the proposal: metadata cleared, prose left exactly as dictated
// (the safety fallback — the record is never worse than plain dictation).
// For structured_diagnosis this clears the STAGING area only; confirmed
// codes in section.icd10 are untouched (the patch carries no icd10 key).
export function buildDismiss(section, entry) {
  if (!isProposal(entry?.field_specific_metadata)) return null;
  return CLEAR;
}

// ── multi_choice per-chip mechanics (step 03) ──────────────────────────────
// The pinned contract carries ONE `source` for the whole selection, so a
// partial confirm (this chip manual, the rest still staged) is
// UNREPRESENTABLE. The honest per-chip semantics are:
//   confirm one  → the manual set becomes exactly [value]; the other
//                  proposals drop to plain chips (prose intact — nothing
//                  dictated is lost, only staging). To accept a subset,
//                  dismiss the wrong ones then «Підтвердити всі».
//   dismiss one  → shrink the extracted set; the rest STAYS a proposal
//                  (source/confidence kept); the last dismissal clears.

export function buildConfirmOne(section, entry, value) {
  if (section?.field_type !== "multi_choice") return null;
  const meta = entry?.field_specific_metadata;
  if (!isProposal(meta) || !(meta.selected || []).includes(value)) return null;
  return validated("multi_choice", { field_specific_metadata: { source: "manual", selected: [value] } });
}

export function buildDismissValue(section, entry, value) {
  if (section?.field_type !== "multi_choice") return null;
  const meta = entry?.field_specific_metadata;
  if (!isProposal(meta) || !(meta.selected || []).includes(value)) return null;
  const rest = meta.selected.filter((v) => v !== value);
  if (!rest.length) return CLEAR;
  return validated("multi_choice", {
    field_specific_metadata: { source: "extracted", confidence: meta.confidence, selected: rest },
  });
}

// The next selection after toggling `value` — override semantics: the
// result is always a manual set (the clinician actively edited it), built
// from whatever is currently selected (extracted or manual). Honors the
// exclusive-option convention when the template flags one.
export function nextMultiSelection(section, entry, value) {
  const cur = entry?.field_specific_metadata?.selected || [];
  const exclusive = exclusiveOptionValue(section);
  if (cur.includes(value)) return cur.filter((v) => v !== value);
  if (exclusive && value === exclusive) return [value];            // exclusive clears others
  const base = exclusive ? cur.filter((v) => v !== exclusive) : cur; // others clear exclusive
  return [...base, value];
}

// Diagnosis: confirm one proposal by code → moves it into section.icd10.
export function buildConfirmProposal(section, entry, code) {
  if (section?.field_type !== "structured_diagnosis" || !code) return null;
  const patch = confirmDiagnosis(entry, code);
  // confirmDiagnosis no-ops (returns the same staging area) on a miss;
  // surface that as null so callers don't issue a pointless state write.
  const before = entry?.field_specific_metadata?.proposals?.length ?? 0;
  const after = patch.field_specific_metadata?.proposals?.length ?? 0;
  return before === after ? null : patch;
}

// Diagnosis: remove a confirmed code from section.icd10 (proposals untouched).
export function buildRemoveCode(section, entry, code) {
  if (section?.field_type !== "structured_diagnosis" || !code) return null;
  const before = entry?.icd10?.length ?? 0;
  const patch = removeDiagnosisCode(entry, code);
  return patch.icd10.length === before ? null : patch;
}

// Diagnosis: pick a SEARCH RESULT into section.icd10 (step 05). A picked
// code is an explicit clinician act — it lands directly in the confirmed
// list (icd10 is the single authority; no source flag exists there).
// Only leaf codes are pickable (the backend's is_leaf rule, enforced here
// as well as in the UI); duplicates no-op. The FE never invents a code —
// this and confirmProposal are the only two ways into section.icd10.
export function buildPickCode(section, entry, result) {
  if (section?.field_type !== "structured_diagnosis") return null;
  if (!result || result.is_leaf === false) return null;
  const code = normalizeIcd10Code({ code: result.code, display: result.display });
  if (!code) return null;
  const icd10 = normalizeIcd10List([...(entry?.icd10 || []), code]);
  if (icd10.length === (entry?.icd10 || []).length) return null; // already confirmed
  return { icd10 };
}

// Diagnosis: dismiss ONE proposal (drop from the staging area; confirmed
// codes untouched; the last dismissal clears the metadata).
export function buildDismissProposal(section, entry, code) {
  if (section?.field_type !== "structured_diagnosis" || !code) return null;
  const meta = entry?.field_specific_metadata;
  if (!isProposal(meta)) return null;
  const up = String(code).toUpperCase();
  const rest = (meta.proposals || []).filter((p) => p && String(p.code).toUpperCase() !== up);
  if (rest.length === (meta.proposals || []).length) return null;
  if (!rest.length) return CLEAR;
  return validated("structured_diagnosis", { field_specific_metadata: { ...meta, proposals: rest } });
}
