// company.js — aggregation layer for the Klarnote *platform owner* console
// (#/company). Everything the owner console renders is composed here so the
// panels stay dumb, and every bound is disclosed rather than silently applied.
//
// ── What the backend actually allows (verified against medical-dictation-backend)
//
// The platform is strictly single-tenant at the token level. `libs/db` refuses
// to hand out a connection that bypasses RLS (its integration test asserts
// `app_role` has rolbypassrls = false), and every data read is scoped to
// `claims.tid` — the tenant baked into the Keycloak-issued JWT.
//
// Two endpoints are the exception, and they are the backbone of this console:
//
//   GET /tenants                  — every tenant the CALLER IS A MEMBER OF
//   GET /tenants/{id}             — full profile of any such tenant
//   GET /tenants/{id}/members     — full member roster of any such tenant
//
// auth-service serves those three off `tenant_writer_pool` after an explicit
// membership check (`_require_member`), *not* off the RLS-scoped app pool — so
// they genuinely resolve cross-tenant. That gives us a real portfolio view.
//
// Everything deeper (users, reports, dictation sessions, ASR jobs, audit) is
// RLS-scoped to the active tenant only. `POST /tenants/{id}/switch` does NOT
// change that: it is an authorization gate + audit hook, and its own response
// says "re-authenticate to obtain a token scoped to this tenant". So per-tenant
// usage for a tenant other than the active one is a genuine backend gap, and the
// panels label it as one instead of faking a number.
//
// Billing/subscriptions do not exist in the backend at all — there is no plan,
// price, invoice or seat-limit resource anywhere. The one real commercial signal
// is the ASR monthly byte quota (services/asr-service/.../validators/quota.py),
// and even that exposes no bytes-used readout, only an `asr.quota_exceeded`
// audit event. SubscriptionsPanel is built on exactly those real signals.

import { listTenants, getTenant, listMembers } from "./tenants.js";
import { listAuditEvents, listUsers, readyz, healthz } from "./endpoints.js";
import { SERVICES, readyPathFor } from "./services.js";
import {
  cutoffMs,
  lastNDays,
  seatSummary,
  fetchAllUsers,
  fetchSessionUsage,
  fetchJobUsage,
  fetchReportStats,
  asrQuotaStatus,
} from "./dashboard.js";

export {
  cutoffMs,
  lastNDays,
  seatSummary,
  fetchAllUsers,
  fetchSessionUsage,
  fetchJobUsage,
  fetchReportStats,
  asrQuotaStatus,
};

// ── Bounds (always disclosed in the UI) ──────────────────────────────────────
const TENANT_DETAIL_CAP = 60;   // profiles+rosters fetched per portfolio load
const AUDIT_PAGE_LIMIT = 200;
const AUDIT_PAGE_CAP = 10;      // ⇒ at most 2000 events walked

function asItems(r, ...keys) {
  if (Array.isArray(r)) return r;
  if (!r || typeof r !== "object") return [];
  for (const k of keys) if (Array.isArray(r[k])) return r[k];
  return r.items || [];
}

// ── Tenant portfolio (the one genuinely cross-tenant surface) ────────────────

/**
 * Every tenant the owner belongs to, each enriched with its full profile and
 * member roster. Per-tenant failures are captured on the row (`error`) rather
 * than failing the whole load — one 404'd tenant must not blank the portfolio.
 *
 * @param {string|null} activeTid the JWT's tid, so rows can be marked "active".
 */
