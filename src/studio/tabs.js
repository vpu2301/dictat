// studio/tabs.js — open documents, as tabs.
//
// A clinician does not do one thing at a time: a draft is half-dictated when
// the phone rings, an upload needs assigning, the next patient is already in
// the room. Before this, opening any of those replaced whatever was on screen.
// Now each is a TAB, the way a browser does it — with a `+` that asks what kind
// of document to start.
//
// The identity of a tab is `t` in the URL, not the document it currently holds:
// a tab that starts empty ("new dictation") and later mints a report must stay
// the same tab, or pressing the record button would appear to open a second
// one. That is why every navigation carries `t`, and why two blank dictations
// are two tabs rather than one.
//
// Pure: no React, no storage, no fetching. The workspace owns the effects; this
// file owns what a tab IS and what opening, updating and closing one mean.

import { tr } from "../i18n.js";

export const TABS_KEY = "mdx.studio.tabs.v1";
export const MAX_TABS = 8;

// URL params a tab remembers. `mode` and `t` always; the rest only when set.
const PARAM_KEYS = ["mode", "patient", "encounter", "template", "report", "session", "job", "note"];

export function newTabId(seq) {
  // Short, readable, and monotonic within a session — no clock, no randomness
  // (both make the tab strip untestable and the URLs unrepeatable).
  return `t${seq}`;
}

export function tabFromParams(params = {}, id) {
  const tab = { id: id || params.t || null };
  for (const k of PARAM_KEYS) {
    if (params[k]) tab[k] = params[k];
  }
  if (!tab.mode) tab.mode = "dictate";
  return tab;
}

export function paramsOfTab(tab = {}) {
  const out = {};
  for (const k of PARAM_KEYS) {
    if (tab[k]) out[k] = tab[k];
  }
  if (tab.id) out.t = tab.id;
  return out;
}

// The tab list after a navigation. Three cases, in order:
//   · the URL names a tab we know → that tab is active and ADOPTS the new
//     params (the document it holds changed inside the tab);
//   · the URL names no tab, but its document is already open → focus that one
//     rather than opening a duplicate of the same report;
//   · otherwise → a new tab, appended.
export function syncTabs(tabs, params, { seq = 0 } = {}) {
  const list = Array.isArray(tabs) ? tabs : [];
  const wanted = tabFromParams(params);

  const byId = params.t ? list.find((t) => t.id === params.t) : null;
  if (byId) {
    return {
      tabs: list.map((t) => (t.id === byId.id ? { ...wanted, id: byId.id, title: t.title } : t)),
      activeId: byId.id,
      seq,
    };
  }

  const docKey = documentKey(wanted);
  const byDoc = docKey ? list.find((t) => documentKey(t) === docKey) : null;
  if (byDoc) {
    return {
      tabs: list.map((t) => (t.id === byDoc.id ? { ...wanted, id: byDoc.id, title: t.title } : t)),
      activeId: byDoc.id,
      seq,
    };
  }

  const nextSeq = seq + 1;
  const id = newTabId(nextSeq);
  // A cap, because a strip of twenty tabs is a list — and we already have one.
  // The OLDEST tab that is not the active one gives way.
  const trimmed = list.length >= MAX_TABS ? list.slice(1) : list;
  return { tabs: [...trimmed, { ...wanted, id }], activeId: id, seq: nextSeq };
}

// What document a tab is showing, if any. Two tabs on the same report are the
// same tab; two empty dictations are not.
export function documentKey(tab = {}) {
  if (tab.report) return `report:${tab.report}`;
  if (tab.job) return `asr:${tab.job}`;
  if (tab.session) return `dictate:${tab.session}`;
  if (tab.note) return `note:${tab.note}`;
  return null;
}

// Close a tab; say which one to show next. A browser activates the neighbour
// to the right, then the left — and closing the last tab leaves none, not an
// empty strip pretending to be one.
export function closeTab(tabs, id) {
  const list = Array.isArray(tabs) ? tabs : [];
  const idx = list.findIndex((t) => t.id === id);
  if (idx === -1) return { tabs: list, next: null };
  const next = list[idx + 1] || list[idx - 1] || null;
  return { tabs: list.filter((t) => t.id !== id), next };
}

export function renameTab(tabs, id, title) {
  const list = Array.isArray(tabs) ? tabs : [];
  if (!id || !title) return list;
  return list.map((t) => (t.id === id && t.title !== title ? { ...t, title } : t));
}

// What the strip says when the document has not named itself yet.
export function fallbackTitle(tab = {}, lang = "uk") {
  if (tab.job) return tr(lang, "Аудіо", "Audio");
  if (tab.session) return tr(lang, "Запис", "Recording");
  if (tab.note || tab.mode === "note") return tr(lang, "Нотатка", "Note");
  switch (tab.mode) {
    case "scribe": return tr(lang, "Розмова", "Conversation");
    case "audio":  return tr(lang, "Аудіо", "Audio");
    case "smart":  return tr(lang, "Розумний диктант", "Smart dictation");
    default:       return tr(lang, "Диктант", "Dictate");
  }
}

export function loadTabs(storage) {
  try {
    const raw = storage.getItem(TABS_KEY);
    const parsed = raw ? JSON.parse(raw) : null;
    return Array.isArray(parsed) ? parsed.filter((t) => t && t.id) : [];
  } catch {
    return [];
  }
}

export function saveTabs(storage, tabs) {
  try { storage.setItem(TABS_KEY, JSON.stringify(tabs || [])); } catch {}
}
