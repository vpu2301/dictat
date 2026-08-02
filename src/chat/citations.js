// chat/citations.js — turning "…6.5–7.5% [1], relaxed in older patients [2]"
// into renderable parts.
//
// The markers are 1-based indices into the answer's OWN citation list, not
// global evidence ids. That matters: it means a chip can never point at a
// source the answer didn't cite, and reordering an answer's citations moves the
// chips with them. A marker with no matching source is dropped rather than
// rendered as a dead chip — an evidence tool that shows a citation leading
// nowhere has told the reader something false.

export function segmentAnswer(text, citations = []) {
  const out = [];
  const src = String(text || "");
  const re = /\[(\d{1,2})\]/g;
  let last = 0;
  let m;
  while ((m = re.exec(src))) {
    const index = Number(m[1]);
    const evidence = citations[index - 1];
    if (m.index > last) out.push({ type: "text", value: src.slice(last, m.index) });
    if (evidence) out.push({ type: "citation", index, evidence });
    else out.push({ type: "text", value: m[0] });
    last = m.index + m[0].length;
  }
  if (last < src.length) out.push({ type: "text", value: src.slice(last) });
  return out;
}

// The confidence bands the UI colours by, in one place: the meta pill, and the
// explanation memo that decodes it, must never disagree about where "high"
// begins.
export function confidenceBandOf(confidence) {
  return confidence >= 0.85 ? "high" : confidence >= 0.7 ? "mid" : "low";
}

// Which sources a given answer actually cited, in citation order, deduplicated
// — the evidence panel lists each source once even when the text points at it
// twice.
export function citedSources(citations = []) {
  const seen = new Set();
  const out = [];
  citations.forEach((evidence, i) => {
    if (!evidence || seen.has(evidence.id)) return;
    seen.add(evidence.id);
    out.push({ ...evidence, index: i + 1 });
  });
  return out;
}
