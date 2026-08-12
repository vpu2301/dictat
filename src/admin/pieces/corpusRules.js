// corpusRules.js — client mirrors of autocomplete-service's write constraints
// (sprint 10 backend), so the console can explain a rejection before paying a
// round-trip for it. The server stays authoritative; these only pre-check.
//
// JSX-free for node --test.

export const PHRASE_MAX = 80;
export const SNIPPET_TRIGGER_RE = /^[a-z][a-z0-9_-]{1,31}$/; // 2..32 total
export const SNIPPET_EXPANSION_MAX = 4000;

/** null when the phrase text passes the client checks, else a reason key. */
export function phraseProblem(phrase) {
  const p = String(phrase || "").trim();
  if (!p) return "empty";
  if (p.length > PHRASE_MAX) return "too_long";
  return null;
}

/**
 * null when the snippet passes, else a reason key. `trigger` is checked in
 * its STORED form — no leading slash (the "/" is typed at suggest time).
 */
export function snippetProblem({ trigger, expansion, cursor_position }) {
  const t = String(trigger || "");
  if (t.startsWith("/")) return "trigger_slash";
  if (!SNIPPET_TRIGGER_RE.test(t)) return "trigger_format";
  const e = String(expansion || "");
  if (!e) return "expansion_empty";
  if (e.length > SNIPPET_EXPANSION_MAX) return "expansion_too_long";
  const c = Number(cursor_position);
  if (!Number.isInteger(c) || c < 0 || c > e.length) return "cursor_out_of_range";
  return null;
}

/** UI names for the server's PII pattern detectors. */
export const PII_PATTERN_LABELS = {
  phone: { uk: "телефон", en: "phone" },
  email: { uk: "email", en: "email" },
  ipn: { uk: "ІПН", en: "tax id (IPN)" },
  med_id: { uk: "мед. ID", en: "medical id" },
  passport: { uk: "паспорт", en: "passport" },
  dob_like: { uk: "дата народження", en: "date of birth" },
};
