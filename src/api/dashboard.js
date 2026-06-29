// dashboard.js — Business-owner (tenant_admin) dashboard aggregation helpers.
//
// The backend has NO dedicated dashboard/aggregation API yet (see
// ~/Desktop/business-owner-dashboard-task.md §7). This module is the ONLY place
// that composes multiple services into the KPIs the dashboard panels render.
// Each exported function returns plain data so the panels stay dumb, and every
// fetch is bounded (paging cap disclosed in the returned `capped` flag) — we
// never silently truncate.
//
// When the real endpoints land (GET /admin/usage, /v1/reports/stats, …) swap the
// bodies here for the real calls; the panels and widgets stay unchanged.

import { listUsers, listAuditEvents, readyz } from "./endpoints.js";
import { listSessions } from "./dictation.js";
import { listJobs } from "./asr.js";
import { listReports } from "./reports.js";
import { listTemplates } from "./templates.js";
import { SERVICES } from "./services.js";

// ── Bounds (disclosed in the UI) ────────────────────────────────────────────
const USERS_CAP = 1000;   // tenants are small; one or two pages in practice
const PAGE_CAP = 20;      // max cursor pages walked for sessions / asr jobs
const PAGE_LIMIT = 100;   // page size for the bounded walks

export const ROLE_KEYS = ["tenant_admin", "clinician", "nurse", "auditor"];
export const DOCTOR_ROLES = ["clinician", "nurse"];

