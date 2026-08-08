// sourceView.js — how sources are numbered, grouped and described (EVA-S04).
//
// Pure, because the numbering is shared and a second copy of it would be a
// bug you cannot see. `[3]` in the answer text, `[3]` in the drawer heading,
// and `[3]` in the clipboard have to be the same source; three components
// each deriving "which number is this" from their own local index guarantees
// they eventually will not be.
//
// Contract shapes (`SourceRef`, `WebSourceRef`, `EvidenceTier`,
// `SourceAuthority`, `WebTrustTier`) come from src/types/evidence.

/** Group order in the drawer. Corpus first: it is the authority we curate. */
export const SOURCE_GROUPS = ["corpus", "web", "drug"];

/**
 * source_id → 1-based citation number.
 *
 * Numbering follows the envelope's `sources[]` order, which is the service's
 * order — NOT first-appearance-in-text. Two reasons: a streamed answer's text
 * arrives before some of its sources, so first-appearance numbering would
 * renumber the visible citations mid-stream; and a reopened answer must carry
 * the same numbers as the streamed one it is a copy of (AC-S04-F-3).
 */
export function citationNumbers(sources) {
  const map = new Map();
  // A duplicated source keeps the number it was first given — a resumed
  // stream that re-sends one must not shift every citation after it.
  for (const s of sources || []) {
    if (s?.id != null && !map.has(s.id)) map.set(s.id, map.size + 1);
  }
  return map;
}

/** The number for one citation, or null when its source has not arrived yet. */
export function citationNumber(sources, sourceId) {
  return citationNumbers(sources).get(sourceId) ?? null;
}

/**
 * A segment's citations, resolved against the sources that have arrived.
 *
 * Citations whose source is still in flight are KEPT, with `number: null` and
 * `source: null`. Dropping them would make the text change under the reader
 * as sources land; keeping them renders a pending marker that fills in.
 */
export function resolveCitations(segment, sources) {
  const numbers = citationNumbers(sources);
  const byId = new Map((sources || []).map((s) => [s.id, s]));
  return (segment?.citations || []).map((c) => ({
    source_id: c.source_id,
    passage_id: c.passage_id ?? null,
    quote: c.quote ?? null,
    number: numbers.get(c.source_id) ?? null,
    source: byId.get(c.source_id) ?? null,
  }));
}

/** Sources split by kind, each keeping its citation number. Empty groups dropped. */
export function groupSources(sources) {
  const numbers = citationNumbers(sources);
  const groups = new Map(SOURCE_GROUPS.map((k) => [k, []]));
  for (const s of sources || []) {
    const kind = groups.has(s?.kind) ? s.kind : "corpus";
    groups.get(kind).push({ ...s, number: numbers.get(s.id) ?? null });
  }
  return SOURCE_GROUPS.map((kind) => ({ kind, items: groups.get(kind) })).filter((g) => g.items.length > 0);
}

/**
 * What a source's accessible name is — the thing a screen reader announces
 * for its citation chip, and the label the drawer heads it with.
 *
 * A web source may legitimately have no title (a PDF behind a redirect), and
 * "Source 3: " read out with nothing after it is the failure mode this
 * guards. The domain is always there for a web source; for a corpus source
 * the title always is.
 */
export function sourceLabel(source) {
  if (!source) return "";
  const title = String(source.title || "").trim();
  if (title) return title;
  if (source.web?.domain) return String(source.web.domain);
  return String(source.id || "");
}

/**
 * The badges a source carries, as { key, value } pairs the component draws
 * verbatim. Values are contract enum values, so the caller translates them
 * through the `tier.` / `authority.` / `trust.` key convention (EVA-S02) and
 * an enum this build has not seen still renders as itself.
 *
 * `accessed_at` is on this list for web sources and only web sources, and it
 * is not decoration: a web page's content is whatever it said on the day it
 * was read, and an answer citing one without saying when is citing nothing.
 */
export function sourceBadges(source) {
  const out = [];
  if (!source) return out;
  if (source.evidence_tier) out.push({ key: "tier", value: source.evidence_tier });
  if (source.source_authority) out.push({ key: "authority", value: source.source_authority });
  if (source.kind === "web" && source.web) {
    if (source.web.trust_tier) out.push({ key: "trust", value: source.web.trust_tier });
    if (source.web.accessed_at) out.push({ key: "accessed", value: source.web.accessed_at });
  }
  return out;
}

/** ISO timestamp → the date a clinician reads. Time of day is noise here. */
export function accessedDate(iso) {
  if (!iso) return "";
  const s = String(iso);
  const m = /^(\d{4}-\d{2}-\d{2})/.exec(s);
  return m ? m[1] : s;
}

/**
 * May this web source be rendered as an outbound anchor?
 *
 * The flag is the whole answer (AC-S04-F-4). With it off the source is still
 * fully described — domain, trust tier, access date — it simply is not a
 * link, and a "cached copy" affordance stands where the link would (S08 makes
 * it work). A `javascript:`/`data:` URL is refused regardless: the backend
 * validates its own, and a UI that renders whatever arrives as an href is one
 * compromised connector away from being the delivery mechanism.
 */
export function webHref(source, externalLinksEnabled) {
  if (!externalLinksEnabled) return null;
  const url = source?.web?.url;
  if (!url) return null;
  return /^https?:\/\//i.test(String(url)) ? String(url) : null;
}

/** Does this answer cite the web at all? Drives the web-unavailable notice. */
export const hasWebSources = (sources) => (sources || []).some((s) => s?.kind === "web");
