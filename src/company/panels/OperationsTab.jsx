// OperationsTab.jsx — the day-to-day running of the platform.
//
// Four things a production console needs that live nowhere else:
//
//   Jobs & queues     REAL   — ASR job states; the only async work the SPA can see.
//   Privacy queue     REAL   — DSAR + erasure requests awaiting a decision. This
//                              one has a deadline attached to it by law, which is
//                              why it belongs on an operations screen and not
//                              buried in a tenant's admin area.
//   Feature flags     REAL   — the SPA's own build-time config. Not a toggle:
//                              these are Vite env vars baked at build time, so
//                              the panel reports them rather than pretending to
//                              flip them.
//   Releases          MOCK   — no CI/CD API is wired up.
import React, { useMemo } from "react";
import { useAsync } from "../../api/useAsync.js";
import { Panel, PanelState } from "../../components/dashboard/Panel.jsx";
import { StatCard } from "../../components/dashboard/StatCard.jsx";
import { StatusBadge } from "../../components/dashboard/StatusBadge.jsx";
import { StatusBreakdown } from "../../components/dashboard/StatusBreakdown.jsx";
import { Icon } from "../../components/UI.jsx";
import { tr } from "../../i18n.js";
import { Provenance, ProvenanceLegend } from "../provenance.jsx";
import { fetchJobUsage } from "../../api/company.js";
import { listJobs } from "../../api/asr.js";
import { listPrivacyRequests } from "../../api/privacy.js";
import { FEATURES, SERVICES, APP_VERSION } from "../../api/services.js";
import { MOCK_RELEASES } from "../mockData.js";

const JOB_COLORS = {
  queued: "#94a3b8", running: "#f59e0b", complete: "#10b981",
  failed: "#ef4444", cancelled: "#6b7280",
};

const asItems = (r) => (Array.isArray(r) ? r : (r?.items || r?.jobs || []));

