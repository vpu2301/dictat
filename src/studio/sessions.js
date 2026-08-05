// studio/sessions.js — one work list out of three backends.
//
// The Studio rail lists everything the clinician has going, regardless of which
// service holds it:
//
//   report   — report-service   GET /v1/reports/search   (drafts, finalized, signed)
//   note     — core-service     GET /notes               (clinical notes)
//   dictate  — dictation-service GET /dictate/sessions   (live/finalized recordings)
//   asr      — asr-service      GET /asr/jobs            (uploaded audio)
//
// Each service names its fields differently and dates its rows differently;
// this module is the only place that knows that. Everything downstream sees one
// shape:
//
//   { key, kind, id, title, subtitle, at, status, patientId, patientName, search }
//
// `at` is an ISO string (the row's most recent moment — a draft edited today
// belongs at the top even if it was created last week), and `key` is unique
// across kinds so React never sees a duplicate id when a report and the session
// it came from share one.
//
// Pure on purpose: no fetching, no React. The hook (useStudioSessions.js) does
// the I/O, this file decides what a row IS.

import { tr } from "../i18n.js";

export const KINDS = ["report", "note", "dictate", "asr"];

// ── normalizers ────────────────────────────────────────────────────────

// GET /v1/reports/search → SearchHitDTO
// { report_id, title, status, patient_id, patient_name, patient_name_redacted,
//   snippet, updated_at, encounter_date, template_id, ... }
export function reportToSession(hit, lang = "uk") {
  if (!hit) return null;
  const id = hit.report_id || hit.id;
  if (!id) return null;
  // A redacted name is what the backend returns when the caller may see that a
  // report exists but not whose it is (break-glass roster). Render it as given —
  // never fall back to an unredacted field that happens to be present.
  const patientName = hit.patient_name_redacted || hit.patient_name || "";
  const title = hit.title
    || patientName
    || tr(lang, "Звіт без назви", "Untitled report");
  return {
    key: `report:${id}`,
    kind: "report",
    id,
    title,
    subtitle: patientName && hit.title ? patientName : (hit.snippet || ""),
    at: hit.updated_at || hit.encounter_date || null,
    status: hit.status || "draft",
    patientId: hit.patient_id || null,
    patientName,
    templateId: hit.template_id || null,
    search: [title, patientName, hit.snippet].filter(Boolean).join(" ").toLowerCase(),
  };
}

// GET /dictate/sessions → SessionSummary
// { id, status, language, target_kind, started_at, last_active_at,
//   finalized_at, total_audio_ms, network_drop_count }
//
// The summary carries no patient and no title — dictation-service does not
// store either. Saying so is the honest row; inventing a name is not.
export function dictationToSession(s, lang = "uk") {
  if (!s?.id) return null;
  const secs = s.total_audio_ms ? Math.round(s.total_audio_ms / 1000) : 0;
  const kindLabel = s.target_kind === "conversation"
    ? tr(lang, "Розмова", "Conversation")
    : tr(lang, "Диктування", "Dictation");
  return {
    key: `dictate:${s.id}`,
    kind: "dictate",
    id: s.id,
    title: kindLabel,
    subtitle: [
      secs ? fmtDuration(secs) : null,
      (s.language || "").toUpperCase() || null,
    ].filter(Boolean).join(" · "),
    at: s.last_active_at || s.finalized_at || s.started_at || null,
    status: s.status || "unknown",
    patientId: null,
    patientName: "",
    search: [kindLabel, s.id, s.language].filter(Boolean).join(" ").toLowerCase(),
  };
}

// GET /asr/jobs → TranscriptionJobView
// { id, status, language, queued_at, started_at, finished_at, patient_id,
//   patient_name_uk, patient_name_en, prompt_id, model, error_kind, ... }
export function asrToSession(j, lang = "uk") {
  if (!j?.id) return null;
  const patientName = (lang === "uk" ? j.patient_name_uk : j.patient_name_en)
    || j.patient_name_uk || j.patient_name_en || "";
  const title = patientName || tr(lang, "Завантажене аудіо", "Uploaded audio");
  return {
    key: `asr:${j.id}`,
    kind: "asr",
    id: j.id,
    title,
    subtitle: [
      (j.language || "").toUpperCase() || null,
      j.error_kind || null,
    ].filter(Boolean).join(" · "),
    at: j.finished_at || j.started_at || j.queued_at || null,
    status: j.status || "queued",
    patientId: j.patient_id || null,
    patientName,
    search: [title, j.id, j.language, j.status].filter(Boolean).join(" ").toLowerCase(),
  };
}

// GET /notes → NoteOut
// { id, title, structure, status, patient: {id, name}, patient_id,
//   created_at, updated_at, signed_at, sections, ... }
export function noteToSession(n, lang = "uk") {
  if (!n?.id) return null;
  const patientName = n.patient?.name?.[lang] || n.patient?.name?.uk || n.patient?.name?.en || "";
  const title = (typeof n.title === "object" ? (n.title[lang] || n.title.uk || n.title.en) : n.title)
    || patientName
    || tr(lang, "Нотатка", "Note");
  return {
    key: `note:${n.id}`,
    kind: "note",
    id: n.id,
    title,
    subtitle: [patientName && title !== patientName ? patientName : null, n.structure]
      .filter(Boolean).join(" · "),
    at: n.updated_at || n.signed_at || n.created_at || null,
    status: n.status || "draft",
    patientId: n.patient_id || n.patient?.id || null,
    patientName,
    search: [title, patientName, n.structure].filter(Boolean).join(" ").toLowerCase(),
  };
}

