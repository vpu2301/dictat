// ServiceHealth.jsx — backend readiness probing and the surfaces that show it.
//
// Polls /readyz on every configured service and rolls the results into one
// summary. A summary alone is not actionable ("Down" — what is down?), so the
// detail always names every service with its state, port, round-trip time and
// the reason it failed, plus a re-check button.
//
// Two surfaces consume this module:
//   HealthPanel  — the drop-up behind the clinician's account menu (Sidebar).
//   StatusPage   — the public #/status page the site footer links to. The
//                  footer used to carry the same drop-up; a visitor asking
//                  "is it up?" deserves a page they can link to and reload,
//                  not a popover that closes on the next click.
//
// Backend convention (spec §A sprint 01): /healthz is liveness and returns 200
// always; /readyz returns 200 {status:"ready"} or 503 {status:"not_ready"}.
// signing-service answers {"status":"ok"} — same meaning, different word.
//
// That convention is ours, and it only binds services we build. `evidenceChat`
// is a separate product with its own contract, so its path is an exception in
// READY_PATH_OF rather than a reason to report a healthy service as broken.
//
// Failure modes we distinguish, because they need different fixes:
//   down    — no HTTP response at all (service stopped, wrong port), OR the
//             browser blocked the response because the service sends no CORS
//             header. JS cannot tell these apart; both surface as "blocked or
//             unreachable" with a hint.
//   notready— the service answered but is not serving yet (503 / other status).
//   ready   — serving.

import React, { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Icon } from "./UI.jsx";
import { SERVICES, DEFAULT_READY_PATH, readyPathFor } from "../api/services.js";
import { tr } from "../i18n.js";

const READY_WORDS = ["ready", "ok", "healthy"];
const PORT_OF = (base) => { try { return new URL(base).port || new URL(base).host; } catch { return base; } };

// What each service actually powers — so a red row says what will break, not
// just which process is unhappy. Keys match SERVICES in api/services.js.
export const ROLE_OF = {
  auth:         { uk: "Вхід, користувачі, клініки, аудит", en: "Sign-in, users, clinics, audit" },
  asr:          { uk: "Завдання транскрипції аудіо",      en: "Speech-to-text jobs" },
  dictation:    { uk: "Живе диктування (WebSocket)",      en: "Live dictation (WebSocket)" },
  nlp:          { uk: "Пунктуація та обробка тексту",     en: "Punctuation and text processing" },
  report:       { uk: "Звіти та шаблони",                  en: "Reports and templates" },
  autocomplete: { uk: "Автодоповнення в редакторі",        en: "Editor autocomplete" },
  signing:      { uk: "Підписання документів",             en: "Document signing" },
  core:         { uk: "Пацієнти, прийоми, згоди",          en: "Patients, encounters, consents" },
  notification: { uk: "Сповіщення",                        en: "Notifications" },
  evidenceRetrieval: { uk: "Пошук у доказовій базі",       en: "Evidence retrieval" },
  evidenceAnswer:    { uk: "Конвеєр доказових відповідей", en: "Evidence answer pipeline" },
  evidenceWebsearch: { uk: "Швидкий вебпошук джерел",      en: "Quick web source search" },
  evidenceChat:      { uk: "Доказовий чат (зовнішній API)", en: "Evidence chat (external API)" },
};


export const STATE = {
  ready:    { dot: "#10b981", fg: "#047857", bg: "rgba(4,120,87,.12)",   uk: "Готово",     en: "Ready" },
  notready: { dot: "#f59e0b", fg: "#b45309", bg: "rgba(180,83,9,.12)",   uk: "Запуск…",    en: "Starting" },
  down:     { dot: "#dc2626", fg: "#dc2626", bg: "rgba(220,38,38,.12)",  uk: "Недоступно", en: "Down" },
  checking: { dot: "#9ca3af", fg: "#6b7480", bg: "rgba(107,116,128,.12)", uk: "Перевірка",  en: "Checking" },
};

