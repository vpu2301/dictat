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
import { listAuditEvents, listUsers, getUser, readyz, healthz } from "./endpoints.js";
import { listPrivacyRequests } from "./privacy.js";
import { listPhiAccessRequests, listAccessReasons } from "./phiAccess.js";
import { listOpenEncounters, listSchedule } from "./encounters.js";
import { listTemplates } from "./templates.js";
import { listAbbreviations } from "./nlp.js";
import { listSynonymGroups } from "./synonyms.js";
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
// process is unhappy. Mirrors ServiceHealth's ROLE_OF.
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

// ── People: the seat roster, and the two facts only the detail read carries ──
//
// GET /admin/users returns UserSummary — sub, email, display_name, role,
// status. That is enough to count seats and nothing else. The two questions an
// owner actually asks about people ("who still has no second factor?" and "who
// stopped using this?") live on UserDetail, which is a per-user GET. So this
// walks the roster and reads each row, bounded, with the bound disclosed.

const PEOPLE_DETAIL_CAP = 120;   // detail reads per load
const DETAIL_CONCURRENCY = 6;    // polite to auth-service; the roster is small
export const DORMANT_DAYS = 30;  // no sign-in in this long ⇒ dormant

/** Promise.all with a concurrency ceiling. Order of results matches `items`. */
async function mapLimit(items, limit, fn) {
  const out = new Array(items.length);
  let next = 0;
  const worker = async () => {
    for (;;) {
      const i = next++;
      if (i >= items.length) return;
      out[i] = await fn(items[i], i);
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return out;
}

/**
 * The people picture for the ACTIVE tenant: every seat, enriched where the
 * detail read succeeded, plus the rollups a security review asks for.
 *
 * A failed detail read is `mfa: "unknown"`, never `false` — reporting a user
 * as lacking MFA because a request 500'd would send someone chasing a phantom.
 */
export async function fetchPeopleDirectory({ dormantDays = DORMANT_DAYS } = {}) {
  const { users, capped } = await fetchAllUsers();
  const head = users.slice(0, PEOPLE_DETAIL_CAP);
  const details = await mapLimit(head, DETAIL_CONCURRENCY, (u) =>
    getUser(u.sub).catch(() => null));
  const detailOf = new Map(head.map((u, i) => [String(u.sub), details[i]]));

  const dormantCut = cutoffMs(dormantDays);
  const rows = users.map((u) => {
    const key = String(u.sub);
    const beyondCap = !detailOf.has(key);
    const d = detailOf.get(key) || null;
    const lastLogin = d?.last_login_at || null;
    const lastLoginMs = lastLogin ? Date.parse(lastLogin) : NaN;
    const active = String(u.status || "").toLowerCase() === "active";
    return {
      ...u,
      detail: d,
      beyondCap,
      detailFailed: !beyondCap && d == null,
      mfa: d ? (d.mfa_enrolled_at ? "on" : "off") : "unknown",
      mfaEnrolledAt: d?.mfa_enrolled_at || null,
      lastLoginAt: lastLogin,
      lastLoginMs: Number.isFinite(lastLoginMs) ? lastLoginMs : null,
      // "Never signed in" is only meaningful for an account that COULD sign in;
      // an invited user who hasn't accepted yet is not dormant, just new.
      neverSignedIn: !!d && active && !lastLogin,
      dormant: !!d && active && Number.isFinite(lastLoginMs) && lastLoginMs < dormantCut,
    };
  });

  rows.sort((a, b) => (b.lastLoginMs || 0) - (a.lastLoginMs || 0));

  const detailed = rows.filter((r) => r.detail);
  const activeDetailed = detailed.filter((r) => String(r.status || "").toLowerCase() === "active");
  const mfaOn = activeDetailed.filter((r) => r.mfa === "on").length;

  return {
    people: rows,
    seats: seatSummary(users),
    total: rows.length,
    detailed: detailed.length,
    unknown: rows.length - detailed.length,
    capped: capped || rows.length > PEOPLE_DETAIL_CAP,
    detailCap: PEOPLE_DETAIL_CAP,
    mfa: {
      on: mfaOn,
      off: activeDetailed.length - mfaOn,
      unknown: rows.length - activeDetailed.length,
      // Denominator is ACTIVE users we could read — the honest one. Invited
      // accounts have not enrolled because they have not arrived yet, and
      // counting them as gaps would make the number permanently red.
      of: activeDetailed.length,
      pct: activeDetailed.length ? Math.round((mfaOn / activeDetailed.length) * 100) : null,
    },
    dormant: rows.filter((r) => r.dormant),
    neverSignedIn: rows.filter((r) => r.neverSignedIn),
    dormantDays,
  };
}

// ── Governance: the privacy queue and the break-glass log ────────────────────
//
// Two oversight surfaces the owner console had no view of, both fully served:
//
//   GET /privacy-requests          (core-service, patient.read)  — DSAR and
//     erasure requests. Erasure is a TWO-PERSON workflow, so an item sitting in
//     `requested`/`review` is not "in progress", it is waiting for a human.
//   GET /v1/phi-access-requests    (report-service, phi_access.read) — every
//     time an administrator broke glass on a patient or a report, with the
//     reason they gave and whether the grant is still open.

export const PRIVACY_OPEN_STATUSES = ["requested", "review", "approved", "executing"];
export const PRIVACY_STATUSES = [...PRIVACY_OPEN_STATUSES, "completed", "rejected", "failed"];

// A grant row is `granted` | `revoked` (DB CHECK, migration 0056); expiry is
// carried by expires_at rather than a status, so "still open" is both.
function grantIsOpen(g, now = Date.now()) {
  if (String(g.status || "") !== "granted") return false;
  const exp = Date.parse(g.expires_at || "");
  return !Number.isFinite(exp) || exp > now;
}

function daysSince(v, now = Date.now()) {
  const t = Date.parse(v || "");
  if (!Number.isFinite(t)) return null;
  return Math.floor((now - t) / 86400000);
}

/**
 * Both queues in one read, each degrading independently: an admin without
 * `phi_access.read` still gets the privacy queue rather than an empty page.
 */
export async function fetchGovernanceQueue({ grantLimit = 100 } = {}) {
  const [privacyR, grantsR, reasonsR] = await Promise.all([
    listPrivacyRequests().then((r) => ({ items: asItems(r, "requests") })).catch((e) => ({ error: e })),
    listPhiAccessRequests({ limit: grantLimit }).then((r) => ({ items: asItems(r, "grants") })).catch((e) => ({ error: e })),
    listAccessReasons().then((r) => asItems(r, "reasons")).catch(() => []),
  ]);

  const now = Date.now();
  const privacy = (privacyR.items || []).slice().sort(
    (a, b) => (Date.parse(b.requested_at || "") || 0) - (Date.parse(a.requested_at || "") || 0));
  const open = privacy.filter((p) => PRIVACY_OPEN_STATUSES.includes(String(p.status)));
  // The two-person rule's actual waiting room: an erasure nobody has approved
  // or rejected yet. This is the number that should drive someone's day.
  const awaitingApproval = privacy.filter(
    (p) => String(p.kind) === "erasure" && ["requested", "review"].includes(String(p.status)));

  const grants = (grantsR.items || []).slice().sort(
    (a, b) => (Date.parse(b.granted_at || "") || 0) - (Date.parse(a.granted_at || "") || 0));
  const openGrants = grants.filter((g) => grantIsOpen(g, now));

  const reasonLabels = {};
  for (const r of reasonsR) reasonLabels[r.code] = r;

  return {
    privacy: {
      items: privacy,
      error: privacyR.error || null,
      open,
      awaitingApproval,
      byStatus: countBy(privacy, (p) => p.status),
      byKind: countBy(privacy, (p) => p.kind),
      oldestOpenDays: open.reduce((m, p) => {
        const d = daysSince(p.requested_at, now);
        return d != null && d > m ? d : m;
      }, 0),
    },
    grants: {
      items: grants,
      error: grantsR.error || null,
      open: openGrants,
      // A grant that was minted and never used is worth a question: either the
      // reason evaporated, or somebody is holding a key they did not need.
      unused: openGrants.filter((g) => !Number(g.use_count)),
      byReason: countBy(grants, (g) => g.reason_code),
      byRequester: countBy(grants, (g) => g.requested_by || "—"),
      reasonLabels,
      capped: grants.length >= grantLimit,
      cap: grantLimit,
    },
  };
}

// ── Clinical load: what the platform is carrying right now ───────────────────
//
// Everything else in this console is retrospective. `GET /encounters/open` and
// `GET /schedule` are the only present-tense reads a tenant_admin token can
// make (both ride `patient.read`), which makes them the difference between "the
// service was up last week" and "eleven consultations are in flight".
//
// PHI note: an admin holds the REDACTED roster only. Rows here may carry a
// `patient` stub with a name and nothing else — treat it as a label, never
// render it next to a clinical detail.

export async function fetchClinicalLoad({ date } = {}) {
  const [openR, schedR] = await Promise.all([
    listOpenEncounters({ mine: false, limit: 100 })
      .then((r) => ({ items: asItems(r, "encounters") })).catch((e) => ({ error: e })),
    listSchedule({ date }).then((r) => ({ items: asItems(r, "encounters") })).catch((e) => ({ error: e })),
  ]);
  const open = openR.items || [];
  const scheduled = schedR.items || [];
  return {
    open,
    openError: openR.error || null,
    byStatus: countBy(open, (e) => e.status),
    byKind: countBy(open, (e) => e.kind),
    // Started long ago and never closed — usually a forgotten encounter rather
    // than a marathon consultation, and it blocks the patient's next one.
    stale: open.filter((e) => {
      const t = Date.parse(e.started_at || e.occurred_at || "");
      return Number.isFinite(t) && Date.now() - t > 8 * 3600 * 1000;
    }),
    scheduled,
    scheduleError: schedR.error || null,
    date: date || null,
  };
}

// ── Clinical content: what the platform knows, as opposed to what it did ─────
//
// Templates, abbreviations and synonyms are the three registries the vendor
// curates and every tenant inherits. They are the product's actual content, and
// until now the console could only see one of them (templates).

export async function fetchContentRegistry({ language } = {}) {
  const [tplR, abbrR, synR] = await Promise.all([
    listTemplates({ include_deprecated: true })
      .then((r) => ({ items: asItems(r, "templates") })).catch((e) => ({ error: e })),
    listAbbreviations({ language, limit: 200 })
      .then((r) => ({ items: asItems(r, "abbreviations") })).catch((e) => ({ error: e })),
    listSynonymGroups().then((r) => ({ items: asItems(r, "groups") })).catch((e) => ({ error: e })),
  ]);

  const templates = tplR.items || [];
  const abbreviations = abbrR.items || [];
  const synonyms = synR.items || [];
  const tenantSynonyms = synonyms.filter((g) => String(g.source) === "tenant");

  return {
    templates: {
      items: templates,
      error: tplR.error || null,
      total: templates.length,
      tenant: templates.filter((t) => t.tenant_id || t.is_tenant || t.parent_template_id).length,
      deprecated: templates.filter((t) => t.is_deprecated || t.status === "deprecated").length,
      byLanguage: countBy(templates, (t) => t.language || "—"),
    },
    abbreviations: {
      items: abbreviations,
      error: abbrR.error || null,
      total: abbreviations.length,
      // A tenant override shadows the shipped expansion for this clinic only —
      // the interesting subset, because it is what somebody chose to change.
      overrides: abbreviations.filter((a) => a.is_tenant_override).length,
      byLanguage: countBy(abbreviations, (a) => a.language || "—"),
      // The list read is capped at 200 by the backend, so a full page is a
      // truncation, not a total.
      capped: abbreviations.length >= 200,
      cap: 200,
    },
    synonyms: {
      items: synonyms,
      error: synR.error || null,
      total: synonyms.length,
      tenant: tenantSynonyms.length,
      system: synonyms.length - tenantSynonyms.length,
      terms: synonyms.reduce((s, g) => s + (g.terms?.length || 0), 0),
      byLanguage: countBy(synonyms, (g) => g.language || "—"),
    },
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
      "libs/auth/perms.py now carries six roles — tenant_admin, clinician, nurse, auditor, service and "
      + "knowledge_admin (the evidence-corpus curator added in EVA-S01) — and not one of them is "
      + "platform-scoped: every row of the matrix is evaluated against the single tid in the JWT. "
      + "super_admin is referenced by the SPA but the server neither issues nor honours it.",
    blockerUk:
      "libs/auth/perms.py уже містить шість ролей — tenant_admin, clinician, nurse, auditor, service і "
      + "knowledge_admin (куратор корпусу доказів, EVA-S01) — і жодна з них не є платформною: кожен рядок "
      + "матриці перевіряється проти єдиного tid у токені. "
      + "super_admin згадується в SPA, але сервер його не видає й не визнає.",
    needEn: "Add a platform role to KNOWN_ROLES + ALLOW, issue it via Keycloak, and gate /platform/* on it.",
    needUk: "Додати платформну роль до KNOWN_ROLES + ALLOW, видавати через Keycloak і закрити нею /platform/*.",
  },
  {
    id: "role-set-write-only",
    titleEn: "A user's role SET cannot be read back",
    titleUk: "Набір ролей користувача неможливо прочитати",
    haveEn: "PUT /admin/users/{sub}/roles writes the whole set; GET returns one collapsed `role`.",
    haveUk: "PUT /admin/users/{sub}/roles записує весь набір; GET повертає один згорнутий `role`.",
    blockerEn:
      "Both UserSummary and UserDetail expose `role` — the single value auth-service collapses the set "
      + "to by precedence (tenant_admin > clinician > nurse > auditor > service). The real set lives in "
      + "Keycloak and no endpoint reads it out, so a doctor who also administers the clinic is "
      + "indistinguishable from an admin-only account, and any role edit is a blind overwrite.",
    blockerUk:
      "UserSummary і UserDetail віддають `role` — єдине значення, до якого auth-service згортає набір за "
      + "пріоритетом (tenant_admin > clinician > nurse > auditor > service). Справжній набір лежить у "
      + "Keycloak, і жоден ендпоінт його не віддає: лікар, який ще й адмініструє клініку, невідрізненний "
      + "від суто адміністративного акаунта, а будь-яка зміна ролей — це запис наосліп.",
    needEn: "Add `roles: string[]` to UserDetail (auth-service already calls keycloak.get_realm_roles inside the PUT).",
    needUk: "Додати `roles: string[]` до UserDetail (auth-service уже викликає keycloak.get_realm_roles усередині PUT).",
  },
  {
    id: "mfa-coverage-n-plus-1",
    titleEn: "Second-factor coverage costs one request per person",
    titleUk: "Покриття другим фактором коштує запит на людину",
    haveEn: "Coverage assembled in the browser from GET /admin/users/{sub}, capped at 120 people per load.",
    haveUk: "Покриття збирається у браузері з GET /admin/users/{sub}, обмежено 120 людьми на завантаження.",
    blockerEn:
      "`mfa_enrolled_at` and `last_login_at` are on UserDetail only — the roster list (UserSummary) omits "
      + "both. Coverage and dormancy are therefore N+1 reads, and beyond the cap the answer is 'unknown' "
      + "rather than a number.",
    blockerUk:
      "`mfa_enrolled_at` і `last_login_at` є лише в UserDetail — список ролей (UserSummary) їх не містить. "
      + "Тому покриття й «сплячі» акаунти — це N+1 запитів, а поза лімітом відповідь — «невідомо», не число.",
    needEn: "Put mfa_enrolled_at + last_login_at on UserSummary, or add GET /admin/users/stats.",
    needUk: "Додати mfa_enrolled_at і last_login_at до UserSummary, або GET /admin/users/stats.",
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
