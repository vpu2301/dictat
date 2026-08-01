// Shaping the two version snapshots that GET /v1/reports/{id}/versions/{n}
// returns into what the diff view needs.
//
// The endpoint answers with a ReportVersionDetail — the report *envelope*
// shape, `content.sections: [{ section_key, text }]` plus a flattened
// `rendered_text`. It has never carried a flat `body` map, so the diff has to
// flatten it here; reading `version.body` yields undefined and every section
// silently diffs empty-against-empty, which renders as a blank diff.

// Localized value out of a { uk, en } bag (same rule as the rest of the app).
function loc(v, lang) {
  if (v == null) return "";
  if (typeof v === "object") return v[lang] ?? v.en ?? Object.values(v)[0] ?? "";
  return v;
}

// ReportVersionDetail → { section_key: text }.
export function versionBody(version) {
  const sections = version?.content?.sections || [];
  const body = {};
  for (const s of sections) {
    if (s?.section_key) body[s.section_key] = s.text || "";
  }
  // Free-text reports (no template, no sections) only carry rendered_text.
  if (!sections.length && version?.rendered_text) body.note = version.rendered_text;
  return body;
}

export function humanizeKey(key) {
  return String(key).replace(/[_-]+/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

// Sections to diff as [{ id, title }]: template order first, then any key the
// two versions carry that the template doesn't declare (free-text "note",
// sections dropped by a later template revision). Works with no template at
// all — a templateless report still diffs on its own keys.
//
// Titles prefer the server-resolved `section_labels` (localized), then the
// template's section name, then a humanized key.
export function diffSectionList({ template, bodies = [], labelMap, lang } = {}) {
  const out = [];
  const seen = new Set();
  const title = (key, fallback) => loc(labelMap?.[key], lang) || fallback;
  for (const s of template?.sections || []) {
    if (!s?.id || seen.has(s.id)) continue;
    seen.add(s.id);
    out.push({ id: s.id, title: title(s.id, loc(s.name, lang) || humanizeKey(s.id)) });
  }
  for (const body of bodies) {
    for (const key of Object.keys(body || {})) {
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({ id: key, title: title(key, humanizeKey(key)) });
    }
  }
  return out;
}