// One probe. Returns { state, detail, ms } — never throws.
async function probe(base, path = DEFAULT_READY_PATH) {
  const t0 = performance.now();
  try {
    const r = await fetch(`${base}${path}`, { method: "GET" });
    const ms = Math.round(performance.now() - t0);
    let body = null;
    try { body = await r.json(); } catch { /* non-JSON body */ }
    const status = String(body?.status || "").toLowerCase();
    if (r.ok && READY_WORDS.includes(status)) return { state: "ready", detail: status, ms };
    if (r.ok && !status) return { state: "notready", detail: `HTTP ${r.status}, no status field`, ms };
    // 503 {status:"not_ready", db:"down", …} — surface the first failing part.
    const failing = body && typeof body === "object"
      ? Object.entries(body).filter(([k, v]) => k !== "status" && v !== "ok" && v !== true)
          .map(([k, v]) => `${k}: ${v}`).join(", ")
      : "";
    return { state: "notready", detail: failing || status || `HTTP ${r.status}`, ms };
  } catch (e) {
    // TypeError: Failed to fetch — connection refused OR a CORS-blocked
    // response. Indistinguishable here by design of the fetch spec.
    return { state: "down", detail: String(e?.message || e), ms: Math.round(performance.now() - t0) };
  }
}

// The probing itself, separated from where it is shown: the same check now
// answers in three places (the account menu, the panel it opens, the public
// site's footer), and each of them wants a different amount of it.
//
// `enabled` exists because this used to poll every 30 s for the whole session
// just to keep a pill in the sidebar footer current. Behind a menu, the honest
// contract is: check when someone is looking.
export function useServiceHealth({ intervalMs = 30000, enabled = true } = {}) {
  const [services, setServices] = useState({});   // name → { state, detail, ms }
  const [checkedAt, setCheckedAt] = useState(null);
  const [busy, setBusy] = useState(false);

  const check = useCallback(async () => {
    setBusy(true);
    const entries = await Promise.all(
      // Blank base = not configured, not "down". See fetchPlatformHealth in
      // src/api/company.js for why probing one reports a phantom outage.
      Object.entries(SERVICES)
        .filter(([, base]) => !!base)
        .map(async ([name, base]) => [
          name,
          { ...(await probe(base, readyPathFor(name))), base, path: readyPathFor(name) },
        ]),
    );
    setServices(Object.fromEntries(entries));
    setCheckedAt(Date.now());
    setBusy(false);
  }, []);

  useEffect(() => {
    if (!enabled) return undefined;
    let cancelled = false;
    let timer;
    const loop = async () => {
      await check();
      if (!cancelled) timer = setTimeout(loop, intervalMs);
    };
    loop();
    return () => { cancelled = true; if (timer) clearTimeout(timer); };
  }, [check, intervalMs, enabled]);

  const rows = Object.entries(services);
  const bad = rows.filter(([, v]) => v.state !== "ready");
  const overall = !rows.length ? "checking"
    : bad.some(([, v]) => v.state === "down") ? "down"
    : bad.length ? "notready" : "ready";

  return { services, rows, bad, overall, checkedAt, busy, check };
}

// The one-line summary, in whatever language: "Готово", "Недоступно · 2/9".
export function healthLabel(health, lang) {
  const palette = STATE[health.overall];
  return tr(lang, palette.uk, palette.en)
    + (health.bad.length ? ` · ${health.bad.length}/${health.rows.length}` : "");
}
export function healthColor(overall) { return STATE[overall] || STATE.checking; }

// Everything needed to file a bug, in one clipboard write. Shared, because
// both the panel and the status page offer the same button.
export function copyHealthReport({ rows, bad, checkedAt }) {
  const text = [
    `backend status @ ${new Date(checkedAt || Date.now()).toISOString()}`,
    `${rows.length - bad.length}/${rows.length} ready`,
    ...rows.map(([n, v]) => `${n}\t${v.state}\t${v.base}\t${v.ms}ms\t${v.detail || ""}`),
  ].join("\n");
  try { navigator.clipboard.writeText(text); } catch { /* clipboard unavailable */ }
}

// The slowest service that is actually serving — the useful half of a latency
// readout, since a down service has no meaningful round-trip time.
export function slowestReady(rows) {
  return rows.filter(([, v]) => v.state === "ready").sort((a, b) => b[1].ms - a[1].ms)[0];
}

