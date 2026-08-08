// passageView.js — an EvidencePassage → what a result row shows.
//
// Everything here is derived, never invented: no field is defaulted to a
// plausible value. A passage with no tier renders "tier unknown", because on a
// debugging screen "the backend did not send one" and "it is `other`" must not
// look the same.

/** Metadata badges, in reading order: what it is, who says it, when. */
export function metaBadges(passage) {
  const badges = [];
  if (passage.evidence_tier) badges.push({ key: "tier", kind: "tier", value: passage.evidence_tier, label: labelOf(passage.evidence_tier) });
  else badges.push({ key: "tier", kind: "tier", value: null, label: "tier unknown", muted: true });

  if (passage.source_authority) badges.push({ key: "authority", kind: "authority", value: passage.source_authority, label: labelOf(passage.source_authority) });
  if (passage.license_class) badges.push({ key: "license", kind: "license", value: passage.license_class, label: labelOf(passage.license_class) });
  if (passage.source_kind) badges.push({ key: "kind", kind: "connector", value: passage.source_kind, label: labelOf(passage.source_kind) });
  return badges;
}

/**
 * State chips — the things that change how a passage should be read.
 * Deliberately separate from the metadata badges above: a retracted source is
 * not another attribute, it is a warning.
 */
export function stateChips(passage) {
  const chips = [];
  if (passage.retracted) {
    chips.push({ key: "retracted", tone: "bad", label: "retracted", title: "The document was withdrawn — do not rely on this passage" });
  }
  if (passage.license_class === "restricted") {
    chips.push({ key: "restricted", tone: "warn", label: "restricted licence", title: "Excluded from corpus snapshots; not redistributable" });
  }
  if (passage.web_ref) {
    chips.push({
      key: "web",
      tone: "info",
      label: passage.web_ref.domain,
      title: `${passage.web_ref.url} — ${passage.web_ref.trust_tier}, accessed ${passage.web_ref.accessed_at}` +
        (passage.web_ref.snapshot_ref ? " (snapshot cached)" : " (no cached snapshot)"),
    });
  }
  return chips;
}

const labelOf = (value) => String(value).replace(/_/g, " ");

/** "A > B > C" → ["A", "B", "C"]. Empty when the chunk carries no section. */
export function sectionCrumbs(sectionPath) {
  if (!sectionPath) return [];
  return String(sectionPath).split(">").map((s) => s.trim()).filter(Boolean);
}

/**
 * The per-stage scores, in pipeline order, with the stages that did not run
 * shown as "—" rather than dropped. Which stage was skipped is half of what a
 * scores popover is for: a null rerank means the reranker never saw this
 * passage, and that is a different bug from a low rerank score.
 */
export const SCORE_STAGES = ["dense", "lexical", "fused", "rerank", "final"];

export function scoreRows(passage) {
  const scores = passage.scores || {};
  return SCORE_STAGES.map((stage) => {
    const value = scores[stage];
    return {
      stage,
      value: typeof value === "number" ? value : null,
      display: typeof value === "number" ? formatScore(value) : "—",
      ran: typeof value === "number",
    };
  });
}

/** Small numbers matter here (RRF fusion output is ~0.016), so never round to 2. */
export function formatScore(value) {
  if (typeof value !== "number") return "—";
  if (value === 0) return "0";
  return Math.abs(value) < 0.01 ? value.toPrecision(3) : value.toFixed(4).replace(/0+$/, "").replace(/\.$/, "");
}

/** Character offsets, when the connector carries them. */
export function offsetLabel(passage) {
  const { char_start: start, char_end: end } = passage;
  if (typeof start !== "number" || typeof end !== "number") return null;
  return `chars ${start}–${end}`;
}

/** Excerpt for the row; the full text is one disclosure away. */
export function excerpt(text, max = 320) {
  const value = String(text ?? "");
  if (value.length <= max) return { text: value, truncated: false };
  return { text: `${value.slice(0, max).trimEnd()}…`, truncated: true };
}

/** A table-shaped passage renders as monospace — a wrapped table is unreadable. */
export const looksLikeTable = (text) => /\|\s*-{2,}\s*\|/.test(String(text ?? ""));

/**
 * What identifies this passage in the corpus. Devtools show ids: the whole
 * point is to be able to paste one into a psql query or a backend log search.
 */
export function identity(passage) {
  return [
    { key: "passage", label: "passage", value: passage.id },
    { key: "document", label: "document", value: passage.document_id },
    { key: "version", label: "version", value: passage.document_version_id },
    { key: "connector", label: "connector", value: passage.connector_id },
  ].filter((row) => row.value);
}
