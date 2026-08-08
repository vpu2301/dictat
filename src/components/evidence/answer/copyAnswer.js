// copyAnswer.js — the answer as plain text (AC-S04-F-5), EVA-S04.
//
// What gets copied is what gets pasted into a chart note, an email to a
// colleague, or a message to whoever is on call. So the three things that make
// the on-screen answer honest have to survive the clipboard, because the
// pasted copy is the one that gets read later, out of context, by someone who
// never saw the screen:
//
//   the kind labels     — "[Interpretation]" is the difference between a
//                         guideline statement and the model's inference, and
//                         plain text is exactly where that distinction gets
//                         lost if nobody carries it.
//   the [n] markers     — a claim without its citation is an assertion.
//   the source list     — the numbers have to resolve to something.
//
// …plus the unverified notice, which is the one line that must never be
// possible to lose by copying (S06 removes it when the pipeline is verified;
// until then it goes wherever the text goes).
//
// Pure. Takes a `t` translator so the copy is in the reader's UI language and
// the formatter still has no i18n import of its own.

import { kindStyle } from "./segmentKinds.js";
import { accessedDate, citationNumbers, groupSources, sourceLabel } from "./sourceView.js";

/** Citation markers for one segment: "[1][3]", or "" when it has none. */
function markers(segment, numbers) {
  return (segment?.citations || [])
    .map((c) => numbers.get(c.source_id))
    .filter((n) => Number.isFinite(n))
    .map((n) => `[${n}]`)
    .join("");
}

function segmentLine(segment, numbers, t) {
  const label = t(kindStyle(segment.kind).labelKey);
  const cites = markers(segment, numbers);
  return `[${label}] ${String(segment.text || "").trim()}${cites ? ` ${cites}` : ""}`;
}

function sourceLine(item, t) {
  const bits = [item.kind === "web" ? item.web?.domain || sourceLabel(item) : sourceLabel(item)];
  const meta = [];
  if (item.evidence_tier) meta.push(t(`tier.${item.evidence_tier}`));
  if (item.source_authority) meta.push(t(`authority.${item.source_authority}`));
  if (item.kind === "web") {
    if (item.web?.trust_tier) meta.push(t(`trust.${item.web.trust_tier}`));
    if (item.web?.accessed_at) meta.push(`${t("answer.web_accessed_at")} ${accessedDate(item.web.accessed_at)}`);
  }
  // The URL rides along ONLY as text. This is not the externalLinks flag's
  // business: that flag governs whether the UI navigates out of the app, and
  // pasting a citation into a note is not navigation. A citation whose URL is
  // stripped cannot be checked by the person reading the paste.
  if (item.kind === "web" && item.web?.url) meta.push(item.web.url);
  if (meta.length) bits.push(meta.join(" · "));
  const n = Number.isFinite(item.number) ? `[${item.number}] ` : "";
  return `${n}${bits.join(" — ")}`;
}

/**
 * The whole answer as text.
 *
 * @param {object}   args
 * @param {string}   args.question   what was asked, echoed at the top
 * @param {object}   args.envelope   an AnswerEnvelope (streamed or reopened)
 * @param {Function} args.t          (key) => string
 * @param {string}  [args.deflection] deflection body, when the answer was one
 */
export function answerToText({ question, envelope, t, deflection }) {
  const lines = [];
  const q = String(question || "").trim();
  if (q) lines.push(q, "");

  if (deflection) {
    lines.push(`${t("deflect.title")}: ${deflection}`, "");
    lines.push(t("answer.unverified"));
    return lines.join("\n");
  }

  const numbers = citationNumbers(envelope?.sources);
  const summary = envelope?.summary_segments || [];
  const detail = envelope?.detail_segments || [];

  for (const s of summary) lines.push(segmentLine(s, numbers, t));
  if (summary.length && detail.length) lines.push("");
  for (const s of detail) lines.push(segmentLine(s, numbers, t));

  const groups = groupSources(envelope?.sources);
  if (groups.length) {
    lines.push("", `${t("answer.sources")}:`);
    for (const g of groups) {
      for (const item of g.items) lines.push(sourceLine(item, t));
    }
  }

  // Last, because it is the line that qualifies everything above it and the
  // last line of a paste is the one that does not get trimmed away.
  lines.push("", t("answer.unverified"));
  return lines.join("\n");
}