export async function fetchTenantPortfolio(activeTid = null) {
  const list = await listTenants();
  const summaries = asItems(list);
  const capped = summaries.length > TENANT_DETAIL_CAP;
  const head = summaries.slice(0, TENANT_DETAIL_CAP);

  const rows = await Promise.all(head.map(async (t) => {
    const id = t.id;
    const [detail, members] = await Promise.all([
      getTenant(id).catch((e) => ({ __error: e })),
      listMembers(id).then((r) => asItems(r)).catch(() => null),
    ]);
    const failed = detail && detail.__error;
    return {
      ...t,
      id,
      isActive: activeTid != null && String(id) === String(activeTid),
      detail: failed ? null : detail,
      error: failed ? detail.__error : null,
      members: members || [],
      membersUnavailable: members == null,
      roleCounts: countBy(members || [], (m) => m.role),
      platformRoleCounts: countBy(members || [], (m) => m.platform_role || "—"),
      createdAt: (!failed && detail && detail.created_at) || null,
    };
  }));

  // Active tenant first, then most recently created, then name.
  rows.sort((a, b) => {
    if (a.isActive !== b.isActive) return a.isActive ? -1 : 1;
    const ta = Date.parse(a.createdAt || "") || 0;
    const tb = Date.parse(b.createdAt || "") || 0;
    if (ta !== tb) return tb - ta;
    return String(a.display_name || a.name).localeCompare(String(b.display_name || b.name));
  });

  return {
    tenants: rows,
    total: summaries.length,
    capped,
    cap: TENANT_DETAIL_CAP,
    activeTid: activeTid ? String(activeTid) : null,
  };
}

function countBy(items, keyOf) {
  const out = {};
  for (const it of items) {
    const k = String(keyOf(it) ?? "—");
    out[k] = (out[k] || 0) + 1;
  }
  return out;
}

/** Portfolio-level roll-up: tenants, members, statuses, countries, locales. */
export function portfolioSummary(portfolio) {
  const rows = portfolio?.tenants || [];
  const members = rows.reduce((s, t) => s + t.members.length, 0);
  const uniquePeople = new Set();
  for (const t of rows) for (const m of t.members) uniquePeople.add(String(m.user_sub));
  const active = rows.filter((t) => t.is_active !== false && String(t.status || "active") === "active");
  return {
    tenants: rows.length,
    activeTenants: active.length,
    suspendedTenants: rows.length - active.length,
    memberships: members,
    people: uniquePeople.size,
    countries: unique(rows.map((t) => t.detail?.country).filter(Boolean)),
    locales: unique(rows.map((t) => t.detail?.locale).filter(Boolean)),
    roleCounts: rows.reduce((acc, t) => {
      for (const [k, v] of Object.entries(t.roleCounts)) acc[k] = (acc[k] || 0) + v;
      return acc;
    }, {}),
  };
}

function unique(xs) {
  return [...new Set(xs)];
}

// ── Platform telemetry: service health matrix ────────────────────────────────

const READY_WORDS = ["ready", "ok", "healthy"];

// What each service powers — a red row should say what breaks, not just which
// process is unhappy. Mirrors HealthBadge's ROLE_OF.
export const SERVICE_ROLE = {
  auth:         { uk: "Вхід, користувачі, клініки, аудит", en: "Sign-in, users, tenants, audit" },
  asr:          { uk: "Пакетна транскрипція",              en: "Batch transcription" },
  dictation:    { uk: "Живе диктування (WebSocket)",       en: "Live dictation (WebSocket)" },
  nlp:          { uk: "Обробка тексту",                    en: "Text post-processing" },
  report:       { uk: "Звіти та шаблони",                  en: "Reports and templates" },
  autocomplete: { uk: "Автодоповнення",                    en: "Editor autocomplete" },
  signing:      { uk: "Підписання (КЕП)",                  en: "Qualified signing (КЕП)" },
  core:         { uk: "Пацієнти, прийоми, згоди",          en: "Patients, encounters, consents" },
  notification: { uk: "Сповіщення",                        en: "Notifications" },
};

/**
 * Probe every configured service. Never throws; a dead service is a row, not an
 * exception. Runs /readyz for state and /healthz for the version/uptime fields
 * the backend chooses to expose.
 */
