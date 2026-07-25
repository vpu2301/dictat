// copy.js — Sprint 13 step 02: the proposal grammar's microcopy, uk primary
// with en fallback (matching the repo's tr() convention — every non-uk
// language falls back to en). Centralized so all renderers speak the same
// words; a11y strings live here too because the announcement IS part of the
// grammar (the distinction must never be color-only OR visual-only).

const uk = (lang) => lang === "uk";

export const proposedTag = (lang) =>
  uk(lang) ? "Запропоновано з диктування — підтвердьте" : "Proposed from dictation — confirm";

export const confirmLabel = (lang) => (uk(lang) ? "Підтвердити" : "Confirm");
export const dismissLabel = (lang) => (uk(lang) ? "Відхилити" : "Dismiss");
// multi_choice set-level actions (step 03).
export const confirmAllLabel = (lang) => (uk(lang) ? "Підтвердити всі" : "Confirm all");
export const dismissAllLabel = (lang) => (uk(lang) ? "Відхилити всі" : "Dismiss all");
export const changeLabel  = (lang) => (uk(lang) ? "Змінити" : "Change");
export const removeLabel  = (lang) => (uk(lang) ? "Прибрати" : "Remove");

// Screen-reader announcements (§4.1): state is announced, not implied.
export const ariaProposal = (label, lang) =>
  uk(lang) ? `${label} — запропоновано, не підтверджено` : `${label} — proposed, not confirmed`;
export const ariaConfirmed = (label, lang) =>
  uk(lang) ? `${label} — підтверджено` : `${label} — confirmed`;
export const ariaConfirmAction = (label, lang) =>
  uk(lang) ? `Підтвердити: ${label}` : `Confirm: ${label}`;
export const ariaDismissAction = (label, lang) =>
  uk(lang) ? `Відхилити: ${label}` : `Dismiss: ${label}`;
export const ariaRemoveAction = (label, lang) =>
  uk(lang) ? `Прибрати: ${label}` : `Remove: ${label}`;

// Confidence bands — words, never numbers, in the primary view. The precise
// percentage appears only in the hover title (see ConfidenceDot).
export const bandLabel = (band, lang) => ({
  low:    uk(lang) ? "низька впевненість"  : "low confidence",
  medium: uk(lang) ? "середня впевненість" : "medium confidence",
  high:   uk(lang) ? "висока впевненість"  : "high confidence",
}[band] || (uk(lang) ? "впевненість невідома" : "confidence unknown"));