export function OperationsTab({ lang, rangeDays, navigate }) {
  const T = (uk, en) => tr(lang, uk, en);
  const isUk = lang === "uk";

  const jobsReq = useAsync(() => fetchJobUsage(rangeDays), [rangeDays]);
  const recentJobsReq = useAsync(() => listJobs({ limit: 15 }), []);
  // The privacy queue is tenant_admin-scoped and may legitimately 403 or 404 on
  // a deployment without core-service; treat that as "unavailable", not an error
  // worth blanking the page for.
  const privacyReq = useAsync(
    () => listPrivacyRequests({}).catch((e) => ({ __unavailable: e })),
    [],
  );

  const inFlight = (jobsReq.data?.byStatus?.queued || 0) + (jobsReq.data?.byStatus?.running || 0);
  const privacyRows = useMemo(() => {
    const d = privacyReq.data;
    if (!d || d.__unavailable) return null;
    return asItems(d);
  }, [privacyReq.data]);
  const pendingPrivacy = privacyRows
    ? privacyRows.filter((r) => ["requested", "review"].includes(String(r.status))).length
    : null;

  const flagRows = Object.entries(FEATURES);
  const flagsOn = flagRows.filter(([, v]) => v).length;

  return (
    <div className="co-stack">
      <ProvenanceLegend lang={lang} />

      <div className="co-kpis">
        <StatCard label={T("Завдання в роботі", "Jobs in flight")} icon="bot" accent
                  loading={jobsReq.loading} error={jobsReq.error} value={inFlight}
                  sublabel={jobsReq.data
                    ? `${jobsReq.data.byStatus.queued || 0} ${T("у черзі", "queued")} · ${jobsReq.data.byStatus.running || 0} ${T("виконуються", "running")}`
                    : undefined}>
          <Provenance source="live" lang={lang} note="GET /asr/jobs" />
        </StatCard>
        <StatCard label={T("Запити приватності", "Privacy requests")} icon="shield"
                  loading={privacyReq.loading}
                  value={pendingPrivacy ?? "—"}
                  sublabel={privacyRows == null
                    ? T("черга недоступна", "queue unavailable")
                    : `${privacyRows.length} ${T("усього", "total")}`}>
          <Provenance source={privacyRows == null ? "mock" : "live"} lang={lang}
                      note={privacyRows == null
                        ? T("core-service недоступний або бракує прав.", "core-service unreachable or permission missing.")
                        : "GET /privacy-requests"} />
        </StatCard>
        <StatCard label={T("Увімкнені прапорці", "Feature flags on")} icon="sliders"
                  value={`${flagsOn}/${flagRows.length}`}
                  sublabel={`SPA v${APP_VERSION}`}>
          <Provenance source="live" lang={lang}
                      note={T("Конфігурація збірки SPA (import.meta.env).", "SPA build config (import.meta.env).")} />
        </StatCard>
        <StatCard label={T("Частота релізів", "Deploy frequency")} icon="refresh"
                  value={`${MOCK_RELEASES.deployFrequencyPerWeek}/${T("тиж", "wk")}`}
                  sublabel={`${MOCK_RELEASES.changeFailurePct}% ${T("невдалих змін", "change failure")}`}>
          <Provenance source="mock" lang={lang} note={MOCK_RELEASES.need} />
        </StatCard>
      </div>

      {/* ── Jobs & queues ────────────────────────────────────────────── */}
      <h3 className="co-sectionhead">{T("Завдання та черги", "Jobs & queues")}</h3>
      <div className="co-2col">
        <Panel title={T("Завдання ASR за статусом", "ASR jobs by status")} icon="bot"
               sub={jobsReq.data?.capped ? T("обмежено", "capped") : undefined}>
          {(jobsReq.loading || jobsReq.error) ? (
            <PanelState loading={jobsReq.loading} error={jobsReq.error} onRetry={jobsReq.reload} lang={lang} />
          ) : (
            <StatusBreakdown
              total={jobsReq.data.total}
              segments={Object.entries(jobsReq.data.byStatus).map(([k, v]) => ({
                key: k, label: k, count: v, color: JOB_COLORS[k] || "#94a3b8",
              }))}
            />
          )}
        </Panel>

        <Panel title={T("Останні завдання", "Recent jobs")} icon="list">
          {(recentJobsReq.loading || recentJobsReq.error) ? (
            <PanelState loading={recentJobsReq.loading} error={recentJobsReq.error}
                        onRetry={recentJobsReq.reload} lang={lang} />
          ) : !asItems(recentJobsReq.data).length ? (
            <div className="co-empty">{T("Черга порожня.", "The queue is empty.")}</div>
          ) : (
            <div className="co-tablewrap">
              <table className="co-table co-table-dense">
                <thead>
                  <tr><th>ID</th><th>{T("Статус", "Status")}</th><th>{T("У черзі з", "Queued")}</th></tr>
                </thead>
                <tbody>
                  {asItems(recentJobsReq.data).slice(0, 10).map((j) => (
                    <tr key={j.id}>
                      <td className="co-cell-sub"><code>{String(j.id).slice(0, 8)}</code></td>
                      <td><StatusBadge status={j.status} /></td>
                      <td className="co-cell-sub">{fmt(j.queued_at || j.created_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Panel>
      </div>

      {/* ── Privacy queue ────────────────────────────────────────────── */}
      <h3 className="co-sectionhead">{T("Черга приватності", "Privacy queue")}</h3>
      <Panel title={T("Запити DSAR і видалення", "DSAR & erasure requests")} icon="shield"
             gapNote={T("Ці запити мають законні строки, тому вони тут, а не поховані в адмінці клініки. Затвердження підпадає під правило двох осіб — сервер відхилить самозатвердження.",
                        "These carry statutory deadlines, which is why they live here rather than buried in a clinic's admin area. Approval is under a two-person rule — the server rejects self-approval.")}>
        {privacyReq.loading ? (
          <PanelState loading lang={lang} />
        ) : privacyRows == null ? (
          <div className="co-admin-locked">
            <Icon name="info" size={14} />
            <div>
              <strong>{T("Черга недоступна", "Queue unavailable")}</strong>
              <p>
                {T("GET /privacy-requests не відповів. Або core-service не запущено, або цей акаунт не має scope patient.dsar у цьому тенанті.",
                   "GET /privacy-requests did not answer. Either core-service is not running, or this account lacks the patient.dsar scope in this tenant.")}
              </p>
            </div>
          </div>
        ) : !privacyRows.length ? (
          <div className="co-empty">
            {T("Немає відкритих запитів — черга порожня.", "No outstanding requests — the queue is clear.")}
          </div>
        ) : (
          <div className="co-tablewrap">
            <table className="co-table">
              <thead>
                <tr>
                  <th>{T("Вид", "Kind")}</th><th>{T("Пацієнт", "Patient")}</th>
                  <th>{T("Статус", "Status")}</th><th>{T("Створено", "Raised")}</th><th />
                </tr>
              </thead>
              <tbody>
                {privacyRows.slice(0, 12).map((r) => (
                  <tr key={r.id}>
                    <td className="co-cell-title">{r.kind}</td>
                    <td className="co-cell-sub"><code>{String(r.patient_id || "—").slice(0, 8)}</code></td>
                    <td><StatusBadge status={r.status} /></td>
                    <td className="co-cell-sub">{fmt(r.created_at)}</td>
                    <td className="co-rowactions">
                      <button className="colog-btn co-btn-sm" onClick={() => navigate("/admin/privacy")}>
                        {T("Відкрити", "Open")}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      {/* ── Feature flags ────────────────────────────────────────────── */}
      <h3 className="co-sectionhead">{T("Прапорці та середовище", "Flags & environment")}</h3>
      <div className="co-2col">
        <Panel title={T("Прапорці функцій", "Feature flags")} icon="sliders"
               gapNote={T("Це змінні збірки Vite, зашиті під час build — не перемикачі. Щоб стали керованими в рантаймі, потрібен ендпоінт конфігурації на боці сервера.",
                          "These are Vite build-time variables baked at build — not toggles. Making them runtime-controllable needs a server-side config endpoint.")}>
          <ul className="co-flaglist">
            {flagRows.map(([k, v]) => (
              <li key={k} className={v ? "on" : ""}>
                <span className="co-flag-dot" />
                <code>{k}</code>
                <StatusBadge tone={v ? "ok" : "muted"} label={v ? T("увімк.", "on") : T("вимк.", "off")} />
              </li>
            ))}
          </ul>
        </Panel>

        <Panel title={T("Середовище", "Environment")} icon="globe">
          <dl className="co-facts">
            <dt>SPA</dt><dd>v{APP_VERSION}</dd>
            {Object.entries(SERVICES).map(([k, v]) => (
              <React.Fragment key={k}>
                <dt>{k}</dt><dd><code>{v}</code></dd>
              </React.Fragment>
            ))}
          </dl>
          <div className="co-axis">
            <span><Provenance source="live" lang={lang}
                              note={T("З api/services.js — реальна конфігурація цієї збірки.",
                                      "From api/services.js — this build's actual config.")} /></span>
          </div>
        </Panel>
      </div>

      {/* ── Releases ─────────────────────────────────────────────────── */}
      <h3 className="co-sectionhead">{T("Релізи", "Releases")}</h3>
      <Panel title={T("Останні релізи", "Recent releases")} icon="history"
             gapNote={isUk ? MOCK_RELEASES.needUk : MOCK_RELEASES.need}>
        <ul className="co-releases">
          {MOCK_RELEASES.rows.map((r) => (
            <li key={r.version}>
              <span className="co-release-v">{r.version}</span>
              <div>
                <strong>{r.note}</strong>
                <p className="co-cell-sub">{r.services} · {r.agoDays} {T("днів тому", "days ago")}</p>
              </div>
            </li>
          ))}
        </ul>
        <div className="co-axis">
          <span><Provenance source="mock" lang={lang} note={MOCK_RELEASES.need} /></span>
        </div>
      </Panel>
    </div>
  );
}

function fmt(v) {
  if (!v) return "—";
  const d = new Date(v);
  return isNaN(d) ? "—" : d.toLocaleString();
}