export async function fetchPlatformHealth() {
  const entries = await Promise.all(
    // CONFIGURED, not merely listed. A `SERVICES` entry may be deliberately
    // blank — `evidenceChat` is, because that backend belongs to a separate
    // product and most deployments do not have one. Probing a blank base
    // resolves `/readyz` against the SPA's own origin, which answers with
    // index.html, which parses as "not ready" — a permanent phantom outage in
    // the owner console for a service nobody has deployed or expects to.
    Object.entries(SERVICES).filter(([, base]) => !!base).map(async ([key, base]) => {
      const t0 = Date.now();
      let state = "down";
      let detail = "";
      let body = null;
      try {
        // Not always /readyz — see readyPathFor(); a foreign service probed at
        // our path 404s and would be reported down while it is serving.
        const r = await fetch(`${base}${readyPathFor(key)}`, { method: "GET" });
        try { body = await r.json(); } catch { body = null; }
        const status = String(body?.status || "").toLowerCase();
        if (r.ok && READY_WORDS.includes(status)) {
          state = "ready";
          detail = status;
        } else {
          state = "notready";
          // 503 {status:"not_ready", db:"down", …} — name the failing part.
          detail = body && typeof body === "object"
            ? Object.entries(body)
                .filter(([k, v]) => k !== "status" && v !== "ok" && v !== true)
                .map(([k, v]) => `${k}: ${v}`).join(", ") || status || `HTTP ${r.status}`
            : `HTTP ${r.status}`;
        }
      } catch (e) {
        // fetch() cannot distinguish "connection refused" from "CORS-blocked".
        state = "down";
        detail = String(e?.message || e);
      }
      const ms = Date.now() - t0;

      let version = null;
      if (state !== "down") {
        try {
          const h = await healthz(base);
          version = h?.version || h?.service_version || h?.build || null;
        } catch { version = null; }
      }

      return { key, base, port: portOf(base), state, detail, ms, version, body };
    }),
  );
  entries.sort((a, b) => a.key.localeCompare(b.key));
  const ready = entries.filter((e) => e.state === "ready").length;
  return {
    services: entries,
    ready,
    total: entries.length,
    overall: ready === entries.length ? "ready"
      : entries.some((e) => e.state === "down") ? "down" : "notready",
    checkedAt: new Date().toISOString(),
  };
}

function portOf(base) {
  try { const u = new URL(base); return u.port || u.host; } catch { return base; }
}

// ── Platform telemetry: the audit stream ─────────────────────────────────────
//
// /audit/events is RLS-scoped to the active tenant and hash-chained. It is the
// richest real telemetry the browser can reach: every login, invite, role
// change, tenant switch, report sign, break-glass grant and quota trip lands
// here with an actor, a severity and a monotonic sequence number.

export const SEVERITIES = ["info", "sec", "warn", "error"];

function eventTime(e) {
  return e.created_at || e.at || e.ts || e.occurred_at || null;
}

/**
 * Walk the audit stream over `rangeDays` and roll it into the shapes the
 * telemetry panel needs: totals, by-kind, by-severity, by-actor, daily series.
 */
export async function fetchAuditTelemetry(rangeDays = 30) {
  const since = new Date(cutoffMs(rangeDays)).toISOString();
  const all = [];
  let cursor;
  let pages = 0;
  let capped = false;
  for (;;) {
    const r = await listAuditEvents({ since, limit: AUDIT_PAGE_LIMIT, cursor });
    all.push(...asItems(r, "events"));
    cursor = (r && (r.next_cursor || r.nextCursor)) || null;
    pages += 1;
    if (!cursor) break;
    if (pages >= AUDIT_PAGE_CAP) { capped = true; break; }
  }

  const byKind = countBy(all, (e) => e.kind);
  const bySeverity = countBy(all, (e) => String(e.severity || "info").toLowerCase());
  const byActor = countBy(all, (e) => e.actor_sub || "system");

  const series = lastNDays(Math.min(rangeDays, 30));
  const idx = new Map(series.map((s, i) => [s.key, i]));
  for (const e of all) {
    const when = eventTime(e);
    if (!when) continue;
    const d = new Date(when);
    if (isNaN(d)) continue;
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    const i = idx.get(key);
    if (i != null) { series[i].count += 1; series[i].value += 1; }
  }

  const seqs = all.map((e) => Number(e.seq)).filter((n) => Number.isFinite(n));
  const topKinds = Object.entries(byKind).sort((a, b) => b[1] - a[1]);

  return {
    total: all.length,
    events: all,
    byKind,
    topKinds,
    bySeverity,
    byActor,
    series,
    capped,
    cap: AUDIT_PAGE_LIMIT * AUDIT_PAGE_CAP,
    minSeq: seqs.length ? Math.min(...seqs) : null,
    maxSeq: seqs.length ? Math.max(...seqs) : null,
    since,
    recent: all.slice(0, 25),
  };
}

