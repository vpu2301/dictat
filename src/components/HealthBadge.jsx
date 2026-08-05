// HealthBadge.jsx — backend readiness indicator in the sidebar footer.
//
// Polls /readyz on every configured service every 30 s and rolls the results
// into one pill. The pill alone is not actionable ("Down" — what is down?), so
// clicking it opens a panel listing every service with its state, port,
// round-trip time and the reason it failed, plus a re-check button.
//
// Backend convention (spec §A sprint 01): /healthz is liveness and returns 200
// always; /readyz returns 200 {status:"ready"} or 503 {status:"not_ready"}.
// signing-service answers {"status":"ok"} — same meaning, different word.
//
// Failure modes we distinguish, because they need different fixes:
//   down    — no HTTP response at all (service stopped, wrong port), OR the
//             browser blocked the response because the service sends no CORS
//             header. JS cannot tell these apart; both surface as "blocked or
//             unreachable" with a hint.
//   notready— the service answered but is not serving yet (503 / other status).
//   ready   — serving.

import React, { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Icon } from "./UI.jsx";
import { SERVICES } from "../api/services.js";
import { tr } from "../i18n.js";

const READY_WORDS = ["ready", "ok", "healthy"];
const PORT_OF = (base) => { try { return new URL(base).port || new URL(base).host; } catch { return base; } };

// What each service actually powers — so a red row says what will break, not
// just which process is unhappy. Keys match SERVICES in api/services.js.
const ROLE_OF = {
  auth:         { uk: "Вхід, користувачі, клініки, аудит", en: "Sign-in, users, clinics, audit" },
  asr:          { uk: "Завдання транскрипції аудіо",      en: "Speech-to-text jobs" },
  dictation:    { uk: "Живе диктування (WebSocket)",      en: "Live dictation (WebSocket)" },
  nlp:          { uk: "Пунктуація та обробка тексту",     en: "Punctuation and text processing" },
  report:       { uk: "Звіти та шаблони",                  en: "Reports and templates" },
  autocomplete: { uk: "Автодоповнення в редакторі",        en: "Editor autocomplete" },
  signing:      { uk: "Підписання документів",             en: "Document signing" },
  core:         { uk: "Пацієнти, прийоми, згоди",          en: "Patients, encounters, consents" },
  notification: { uk: "Сповіщення",                        en: "Notifications" },
};

const STATE = {
  ready:    { dot: "#10b981", fg: "#047857", bg: "rgba(4,120,87,.12)",   uk: "Готово",     en: "Ready" },
  notready: { dot: "#f59e0b", fg: "#b45309", bg: "rgba(180,83,9,.12)",   uk: "Запуск…",    en: "Starting" },
  down:     { dot: "#dc2626", fg: "#dc2626", bg: "rgba(220,38,38,.12)",  uk: "Недоступно", en: "Down" },
  checking: { dot: "#9ca3af", fg: "#6b7480", bg: "rgba(107,116,128,.12)", uk: "Перевірка",  en: "Checking" },
};

