// sectionCompleteness.js — Sprint 13 follow-up (user-reported bug
// 2026-07-24): the Studio's progress rail showed "6/6 · 100%" while
// finalize refused with missing_icd10 — completeness was counted from
// PROSE ONLY, but a structured_diagnosis section also needs a confirmed
// ICD-10 code, typed sections need a confirmed value, and min_chars
// applies to prose. The progress display and the validator must never
// tell opposite stories.
//
// SCOPE (step-06 rule intact): this mirrors the validator's known
// requirements as a PROGRESS HINT only — it colors dots and counts, it
// never gates the finalize button; the backend 422 remains the sole
// authority on blocking.

import { isConfirmed } from "./fieldContract.js";

// → "filled" | "partial" | "missing"  (the rail's existing vocabulary)
//   plus a machine-readable `gap` for the needs-attention hint:
//   null | "icd10" | "min_chars" | "confirm"
export function sectionProgress(section, body, sectionMeta) {
  const text = (body?.[section?.id] || "").trim();
  const entry = sectionMeta?.[section?.id] || {};
  const meta = entry.field_specific_metadata || null;
  const minChars = section?.min_chars || 0;

  // The validator only demands typed completeness (a confirmed ICD-10
  // code, a confirmed value) on sections the template marks `required` —
  // mirror that: a non-required diagnosis/typed section must not show a
  // gap finalize would never enforce.
  const required = !!section?.required;

  switch (section?.field_type) {
    case "structured_diagnosis": {
      const hasCode = (entry.icd10 || []).length > 0;
      if (!text && !hasCode) return { state: "missing", gap: null };
      if (!hasCode && required) return { state: "partial", gap: "icd10" }; // prose there, code missing
      if (hasCode && !text) return { state: "partial", gap: null };
      if (text.length < minChars) return { state: "partial", gap: "min_chars" };
      return { state: "filled", gap: null };
    }
    case "choice":
    case "multi_choice":
    case "numeric_with_unit":
    case "date":
    case "date_with_note": {
      if (isConfirmed(meta)) return { state: "filled", gap: null };
      // A machine proposal isn't done — finalize demands a confirmed value
      // (only on required sections).
      if (meta) return required
        ? { state: "partial", gap: "confirm" }
        : { state: "filled", gap: null };
      return text ? { state: "partial", gap: null } : { state: "missing", gap: null };
    }
    default: { // free_text and forward-compat unknown types
      if (!text) return { state: "missing", gap: null };
      if (text.length < Math.max(minChars, 30))
        return { state: "partial", gap: text.length < minChars ? "min_chars" : null };
      return { state: "filled", gap: null };
    }
  }
}

export function isSectionComplete(section, body, sectionMeta) {
  return sectionProgress(section, body, sectionMeta).state === "filled";
}

export function countComplete(sections, body, sectionMeta) {
  return (sections || []).filter((s) => isSectionComplete(s, body, sectionMeta)).length;
}

// Short rail hint for the gap, uk/en (en fallback per repo convention).
export function gapLabel(gap, lang) {
  const uk = lang === "uk";
  switch (gap) {
    case "icd10":     return uk ? "+ код МКХ-10" : "+ ICD-10 code";
    case "min_chars": return uk ? "замало тексту" : "too short";
    case "confirm":   return uk ? "підтвердіть" : "confirm";
    default:          return "";
  }
}
