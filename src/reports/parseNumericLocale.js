// parseNumericLocale.js — Sprint 13 step 04: locale-aware decimal parsing
// for the numeric_with_unit renderer. uk dictation and typing use COMMA
// decimals ("36,6"); en uses dot — both parse to the same JSON number.
// Deliberately strict (§10: locale parsing is a classic bug farm — never a
// bare parseFloat on uk input):
//   accepted: optional sign, digits, at most ONE separator (comma or dot),
//             digits — "36,6", "36.6", "-5", "+7", "140"
//   rejected: thousands grouping ("1 234,5", "1.234,5"), double separators
//             ("36,6,6"), trailing separators ("36,"), units mixed in
//             ("36.6%"), anything else → null, never NaN.

const NUM_RE = /^([-+]?)(\d+)(?:[.,](\d+))?$/;

export function parseNumericLocale(raw) {
  if (typeof raw !== "string") return null;
  const m = NUM_RE.exec(raw.trim());
  if (!m) return null;
  const n = Number(`${m[1] === "-" ? "-" : ""}${m[2]}${m[3] ? `.${m[3]}` : ""}`);
  return Number.isFinite(n) ? n : null;
}

// Display formatting: uk shows the comma it dictates with; everything else
// keeps the dot. The stored value is always the JSON number.
export function formatNumericLocale(value, lang) {
  if (typeof value !== "number" || !Number.isFinite(value)) return "";
  const s = String(value);
  return lang === "uk" ? s.replace(".", ",") : s;
}