export function fmtDuration(totalSeconds) {
  const s = Math.max(0, Math.round(totalSeconds));
  const m = Math.floor(s / 60);
  return `${m}:${String(s % 60).padStart(2, "0")}`;
}

// ── merge + group ──────────────────────────────────────────────────────

// Newest first. Rows without a timestamp sink to the bottom rather than
// sorting as epoch-0 noise in the middle of the list.
export function mergeSessions(...lists) {
  const all = lists.flat().filter(Boolean);
  return all.sort((a, b) => {
    const ta = a.at ? Date.parse(a.at) : NaN;
    const tb = b.at ? Date.parse(b.at) : NaN;
    if (Number.isNaN(ta) && Number.isNaN(tb)) return 0;
    if (Number.isNaN(ta)) return 1;
    if (Number.isNaN(tb)) return -1;
    return tb - ta;
  });
}

export function filterSessions(items, query) {
  const q = String(query || "").trim().toLowerCase();
  if (!q) return items;
  return items.filter((it) => (it.search || "").includes(q));
}

const DAY = 86400000;
const startOfDay = (d) => {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x.getTime();
};

// Buckets in the order they render. `now` is injectable so the grouping is
// testable without freezing the clock.
export function groupSessions(items, lang = "uk", now = Date.now()) {
  const today = startOfDay(now);
  const buckets = [
    { key: "today",     label: tr(lang, "Сьогодні", "Today"),        items: [] },
    { key: "yesterday", label: tr(lang, "Вчора", "Yesterday"),       items: [] },
    { key: "week",      label: tr(lang, "Цього тижня", "This week"), items: [] },
    { key: "older",     label: tr(lang, "Раніше", "Older"),          items: [] },
    { key: "undated",   label: tr(lang, "Без дати", "Undated"),      items: [] },
  ];
  const by = Object.fromEntries(buckets.map((b) => [b.key, b]));
  for (const it of items) {
    const t = it.at ? Date.parse(it.at) : NaN;
    if (Number.isNaN(t)) { by.undated.items.push(it); continue; }
    const day = startOfDay(t);
    if (day >= today) by.today.items.push(it);
    else if (day >= today - DAY) by.yesterday.items.push(it);
    else if (day > today - 7 * DAY) by.week.items.push(it);
    else by.older.items.push(it);
  }
  return buckets.filter((b) => b.items.length);
}

// ── row → route ────────────────────────────────────────────────────────

// Which Studio mode + params opens this row. One place, so the rail, the
// deep links and the "continue where you left off" affordances agree.
export function sessionParams(item) {
  if (!item) return null;
  if (item.kind === "report") {
    return { mode: "dictate", report: item.id, patient: item.patientId || undefined };
  }
  if (item.kind === "asr") {
    return { mode: "audio", job: item.id, patient: item.patientId || undefined };
  }
  if (item.kind === "note") {
    return { mode: "note", note: item.id, patient: item.patientId || undefined };
  }
  return { mode: "scribe", session: item.id };
}

export function studioHref(params = {}) {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== "") qs.set(k, String(v));
  }
  const tail = qs.toString();
  return `/studio${tail ? `?${tail}` : ""}`;
}

// Status → the pill tone the rail paints. Kept here (not in CSS) so the three
// services' vocabularies collapse into one visual scale exactly once.
export function statusTone(item) {
  const s = String(item?.status || "").toLowerCase();
  if (["signed", "finalized", "complete", "completed", "finalised"].includes(s)) return "done";
  if (["failed", "error", "cancelled", "canceled", "expired"].includes(s)) return "bad";
  if (["running", "live", "active", "queued", "processing"].includes(s)) return "live";
  return "draft";
}

export function statusLabel(item, lang = "uk") {
  const s = String(item?.status || "").toLowerCase();
  const map = {
    draft:      tr(lang, "Чернетка", "Draft"),
    finalized:  tr(lang, "Фіналізовано", "Finalized"),
    finalised:  tr(lang, "Фіналізовано", "Finalized"),
    signed:     tr(lang, "Підписано", "Signed"),
    cancelled:  tr(lang, "Скасовано", "Cancelled"),
    canceled:   tr(lang, "Скасовано", "Cancelled"),
    queued:     tr(lang, "У черзі", "Queued"),
    running:    tr(lang, "Обробка", "Running"),
    complete:   tr(lang, "Готово", "Complete"),
    completed:  tr(lang, "Готово", "Complete"),
    failed:     tr(lang, "Помилка", "Failed"),
    active:     tr(lang, "Активна", "Active"),
    live:       tr(lang, "У ефірі", "Live"),
    finalizing: tr(lang, "Завершення", "Finalizing"),
  };
  return map[s] || s || "";
}