// Kinds worth calling out on the overview — the security-relevant ones.
export const SECURITY_KINDS = [
  "auth.login_failed",
  "auth.refresh_replay_detected",
  "user.deactivated",
  "user.roles_changed",
  "phi_access.granted",
  "asr.quota_exceeded",
];

export function securitySignals(telemetry) {
  const byKind = telemetry?.byKind || {};
  return SECURITY_KINDS.map((k) => ({ kind: k, count: byKind[k] || 0 }))
    .filter((x) => x.count > 0);
}

// ── Subscriptions, built from the real signals only ──────────────────────────
//
// [GAP] There is no billing backend. What IS real: the seat roster
// (GET /admin/users) and the ASR monthly byte quota trip (audit event). The
// catalogue below mirrors the public pricing page so the console and the site
// never disagree; `suggestPlan` maps real seat counts onto it as an *indication*,
// clearly labelled in the UI as not a billed subscription.

export const PLAN_CATALOGUE = [
  { id: "free", name: "Free",       monthlyUsd: 0,    seatsUpTo: 1,        note: "1 clinician, basic templates" },
  { id: "pro",  name: "Pro",        monthlyUsd: 29,   seatsUpTo: 5,        note: "per clinician / month" },
  { id: "team", name: "Team",       monthlyUsd: 69,   seatsUpTo: 25,       note: "per clinician / month, shared templates" },
  { id: "ent",  name: "Enterprise", monthlyUsd: null, seatsUpTo: Infinity, note: "invoiced, custom terms" },
];

/** Which catalogue tier a seat count falls into. Indicative, never billed. */
export function suggestPlan(clinicalSeats) {
  const n = Number(clinicalSeats) || 0;
  return PLAN_CATALOGUE.find((p) => n <= p.seatsUpTo) || PLAN_CATALOGUE[PLAN_CATALOGUE.length - 1];
}

/** Indicative monthly run-rate for a tier at a seat count (null = quote-only). */
export function indicativeMrr(plan, clinicalSeats) {
  if (!plan || plan.monthlyUsd == null) return null;
  return plan.monthlyUsd * (Number(clinicalSeats) || 0);
}

/**
 * The subscription picture for the ACTIVE tenant — the only tenant whose seat
 * roster the RLS-scoped token can read.
 */
export async function fetchSubscriptionPicture() {
  const [{ users, capped }, quota] = await Promise.all([
    fetchAllUsers(),
    asrQuotaStatus(30).catch(() => ({ exceeded: false, at: null, unknown: true })),
  ]);
  const seats = seatSummary(users);
  const clinical = (seats.byRole.clinician || 0) + (seats.byRole.nurse || 0);
  const plan = suggestPlan(clinical);
  return {
    seats,
    clinicalSeats: clinical,
    plan,
    indicativeMrr: indicativeMrr(plan, clinical),
    quota,
    capped,
    users,
  };
}

// ── The gap register ─────────────────────────────────────────────────────────
//
// Every owner-console capability the backend cannot serve today, with the exact
// blocker. This is rendered as a page, not buried in comments, because the
// honest answer to "where is our MRR" is "no service computes it" — not a zero.

