// applyChoiceOp.js — Sprint 13 step 07: the voice choice-ops' model
// mutation, pure. A backend-resolved op ({section_id, value}) becomes the
// SAME draft-save fragment a tapped chip produces (buildOverride →
// source:"manual") — voice and touch converge on one write path, and a
// voice selection renders CONFIRMED, not as a proposal: a spoken command
// is an explicit clinician act, not an unreviewed extraction (the
// provenance resolution recorded in the step-07 sign-off; finalize must
// not demand a re-confirm of something the clinician just said).
//
// Returns { sectionKey, patch } (patch null = idempotent no-op, no toast),
// or { error: { code, value? } } for the precise-toast cases. NOTHING in
// this module (or its callers' op path) touches focus or the editor
// selection — chip updates are model-driven and out-of-band (the no-focus-
// theft guard test greps for that).

import { optionByValue } from "./fieldContract.js";
import { buildOverride, nextMultiSelection } from "./fieldActions.js";

// Dispatched to seed the diagnosis picker from mark_diagnosis_text —
// a search hint, NEVER a code selection (the FE never invents a code).
export const ICD10_SEED_EVENT = "mdx:icd10-seed";

export function applyChoiceOp(op, { template, sectionMeta } = {}) {
  const sectionId = op?.arg?.section_id;
  const value = op?.arg?.value;
  const section = template?.sections?.find((s) => s.id === sectionId);
  if (!section) return { error: { code: "section_not_found", value } };

  const isChoice = section.field_type === "choice";
  const isMulti = section.field_type === "multi_choice";
  if (!isChoice && !isMulti) return { error: { code: "not_a_choice_section", value } };
  if (!optionByValue(section.options, value)) {
    return { error: { code: "option_not_found", value } };
  }

  const entry = sectionMeta?.[sectionId] || {};
  const cur = entry.field_specific_metadata?.selected;

  switch (op.op) {
    case "set_choice":
      // multi_choice `set` REPLACES the whole set with [value] (mirrors
      // the backend's documented semantics).
      return { sectionKey: sectionId, patch: buildOverride(section, isChoice ? value : [value]) };

    case "add_choice": {
      if (isChoice) return { error: { code: "single_choice_add", value } };
      const arr = Array.isArray(cur) ? cur : [];
      if (arr.includes(value)) return { sectionKey: sectionId, patch: null }; // already there
      return { sectionKey: sectionId, patch: buildOverride(section, nextMultiSelection(section, entry, value)) };
    }

    case "remove_choice": {
      if (isChoice) {
        if (cur !== value) return { sectionKey: sectionId, patch: null }; // not selected — idempotent
        return { sectionKey: sectionId, patch: buildOverride(section, null) };
      }
      const arr = Array.isArray(cur) ? cur : [];
      if (!arr.includes(value)) return { sectionKey: sectionId, patch: null };
      return { sectionKey: sectionId, patch: buildOverride(section, arr.filter((v) => v !== value)) };
    }

    default:
      return { error: { code: "unsupported_op", value } };
  }
}

// Precise, non-blocking toast copy for every no-op reason — a misheard
// option must never be a silent drop and never a wrong chip. Covers the
// backend's unresolvable reasons (option_not_found / not_a_choice_section)
// and the FE-detected ones.
export function voiceOpErrorMessage(error, lang) {
  const uk = lang === "uk";
  const v = error?.value ? `«${error.value}»` : "";
  switch (error?.code) {
    case "option_not_found":
      return uk
        ? (v ? `Не знайдено опцію ${v}` : "Не знайдено опцію")
        : (v ? `Option ${v} not found` : "Option not found");
    case "not_a_choice_section":
      return uk ? "Цей розділ не підтримує вибір" : "This section doesn't take a selection";
    case "single_choice_add":
      return uk ? "У цьому розділі можна обрати лише одне значення" : "This section takes a single value";
    case "section_not_found":
      return uk ? "Розділ не знайдено у звіті" : "Section not found in this report";
    default:
      return uk ? "Голосову команду не застосовано" : "Voice command not applied";
  }
}

// Subtle reveal for a voice-targeted section: scroll it into view so the
// update is visible — deliberately NO focus() anywhere on this path (the
// clinician's caret stays exactly where it is).
export function revealSection(sectionKey) {
  if (typeof document === "undefined" || !sectionKey) return false;
  const el = document.querySelector(
    `section.tiptap-section[data-section-id="${CSS.escape(sectionKey)}"]`,
  );
  if (!el) return false;
  try { el.scrollIntoView({ behavior: "smooth", block: "center" }); } catch {}
  return true;
}
