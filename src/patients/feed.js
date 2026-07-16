// feed.js — sprint 11 step 03: the patient page's merged clinical feed.
//
// The backend deliberately serves reports+recordings from /timeline and
// everything else from per-entity endpoints; the SPA owns the merge. This is
// that merge, in one pure, unit-tested place.
//
// Wire reality (pinned step 01): NONE of the four sources paginates —
// /timeline and /notes return complete {items} arrays, /encounters and
// /consents plain arrays. The sprint doc's incremental k-way merge over
// cursors therefore has nothing to attach to; the honest shape is
// merge-everything + windowed RENDERING (the screen grows the visible
// window, not the fetch). If a cursor ever appears on these endpoints, this
// module is where the k-way front belongs.
//
// Item contract (discriminated):
//   { key, type: 'report'|'recording'|'conversation'|'encounter'|'note'|
//     'consent', id, date, title, status, by, encounter_id, duration_s, raw }

const toTime = (iso) => {
  const t = iso ? Date.parse(iso) : NaN;
  return Number.isNaN(t) ? -Infinity : t; // undated items sink to the bottom
};

const TIMELINE_TYPE = { dictate: "report", recording: "recording", scribe: "conversation" };

export function mergeFeed({ timeline = [], encounters = [], notes = [], consents = [] } = {}) {
  const items = [];

  for (const t of timeline) {
    const type = TIMELINE_TYPE[t.kind];
    if (!type) continue; // unknown future kinds: skip, never mislabel
    items.push({
      type, id: t.id, date: t.date || null, title: t.title || "",
      status: t.status ?? null, by: t.by ?? null,
      encounter_id: t.encounter_id ?? null, duration_s: t.duration_s ?? null,
      raw: t,
    });
  }
  for (const e of encounters) {
    items.push({
      type: "encounter", id: e.id, date: e.occurred_at || null,
      title: e.reason || "", status: e.status ?? null, by: null,
      encounter_id: e.id, duration_s: null, raw: e,
    });
  }
  for (const n of notes) {
    items.push({
      type: "note", id: n.id, date: n.created_at || null,
      title: n.title || "", status: n.status ?? null, by: null,
      encounter_id: n.encounter_id ?? null, duration_s: null, raw: n,
    });
  }
  for (const c of consents) {
    items.push({
      type: "consent", id: c.id,
      date: (c.status === "withdrawn" && c.withdrawn_at) || c.granted_at || null,
      title: "", status: c.status ?? null, by: null,
      encounter_id: c.encounter_id ?? null, duration_s: null, raw: c,
    });
  }

  // Newest first; ties break on (type, id) so the order is stable regardless
  // of which source answered first — no item ever reorders across reloads.
  items.sort((a, b) => {
    const dt = toTime(b.date) - toTime(a.date);
    if (dt) return dt;
    if (a.type !== b.type) return a.type < b.type ? -1 : 1;
    return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
  });

  for (const it of items) it.key = `${it.type}:${it.id}`;
  return items;
}