// ── Time helpers ─────────────────────────────────────────────────────────────
export function cutoffMs(rangeDays) {
  return Date.now() - rangeDays * 86400000;
}
function dayKey(d) {
  // Local-day bucket key "YYYY-MM-DD".
  const dt = d instanceof Date ? d : new Date(d);
  if (isNaN(dt)) return null;
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(dt.getDate()).padStart(2, "0")}`;
}
function ts(v) {
  if (!v) return NaN;
  const t = new Date(v).getTime();
  return isNaN(t) ? NaN : t;
}
// Build an ordered array of the last `days` day-keys ending today.
export function lastNDays(days) {
  const out = [];
  const base = new Date();
  base.setHours(0, 0, 0, 0);
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(base.getTime() - i * 86400000);
    out.push({ key: dayKey(d), date: d, count: 0, value: 0 });
  }
  return out;
}
// Bucket a list of { when, amount } into a lastNDays series (sum of amount).
function bucketByDay(series, items) {
  const idx = new Map(series.map((s, i) => [s.key, i]));
  for (const it of items) {
    const k = dayKey(it.when);
    if (k == null) continue;
    const i = idx.get(k);
    if (i == null) continue;
    series[i].count += 1;
    series[i].value += it.amount || 0;
  }
  return series;
}

// Tolerant list-envelope reader: backends here variously return a bare array,
// `{ items }`, `{ users }`, `{ jobs }`, `{ events }`, or `{ hits }`.
function asItems(r, ...keys) {
  if (Array.isArray(r)) return r;
  if (!r || typeof r !== "object") return [];
  for (const k of keys) if (Array.isArray(r[k])) return r[k];
  return r.items || [];
}
function nextCursorOf(r) {
  return (r && (r.next_cursor || r.nextCursor)) || null;
}

// ── Users / seats ────────────────────────────────────────────────────────────
export async function fetchAllUsers() {
  const all = [];
  let offset = 0;
  let capped = false;
  for (;;) {
    const r = await listUsers({ limit: 200, offset });
    const batch = asItems(r, "users");
    all.push(...batch);
    if (batch.length < 200) break;          // last page
    offset += 200;
    if (all.length >= USERS_CAP) { capped = true; break; }
  }
  return { users: all, capped };
}

export function seatSummary(users) {
  const byStatus = { active: 0, invited: 0, deactivated: 0, other: 0 };
  const byRole = Object.fromEntries(ROLE_KEYS.map((r) => [r, 0]));
  for (const u of users) {
    const s = String(u.status || "").toLowerCase();
    if (s in byStatus) byStatus[s] += 1; else byStatus.other += 1;
    const role = String(u.role || "").toLowerCase();
    if (role in byRole) byRole[role] += 1;
  }
  return {
    total: users.length,
    active: byStatus.active,
    invited: byStatus.invited,
    deactivated: byStatus.deactivated,
    byStatus,
    byRole,
  };
}

// ASR monthly byte-quota status. There is no bytes-used readout (GAP) — we can
// only surface whether the tenant tripped the quota recently, from the
// `asr.quota_exceeded` audit event. Returns { exceeded, at } (null `at` = clear).
export async function asrQuotaStatus(rangeDays = 30) {
  const since = new Date(cutoffMs(rangeDays)).toISOString();
  const r = await listAuditEvents({ kind: "asr.quota_exceeded", since, limit: 50 });
  const events = asItems(r, "events");
  if (!events.length) return { exceeded: false, at: null };
  // Most recent event timestamp (events may arrive ascending or descending).
  const latest = events.reduce((m, e) => {
    const t = ts(e.created_at || e.at || e.ts);
    return t > m ? t : m;
  }, 0);
  return { exceeded: true, at: latest ? new Date(latest).toISOString() : null };
}

// ── Usage: dictation sessions, ASR jobs, reports ─────────────────────────────
// Walk a cursor-paginated list endpoint up to PAGE_CAP pages.
async function walkPages(fetchPage, ...envKeys) {
  const all = [];
  let cursor;
  let pages = 0;
  let capped = false;
  for (;;) {
    const r = await fetchPage(cursor);
    all.push(...asItems(r, ...envKeys));
    cursor = nextCursorOf(r);
    pages += 1;
    if (!cursor) break;
    if (pages >= PAGE_CAP) { capped = true; break; }
  }
  return { all, capped, pages };
}

// Dictation minutes + session count over the window, with a 14-day series.
export async function fetchSessionUsage(rangeDays) {
  const cut = cutoffMs(rangeDays);
  const { all, capped } = await walkPages(
    (cursor) => listSessions({ cursor, limit: PAGE_LIMIT }),
    "sessions",
  );
  // Count finalized sessions whose finalize time falls in the window.
  const finalized = all.filter((s) => {
    const when = ts(s.finalized_at) || ts(s.last_active_at) || ts(s.started_at);
    return String(s.status).toLowerCase() === "finalized" && when >= cut;
  });
  const totalMs = finalized.reduce((sum, s) => sum + (s.total_audio_ms || 0), 0);
  const series = bucketByDay(
    lastNDays(Math.min(rangeDays, 14)),
    finalized.map((s) => ({
      when: s.finalized_at || s.last_active_at || s.started_at,
      amount: (s.total_audio_ms || 0) / 60000,
    })),
  );
  return {
    minutes: Math.round(totalMs / 60000),
    sessions: finalized.length,
    series,
    capped,
  };
}

// ASR jobs: counts by status (window-filtered on queued_at) + 14-day series.
export async function fetchJobUsage(rangeDays) {
  const cut = cutoffMs(rangeDays);
  const { all, capped } = await walkPages(
    (cursor) => listJobs({ cursor, limit: PAGE_LIMIT }),
    "jobs",
  );
  const inWindow = all.filter((j) => {
    const when = ts(j.queued_at) || ts(j.created_at) || ts(j.finished_at);
    return isNaN(when) ? true : when >= cut;
  });
  const byStatus = { queued: 0, running: 0, complete: 0, failed: 0, cancelled: 0 };
  for (const j of inWindow) {
    const s = String(j.status || "").toLowerCase();
    if (s in byStatus) byStatus[s] += 1;
  }
  const series = bucketByDay(
    lastNDays(Math.min(rangeDays, 14)),
    inWindow.map((j) => ({ when: j.queued_at || j.created_at || j.finished_at, amount: 1 })),
  );
  return { total: inWindow.length, byStatus, series, capped };
}

// ── Reports ──────────────────────────────────────────────────────────────────
export const REPORT_STATUSES = ["draft", "finalized", "signed", "amended", "cancelled"];

// Exact count for a status via the search endpoint's `total=exact` (cheap: 1 hit).
async function countReports(params) {
  const r = await listReports({ ...params, limit: 1, total: "exact" });
  const exact = r && (r.total_exact ?? r.total_estimated);
  if (typeof exact === "number") return exact;
  // Fallback: count what we got (only when the backend omits totals).
  return asItems(r, "hits").length;
}

export async function fetchReportStats(rangeDays) {
  // Per-status exact counts in parallel.
  const counts = {};
  await Promise.all(
    REPORT_STATUSES.map(async (st) => { counts[st] = await countReports({ status: st }); }),
  );
  const total = REPORT_STATUSES.reduce((s, k) => s + (counts[k] || 0), 0);

  // Reports in the window, by encounter_date (the only date filter search offers).
  const fromDate = dayKey(new Date(cutoffMs(rangeDays)));
  let inWindow = null;
  try { inWindow = await countReports({ encounter_date_from: fromDate }); } catch { inWindow = null; }

  // Recently signed (most-recent first) for the mini-list.
  let recentSigned = [];
  try {
    const r = await listReports({ status: "signed", limit: 5 });
    recentSigned = asItems(r, "hits").map((h) => ({
      id: h.report_id || h.id,
      title: h.title,
      code: h.code,
      updated_at: h.updated_at,
    }));
  } catch { recentSigned = []; }

  return { counts, total, inWindow, windowFromDate: fromDate, recentSigned };
}

// ── Doctors ──────────────────────────────────────────────────────────────────
// Clinicians + nurses with their report volume (per-author exact counts). Per-
// session attribution isn't possible from the session *summary* (no user_id),
// so we attribute activity via report authorship, which the search endpoint does
// expose (author_id) — documented as the activity proxy in the panel.
export async function fetchDoctors() {
  const { users, capped } = await fetchAllUsers();
  const doctors = users.filter((u) => DOCTOR_ROLES.includes(String(u.role || "").toLowerCase()));
  const withActivity = await Promise.all(
    doctors.map(async (u) => {
      let reports = null;
      try { reports = await countReports({ author_id: u.sub }); } catch { reports = null; }
      return { ...u, reports };
    }),
  );
  withActivity.sort((a, b) => (b.reports || 0) - (a.reports || 0));
  return { doctors: withActivity, capped };
}

// ── Product capabilities (config-driven) ─────────────────────────────────────
// One entry per real platform capability; adding a capability is one row.
// `probe` describes the cheap proof the card shows; `service` keys the health dot.
export const CAPABILITIES = [
  { key: "dictation", service: "dictation", icon: "mic",
    nameUk: "Диктування в реальному часі (UK/EN)", nameEn: "Real-time dictation (UK/EN)",
    descUk: "Секційний потоковий ASR через WebSocket.", descEn: "Section-aware streaming ASR over WebSocket." },
  { key: "asr", service: "asr", icon: "bot",
    nameUk: "Пакетна транскрипція (Whisper)", nameEn: "Batch transcription (Whisper)",
    descUk: "Завантаження аудіо → асинхронна розшифровка.", descEn: "Upload audio → async transcription jobs." },
  { key: "nlp", service: "nlp", icon: "sparkle",
    nameUk: "Клінічна обробка NLP", nameEn: "Clinical NLP post-processing",
    descUk: "Розшифровка скорочень і структурування.", descEn: "Abbreviation expansion & structuring." },
  { key: "templates", service: "report", icon: "layers",
    nameUk: "Секційні шаблони звітів", nameEn: "Section-aware report templates",
    descUk: "Структуровані шаблони для кожної спеціальності.", descEn: "Structured templates per specialty." },
  { key: "reports", service: "report", icon: "fileText",
    nameUk: "Версійні звіти + PDF + пошук", nameEn: "Versioned reports + PDF + FTS",
    descUk: "Медико-правовий слід версій і повнотекстовий пошук.", descEn: "Medico-legal version trail and full-text search." },
  { key: "signing", service: "signing", icon: "sign",
    nameUk: "Кваліфікований підпис (КЕП) + перевірка", nameEn: "Qualified e-signature (КЕП) + verify",
    descUk: "Дія.Підпис / локальний КЕП + публічна перевірка.", descEn: "Дія.Підпис / local KEP + public verify." },
  { key: "autocomplete", service: "autocomplete", icon: "list",
    nameUk: "Клінічний автодоповнювач", nameEn: "Clinical autocomplete",
    descUk: "Підказки фраз під час диктування.", descEn: "Phrase suggestions while dictating." },
  { key: "identity", service: "auth", icon: "users",
    nameUk: "Ідентичність, ролі та тенант", nameEn: "Identity, roles & tenancy",
    descUk: "Багатотенантність з RLS і ролями.", descEn: "Multi-tenant RLS with role gates." },
  { key: "audit", service: "auth", icon: "shield",
    nameUk: "Незмінний журнал аудиту", nameEn: "Immutable audit trail",
    descUk: "Хеш-ланцюг подій із перевіркою.", descEn: "Hash-chained events with chain verify." },
];

// Health dot for a capability — readiness probe of its backing service.
// Returns "ready" | "starting" | "down". Mirrors HealthBadge semantics.
export async function probeService(serviceKey) {
  const base = SERVICES[serviceKey];
  if (!base) return "down";
  try {
    const r = await readyz(base);
    return r && r.status === "ready" ? "ready" : "starting";
  } catch {
    return "down";
  }
}

// Capability count proofs (best-effort, never throws): template count, role count.
export async function fetchCapabilityProofs() {
  const out = {};
  await Promise.all([
    listTemplates({ limit: 200 }).then(
      (r) => { out.templates = asItems(r, "templates").length; },
      () => { out.templates = null; },
    ),
    fetchAllUsers().then(
      ({ users }) => { out.roles = new Set(users.map((u) => u.role)).size; },
      () => { out.roles = null; },
    ),
  ]);
  return out;
}
