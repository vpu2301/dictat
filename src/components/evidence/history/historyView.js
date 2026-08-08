// historyView.js — the history list's view model (EVA-S04). Pure.
//
// A row is: what was asked, when, in what mode, and how it ended. The only
// interesting decision is the excerpt, and it is interesting because a
// question is free text a clinician typed and may be a paragraph.

/** Crumb and row excerpts are capped at the same width, deliberately. */
export const EXCERPT_CHARS = 48;

/**
 * First `max` characters of a question, on a word boundary, with an ellipsis
 * only when something was actually removed.
 *
 * Whitespace is collapsed first: a question dictated in two goes arrives with
 * a newline in the middle, and a row that grows a second line for it breaks
 * the list's rhythm for no information.
 */
export function excerpt(question, max = EXCERPT_CHARS) {
  const text = String(question || "").replace(/\s+/g, " ").trim();
  if (text.length <= max) return text;
  const cut = text.slice(0, max);
  const space = cut.lastIndexOf(" ");
  // Only break on a space if it leaves a useful amount of text — a question
  // whose first word is longer than the cap is better truncated mid-word than
  // rendered as a lone ellipsis.
  const body = space > max * 0.6 ? cut.slice(0, space) : cut;
  return `${body.trimEnd()}…`;
}

/**
 * Status → the badge's tone class. `deflected` is INFO, not a warning: the
 * pipeline did its job and declined, and a history full of orange rows would
 * teach a clinician that asking about the wrong thing is an error state.
 */
export const STATUS_TONE = Object.freeze({
  ok: "ok",
  insufficient_basis: "warn",
  deflected: "info",
});
export const statusTone = (status) => STATUS_TONE[status] || "info";

/**
 * One `/questions` item → one row.
 *
 * The list endpoint returns questions, not answers, so a question that never
 * produced one (the stream dropped, the tab closed) has no `answer_id`. Those
 * rows still render — they are the record that it was asked — but they do not
 * link anywhere, because there is nothing to reopen.
 */
export function historyRow(item) {
  if (!item) return null;
  const answerId = item.answer_id ?? item.answerId ?? null;
  return {
    id: item.id ?? answerId ?? null,
    answerId,
    question: String(item.question || ""),
    excerpt: excerpt(item.question),
    askedAt: item.created_at ?? item.asked_at ?? null,
    mode: item.mode || "quick",
    status: item.status || null,
    tone: statusTone(item.status),
    openable: !!answerId,
  };
}

export function historyRows(items) {
  return (items || []).map(historyRow).filter(Boolean);
}

/** The list response, whatever key it wrapped its page in. */
export function historyPage(response) {
  const items = response?.questions ?? response?.items ?? (Array.isArray(response) ? response : []);
  return { items: historyRows(items), nextCursor: response?.next_cursor ?? null };
}

/** `date` → the short local date a row shows. Empty for a missing timestamp. */
export function askedAtLabel(iso, locale = "uk-UA") {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString(locale, { dateStyle: "medium", timeStyle: "short" });
}