// One row of the service list. Shared so the drop-up panel and the public
// status page can never drift apart on what "not ready" means.
export function HealthRow({ name, v, lang = "en" }) {
  const L = (uk, en) => tr(lang, uk, en);
  return (
    <li className={"health-row s-" + v.state}>
      <span className="health-dot" style={{ background: STATE[v.state].dot }} />
      <span className="health-name">{name}</span>
      {/* Order matters: the grid is dot | name | role | state. */}
      <span className="health-role">{ROLE_OF[name] ? L(ROLE_OF[name].uk, ROLE_OF[name].en) : ""}</span>
      <span className="health-state" style={{ color: STATE[v.state].fg }}>
        {L(STATE[v.state].uk, STATE[v.state].en)}
      </span>
      <span className="health-meta">
        {v.base}
        {v.state === "ready" && ` · ${v.ms} ms`}
      </span>
      {v.state !== "ready" && (
        <span className="health-detail">
          {v.state === "down" ? (
            <>
              {L("Браузер не отримав відповіді. Сервіс не запущено, або він не надсилає заголовки CORS — з боку клієнта це не розрізнити.",
                 "The browser got no response. Either the service is not running, or it sends no CORS headers — the client cannot tell these apart.")}
              <span className="health-hint">{L("Перевірте: ", "Check: ")}<code>curl {v.base}{v.path || DEFAULT_READY_PATH}</code></span>
            </>
          ) : (
            <>
              {L("Сервіс відповідає, але не готовий обслуговувати запити.", "The service answers but is not ready to serve.")}
              {v.detail && <span className="health-hint"><code>{v.detail}</code></span>}
            </>
          )}
        </span>
      )}
    </li>
  );
}


// ── the panel ──────────────────────────────────────────────────────────
// Portalled to <body>: the sidebar's account menu, which opens it, clips
// overflow. `style` positions it; without one it centres itself near the
// bottom-left, which is where its trigger lives.
export function HealthPanel({ health, lang = "en", style, panelRef, onClose }) {
  const { rows, bad, checkedAt, busy, check } = health;
  const L = (uk, en) => tr(lang, uk, en);
  const readyCount = rows.length - bad.length;
  const slowest = slowestReady(rows);
  const copyReport = () => copyHealthReport(health);

  return createPortal(
    <div
      className="health-panel"
      role="dialog"
      aria-label={L("Стан сервісів", "Service status")}
      ref={panelRef}
      style={style || { left: 16, bottom: 16 }}
    >
      <div className="health-panel-h">
        <div>
          <strong>{L("Стан сервісів", "Service status")}</strong>
          <div className="health-panel-sub">
            {L(`${readyCount} з ${rows.length} готові`, `${readyCount} of ${rows.length} ready`)}
            {slowest && ` · ${L("найповільніший", "slowest")} ${slowest[0]} ${slowest[1].ms} ms`}
          </div>
        </div>
        <button className="btn btn-ghost health-recheck" onClick={check} disabled={busy}>
          <Icon name="refresh" size={12} /> {busy ? L("Перевірка…", "Checking…") : L("Оновити", "Re-check")}
        </button>
        {onClose && (
          <button className="icon-btn sm" onClick={onClose} aria-label={L("Закрити", "Close")}>
            <Icon name="x" size={13} />
          </button>
        )}
      </div>

      {bad.length > 0 && (
        <div className="health-summary">
          <strong>{L("Не готові", "Not ready")}: {bad.map(([k]) => k).join(", ")}</strong>
          <div>
            {L("Постраждалі функції: ", "Affected features: ")}
            {bad.map(([k]) => (ROLE_OF[k] ? L(ROLE_OF[k].uk, ROLE_OF[k].en) : k)).join("; ")}
          </div>
        </div>
      )}

      <ul className="health-list">
        {rows.map(([name, v]) => <HealthRow key={name} name={name} v={v} lang={lang} />)}
      </ul>

      <div className="health-foot">
        <span>
          {checkedAt
            ? L(`Перевірено ${new Date(checkedAt).toLocaleTimeString("uk-UA")}`,
                `Checked at ${new Date(checkedAt).toLocaleTimeString("en-GB")}`)
            : L("Перевірка…", "Checking…")}
          {" · "}
          {L("кожні 30 с", "every 30 s")}
          {/* Per-row, since evidenceChat serves readiness elsewhere. */}
          {" · GET "}{DEFAULT_READY_PATH}
        </span>
        <button className="btn btn-ghost health-copy" onClick={copyReport}>
          <Icon name="copy" size={12} /> {L("Копіювати звіт", "Copy report")}
        </button>
      </div>
    </div>,
    document.body,
  );
}