export const BACKEND_GAPS = [
  {
    id: "cross-tenant-usage",
    titleEn: "Per-tenant usage across the portfolio",
    titleUk: "Використання по кожному тенанту",
    haveEn: "Profile + member roster for every tenant you belong to.",
    haveUk: "Профіль і склад учасників для кожного вашого тенанта.",
    blockerEn:
      "Reports, dictation sessions, ASR jobs and audit are RLS-scoped to the JWT's tid. "
      + "POST /tenants/{id}/switch is only an authorization gate — its own response says "
      + "re-authentication is required before that tenant's data is visible.",
    blockerUk:
      "Звіти, сесії, ASR-завдання й аудит обмежені RLS до tid у токені. "
      + "POST /tenants/{id}/switch лише авторизує — відповідь сама каже, що потрібна повторна автентифікація.",
    needEn: "A platform-scoped read API (e.g. GET /platform/tenants/{id}/usage) served by a role that may read across tenants.",
    needUk: "Платформний read-API (напр. GET /platform/tenants/{id}/usage) під роллю з крос-тенантним доступом.",
  },
  {
    id: "billing",
    titleEn: "Subscriptions, invoices, MRR",
    titleUk: "Підписки, рахунки, MRR",
    haveEn: "Seat counts per role, and the public plan catalogue.",
    haveUk: "Кількість місць за ролями та публічний каталог тарифів.",
    blockerEn: "No billing domain exists in the backend — no plan, price, invoice, trial or seat-limit resource anywhere.",
    blockerUk: "У бекенді немає домену білінгу — жодного ресурсу тарифу, ціни, рахунку, пробного періоду чи ліміту місць.",
    needEn: "A billing service (or Stripe bridge) exposing subscription, seat-limit and invoice reads.",
    needUk: "Сервіс білінгу (або міст до Stripe) із читанням підписки, ліміту місць і рахунків.",
  },
  {
    id: "quota-bytes",
    titleEn: "ASR quota consumption",
    titleUk: "Спожита квота ASR",
    haveEn: "Whether the monthly cap was tripped, from the asr.quota_exceeded audit event.",
    haveUk: "Чи спрацював місячний ліміт — з події аудиту asr.quota_exceeded.",
    blockerEn:
      "asr-service enforces a monthly byte cap (validators/quota.py) but exposes no bytes-used readout; "
      + "the number is only ever computed inside the upload transaction.",
    blockerUk:
      "asr-service застосовує місячний ліміт байтів, але не віддає використаний обсяг — "
      + "значення рахується лише всередині транзакції завантаження.",
    needEn: "GET /asr/quota → { used_bytes, limit_bytes, period_start }.",
    needUk: "GET /asr/quota → { used_bytes, limit_bytes, period_start }.",
  },
  {
    id: "platform-role",
    titleEn: "A server-enforced platform-owner role",
    titleUk: "Роль власника платформи на боці сервера",
    haveEn: "An email allowlist in the SPA that decides which nav entry renders.",
    haveUk: "Список email у SPA, який вирішує, який пункт навігації показати.",
    blockerEn:
      "libs/auth/perms.py pins KNOWN_ROLES to {tenant_admin, clinician, nurse, auditor, service}. "
      + "super_admin is referenced by the SPA but the server neither issues nor honours it.",
    blockerUk:
      "libs/auth/perms.py фіксує KNOWN_ROLES = {tenant_admin, clinician, nurse, auditor, service}. "
      + "super_admin згадується в SPA, але сервер його не видає й не визнає.",
    needEn: "Add a platform role to KNOWN_ROLES + ALLOW, issue it via Keycloak, and gate /platform/* on it.",
    needUk: "Додати платформну роль до KNOWN_ROLES + ALLOW, видавати через Keycloak і закрити нею /platform/*.",
  },
  {
    id: "infra-telemetry",
    titleEn: "Latency, error-rate and throughput series",
    titleUk: "Ряди латентності, помилок і пропускної здатності",
    haveEn: "Live readiness + round-trip time per service, probed from the browser.",
    haveUk: "Живий стан готовності й час відгуку кожного сервісу, зміряні з браузера.",
    blockerEn:
      "Prometheus, Grafana, Loki and OTel collectors are configured under infra/ but are not "
      + "browser-reachable: no CORS, no auth bridge, and the metrics endpoints are cluster-internal.",
    blockerUk:
      "Prometheus, Grafana, Loki й OTel налаштовані в infra/, але недоступні з браузера: "
      + "немає CORS і мосту автентифікації, а /metrics — внутрішні для кластера.",
    needEn: "A read-only query proxy (e.g. GET /platform/metrics?q=…) fronting Prometheus with owner auth.",
    needUk: "Проксі лише для читання (напр. GET /platform/metrics?q=…) перед Prometheus з авторизацією власника.",
  },
];

// Re-exported so panels can probe a single service without importing SERVICES.
export { SERVICES, listUsers, readyz };