// One probe. Returns { state, detail, ms } — never throws.
async function probe(base) {
  const t0 = performance.now();
  try {
    const r = await fetch(`${base}/readyz`, { method: "GET" });
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
      Object.entries(SERVICES).map(async ([name, base]) => [name, { ...(await probe(base)), base }]),
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

export function HealthBadge({ intervalMs = 30000, lang = "en", enabled = true }) {
  const [open, setOpen] = useState(false);
  const [panelPos, setPanelPos] = useState({ left: 0, bottom: 0 });
  const wrapRef = useRef(null);
  const panelRef = useRef(null);
  const health = useServiceHealth({ intervalMs, enabled });
  const { services, rows, bad, overall, checkedAt, busy, check } = health;

  // Anchor the portalled panel to the pill: sit just above it, aligned to the
  // sidebar's left edge, and never spill off the viewport.
  useEffect(() => {
    if (!open) return undefined;
    const place = () => {
      const pill = wrapRef.current?.getBoundingClientRect();
      if (!pill) return;
      setPanelPos({
        left: Math.max(8, pill.left - 10),
        bottom: Math.max(8, window.innerHeight - pill.top + 8),
      });
    };
    place();
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => { window.removeEventListener("resize", place); window.removeEventListener("scroll", place, true); };
  }, [open]);

  useEffect(() => {
    if (!open) return undefined;
    // The panel lives outside wrapRef in the DOM (portal), so it needs its own
    // containment check or clicking inside it would close it.
    const onDoc = (e) => {
      const inWrap = wrapRef.current?.contains(e.target);
      const inPanel = panelRef.current?.contains(e.target);
      if (!inWrap && !inPanel) setOpen(false);
    };
    const onKey = (e) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("mousedown", onDoc); document.removeEventListener("keydown", onKey); };
  }, [open]);

  const palette = STATE[overall];

  const L = (uk, en) => tr(lang, uk, en);
  const label = healthLabel(health, lang);
  const readyCount = rows.length - bad.length;
  const slowest = rows.filter(([, v]) => v.state === "ready").sort((a, b) => b[1].ms - a[1].ms)[0];

  // Everything needed to file a bug, in one clipboard write.
  const copyReport = () => {
    const text = [
      `backend status @ ${new Date(checkedAt || Date.now()).toISOString()}`,
      `${readyCount}/${rows.length} ready`,
      ...rows.map(([n, v]) => `${n}\t${v.state}\t${v.base}\t${v.ms}ms\t${v.detail || ""}`),
    ].join("\n");
    try { navigator.clipboard.writeText(text); } catch { /* clipboard unavailable */ }
  };

  return (
    <div className="health-wrap" ref={wrapRef}>
      <button
        type="button"
        className="health-pill"
        style={{ background: palette.bg, color: palette.fg }}
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="dialog"
        aria-expanded={open}
        title={L("Стан бекенду — натисніть для деталей", "Backend status — click for details")}
      >
        <span className="health-dot" style={{ background: palette.dot }} />
        <span>{label}</span>
      </button>

      {open && (
        <HealthPanel health={health} lang={lang} style={panelPos} panelRef={panelRef} />
      )}
    </div>
  );
}


// ── the panel ──────────────────────────────────────────────────────────
// Portalled to <body>: every place that opens it (the sidebar's account menu,
// the pill in the public footer) sits inside something that clips overflow.
// `style` positions it; without one it centres itself near the bottom-left,
// which is where both of its triggers live.
export function HealthPanel({ health, lang = "en", style, panelRef, onClose }) {
  const { rows, bad, checkedAt, busy, check } = health;
  const L = (uk, en) => tr(lang, uk, en);
  const readyCount = rows.length - bad.length;
  const slowest = rows.filter(([, v]) => v.state === "ready").sort((a, b) => b[1].ms - a[1].ms)[0];

  const copyReport = () => {
    const text = [
      `backend status @ ${new Date(checkedAt || Date.now()).toISOString()}`,
      `${readyCount}/${rows.length} ready`,
      ...rows.map(([n, v]) => `${n}\t${v.state}\t${v.base}\t${v.ms}ms\t${v.detail || ""}`),
    ].join("\n");
    try { navigator.clipboard.writeText(text); } catch { /* clipboard unavailable */ }
  };

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
        {rows.map(([name, v]) => (
          <li key={name} className={"health-row s-" + v.state}>
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
                    <span className="health-hint">{L("Перевірте: ", "Check: ")}<code>curl {v.base}/readyz</code></span>
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
        ))}
      </ul>

      <div className="health-foot">
        <span>
          {checkedAt
            ? L(`Перевірено ${new Date(checkedAt).toLocaleTimeString("uk-UA")}`,
                `Checked at ${new Date(checkedAt).toLocaleTimeString("en-GB")}`)
            : L("Перевірка…", "Checking…")}
          {" · "}
          {L("кожні 30 с", "every 30 s")}
          {" · GET /readyz"}
        </span>
        <button className="btn btn-ghost health-copy" onClick={copyReport}>
          <Icon name="copy" size={12} /> {L("Копіювати звіт", "Copy report")}
        </button>
      </div>
    </div>,
    document.body,
  );
}
