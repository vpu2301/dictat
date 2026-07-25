// finalizeViolations.js — Sprint 13 step 06: the finalize gating surface's
// copy + rendering + routing. THE RULE (§4.3): the backend validator is the
// ONLY source of block reasons — this module renders the 422 payload's
// items ({field, code, detail, section_key, reason}) and routes to the
// offending section; it contains no "is this filled?" logic and never
// will. (The preview's required-sections banner is a labeled soft HINT and
// never disables finalize — the server speaks on the round-trip.)
//
// Copy is keyed on `code` (BE step 06), falling back to `reason` for
// pre-S13 payloads (sprint-08 emitted required_empty/below_min_chars/
// missing_icd10 there) — that fallback IS the zero-regression guarantee.
// diagnosis_not_confirmed vs missing_icd10 get DISTINCT copy: the first
// means a proposal exists and the fix is one confirm tap away.

import React from "react";
import { CONFIRM_BUTTON_SELECTOR } from "./proposal/selectors.js";

const h = React.createElement;
const uk = (lang) => lang === "uk";

// → the short, section-anchored reason line. Unknown/future codes get the
// generic fallback (a newer backend validator must never break the surface).
export function violationCopy(v, lang) {
  switch (v?.code || v?.reason) {
    case "choice_not_selected":
      return uk(lang) ? "Оберіть значення" : "Select a value";
    case "numeric_not_filled":
      return uk(lang) ? "Вкажіть значення та одиницю" : "Enter a value and unit";
    case "date_not_filled":
      return uk(lang) ? "Вкажіть дату" : "Enter a date";
    case "missing_icd10":
      // NOT «Вкажіть діагноз» (the step-06 spec's draft copy): the dictated
      // diagnosis TEXT is usually right there — what's missing is a
      // confirmed code, and saying "enter a diagnosis" next to a visible
      // diagnosis reads as a system bug (user report, 2026-07-24).
      return uk(lang) ? "Додайте код МКХ-10 (пошук у розділі)" : "Add an ICD-10 code (search in the section)";
    case "diagnosis_not_confirmed":
      return uk(lang)
        ? "Підтвердіть запропонований діагноз"
        : "Confirm the proposed diagnosis";
    // Pre-S13 copy, unchanged (regression bar):
    case "min_chars":
    case "below_min_chars":
      return uk(lang) ? "Замало тексту в розділі" : "Section text is too short";
    case "required_empty":
      return uk(lang) ? "Обов'язковий розділ не заповнено" : "Required section is empty";
    default:
      return uk(lang) ? "Заповніть цей розділ" : "Complete this section";
  }
}

export const jumpLabel = (lang) => (uk(lang) ? "Перейти" : "Go to");

// The per-section violation rows + the «перейти» action. Renders ONLY from
// the 422 payload's items — given none, renders nothing, whatever the
// document looks like (that absence is the server-authority guard's test).
// `hideJumpCodes`: violation codes whose fix lives WHERE THE NOTICE IS
// (e.g. the preview hosts the ICD-10 picker inline) — the reason still
// shows, the jump button doesn't.
export function ViolationNotice({ problems, sectionKey, lang, onJump, hideJumpCodes = [] }) {
  if (!problems?.length) return null;
  return h(
    "div",
    { className: "rp-sec-problem", role: "alert" },
    problems.map((p, i) =>
      h(
        "div",
        { key: i, className: "rp-violation" },
        h("span", null, violationCopy(p, lang)),
        onJump && sectionKey && !hideJumpCodes.includes(p.code || p.reason)
          ? h(
              "button",
              {
                type: "button",
                className: "btn ghost sm rp-jump",
                onClick: () => onJump(sectionKey, p.code || p.reason || null),
              },
              jumpLabel(lang),
            )
          : null,
      ),
    ),
  );
}

// Land the clinician on the fix (§4.2): scroll the section into view and
// focus the most specific affordance — for diagnosis_not_confirmed the
// first proposal's CONFIRM button (the fix is one tap away); otherwise the
// typed widget's first control. Prose-only sections need no focus here —
// the caller's pickSection() already parks the caret in the section.
export function focusViolationTarget(sectionKey, code) {
  if (typeof document === "undefined" || !sectionKey) return false;
  const sec = document.querySelector(
    `section.tiptap-section[data-section-id="${CSS.escape(sectionKey)}"]`,
  );
  if (!sec) return false;
  try { sec.scrollIntoView({ behavior: "smooth", block: "center" }); } catch {}
  const mount = sec.querySelector(":scope > .field-widget-mount");
  const target =
    (code === "diagnosis_not_confirmed" && mount?.querySelector(CONFIRM_BUTTON_SELECTOR)) ||
    mount?.querySelector("button:not(:disabled), input:not(:disabled)") ||
    null;
  if (target) { try { target.focus(); } catch {} }
  return true;
}
