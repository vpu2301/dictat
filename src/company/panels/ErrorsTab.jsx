// ErrorsTab.jsx — what is broken, split honestly down the middle.
//
// REAL, and more than you would expect: audit events carry a severity, so
// error/warn counts and the events behind them are measured. Failed and
// cancelled ASR jobs are measured. Unreachable services are measured on this
// page load.
//
// MOCK: incident history, MTTR, uptime and error budget. Nothing in the stack
// persists an incident — Prometheus rules exist but the browser cannot reach
// Prometheus and nothing writes an incident record anywhere. Showing a
// confident 99.98% would be exactly the kind of number that gets quoted in a
// customer call and turns out to be decoration.
import React, { useMemo } from "react";
import { useAsync } from "../../api/useAsync.js";
import { Panel, PanelState } from "../../components/dashboard/Panel.jsx";
import { StatCard } from "../../components/dashboard/StatCard.jsx";
import { StatusBadge } from "../../components/dashboard/StatusBadge.jsx";
import { MiniBarChart } from "../../components/dashboard/MiniBarChart.jsx";
import { StatusBreakdown } from "../../components/dashboard/StatusBreakdown.jsx";
import { Icon } from "../../components/UI.jsx";
import { tr } from "../../i18n.js";
import { Provenance, ProvenanceLegend } from "../provenance.jsx";
import { fetchAuditTelemetry, fetchJobUsage, fetchPlatformHealth, SERVICE_ROLE } from "../../api/company.js";
import { MOCK_INCIDENTS, MOCK_SLO } from "../mockData.js";

export function ErrorsTab({ lang, rangeDays }) {
  const T = (uk, en) => tr(lang, uk, en);
  const isUk = lang === "uk";

  const auditReq = useAsync(() => fetchAuditTelemetry(rangeDays), [rangeDays]);
  const jobsReq = useAsync(() => fetchJobUsage(rangeDays), [rangeDays]);
  const healthReq = useAsync(() => fetchPlatformHealth(), []);

  const errorCount = auditReq.data?.bySeverity?.error || 0;
  const warnCount = auditReq.data?.bySeverity?.warn || 0;
  const failedJobs = jobsReq.data?.byStatus?.failed || 0;
  const totalJobs = jobsReq.data?.total || 0;
  const failureRate = totalJobs ? ((failedJobs / totalJobs) * 100).toFixed(1) : null;
  const downServices = (healthReq.data?.services || []).filter((s) => s.state !== "ready");

  // The events actually behind the error/warn counts — a count without the rows
  // is not actionable.
  const errorEvents = useMemo(() => {
    const rows = auditReq.data?.events || [];
    return rows
      .filter((e) => ["error", "warn"].includes(String(e.severity || "").toLowerCase()))
      .slice(0, 30);
  }, [auditReq.data]);

  const errorsByKind = useMemo(() => {
    const acc = {};
    for (const e of errorEvents) acc[e.kind] = (acc[e.kind] || 0) + 1;
    return Object.entries(acc).sort((a, b) => b[1] - a[1]);
  }, [errorEvents]);

  return (
    <div className="co-stack">
      <ProvenanceLegend lang={lang} />

      {/* ── Live: what is broken right now ───────────────────────────── */}
      <h3 className="co-sectionhead">{T("Зараз", "Right now")}</h3>

      {downServices.length > 0 ? (
        <div className="co-alarm" role="alert">
          <Icon name="alert" size={18} />
          <div>
            <strong>
              {downServices.length} {T("сервіс(и) не обслуговують", "service(s) not serving")}
            </strong>
            <p>
              {downServices.map((s) =>
                `${s.key} (${SERVICE_ROLE[s.key] ? T(SERVICE_ROLE[s.key].uk, SERVICE_ROLE[s.key].en) : s.key}) — ${s.detail}`
              ).join(" · ")}
            </p>
          </div>
        </div>
      ) : healthReq.data ? (
        <div className="co-note co-note-ok">
          <Icon name="check" size={13} />
          <span>
            {T(`Усі ${healthReq.data.total} сервісів обслуговують.`, `All ${healthReq.data.total} services are serving.`)}
            {" "}<Provenance source="live" lang={lang} note="GET /readyz × 9" />
          </span>
        </div>
      ) : null}

      <div className="co-kpis">
        <StatCard label={T("Події рівня error", "Error-severity events")} icon="alert" accent
                  loading={auditReq.loading} error={auditReq.error} value={errorCount}
                  approx={auditReq.data?.capped} sublabel={`${T("за", "over")} ${rangeDays}d`}>
          <Provenance source="live" lang={lang} note="severity=error in /audit/events" />
        </StatCard>
        <StatCard label={T("Події рівня warn", "Warn-severity events")} icon="info"
                  loading={auditReq.loading} error={auditReq.error} value={warnCount}
                  approx={auditReq.data?.capped}>
          <Provenance source="live" lang={lang} note="severity=warn in /audit/events" />
        </StatCard>
        <StatCard label={T("Невдалі завдання ASR", "Failed ASR jobs")} icon="bot"
                  loading={jobsReq.loading} error={jobsReq.error} value={failedJobs}
                  sublabel={failureRate != null
                    ? `${failureRate}% ${T("з", "of")} ${totalJobs}`
                    : T("немає завдань за період", "no jobs in window")}>
          <Provenance source="live" lang={lang} note="GET /asr/jobs" />
        </StatCard>
        <StatCard label={T("Сервіси недоступні", "Services unreachable")} icon="pulse"
                  loading={healthReq.loading} error={healthReq.error}
                  value={healthReq.data ? downServices.length : "—"}
                  sublabel={healthReq.data ? `${healthReq.data.ready}/${healthReq.data.total} ${T("готові", "ready")}` : undefined}>
          <Provenance source="live" lang={lang} note="GET /readyz × 9" />
        </StatCard>
      </div>

      <div className="co-2col">
        <Panel title={T("Помилки за видом", "Errors by kind")} icon="list">
          {(auditReq.loading || auditReq.error) ? (
            <PanelState loading={auditReq.loading} error={auditReq.error} onRetry={auditReq.reload} lang={lang} />
          ) : !errorsByKind.length ? (
            <div className="co-empty">
              {T("Жодної події error чи warn за період.", "No error or warn events in this window.")}
            </div>
          ) : (
            <div className="co-kindrow">
              {errorsByKind.map(([kind, n]) => (
                <span className="co-kindchip" key={kind}><code>{kind}</code><b>{n}</b></span>
              ))}
            </div>
          )}
        </Panel>

        <Panel title={T("Завдання ASR за статусом", "ASR jobs by status")} icon="bot">
          {(jobsReq.loading || jobsReq.error) ? (
            <PanelState loading={jobsReq.loading} error={jobsReq.error} onRetry={jobsReq.reload} lang={lang} />
          ) : (
            <StatusBreakdown
              total={jobsReq.data.total}
              segments={Object.entries(jobsReq.data.byStatus).map(([k, v]) => ({
                key: k, label: k, count: v,
                color: { complete: "#10b981", failed: "#ef4444", running: "#f59e0b",
                         queued: "#94a3b8", cancelled: "#6b7280" }[k] || "#94a3b8",
              }))}
            />
          )}
        </Panel>
      </div>

      <Panel title={T("Останні події error / warn", "Recent error / warn events")} icon="history">
        {(auditReq.loading || auditReq.error) ? (
          <PanelState loading={auditReq.loading} error={auditReq.error} lang={lang} />
        ) : !errorEvents.length ? (
          <div className="co-empty">{T("Порожньо — і це добре.", "Empty, which is the good outcome.")}</div>
        ) : (
          <div className="co-tablewrap">
            <table className="co-table co-table-dense">
              <thead>
                <tr>
                  <th>seq</th><th>{T("Час", "Time")}</th><th>{T("Подія", "Event")}</th>
                  <th>{T("Актор", "Actor")}</th><th>{T("Рівень", "Severity")}</th>
                </tr>
              </thead>
              <tbody>
                {errorEvents.map((e, i) => (
                  <tr key={e.seq ?? i}>
                    <td className="co-cell-sub">{e.seq ?? "—"}</td>
                    <td className="co-cell-sub">{fmt(e.created_at || e.at || e.ts)}</td>
                    <td><code>{e.kind}</code></td>
                    <td className="co-cell-sub"><code>{e.actor_sub ? String(e.actor_sub).slice(0, 8) : "system"}</code></td>
                    <td>
                      <StatusBadge tone={String(e.severity).toLowerCase() === "error" ? "danger" : "warn"}
                                   label={String(e.severity)} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      {/* ── Mock: everything that needs a system we do not run ────────── */}
      <h3 className="co-sectionhead">{T("Надійність — заповнювачі", "Reliability — placeholders")}</h3>
      <div className="co-note co-note-mock">
        <Icon name="alert" size={14} />
        <span>
          <strong>{T("Нижче — не виміряно.", "Below is not measured.")}</strong>{" "}
          {T("Нічого в стеку не зберігає інцидент, а Prometheus недосяжний із браузера. Впевнені 99,98% тут були б саме тим числом, яке потім цитують клієнту.",
             "Nothing in the stack persists an incident, and Prometheus is unreachable from the browser. A confident 99.98% here would be exactly the number that later gets quoted to a customer.")}
        </span>
      </div>

      <div className="co-kpis">
        <StatCard label={T("Доступність", "Uptime")} icon="pulse" value={`${MOCK_SLO.uptimePct}%`}
                  sublabel={`${T("ціль", "target")} ${MOCK_SLO.targetPct}%`}>
          <Provenance source="mock" lang={lang} note={MOCK_SLO.need} />
        </StatCard>
        <StatCard label={T("Бюджет помилок використано", "Error budget used")} icon="activity"
                  value={`${MOCK_SLO.errorBudgetUsedPct}%`}>
          <Provenance source="mock" lang={lang} note={MOCK_SLO.need} />
        </StatCard>
        <StatCard label={T("Латентність p95", "p95 latency")} icon="clock" value={`${MOCK_SLO.p95LatencyMs} ms`}>
          <Provenance source="mock" lang={lang} note={MOCK_SLO.need} />
        </StatCard>
        <StatCard label={T("MTTR", "MTTR")} icon="refresh" value={`${MOCK_INCIDENTS.mttrMinutes} ${T("хв", "min")}`}
                  sublabel={`${MOCK_INCIDENTS.incidentsThisQuarter} ${T("інциденти за квартал", "incidents this quarter")}`}>
          <Provenance source="mock" lang={lang} note={MOCK_INCIDENTS.need} />
        </StatCard>
      </div>

      <Panel title={T("Історія інцидентів", "Incident history")} icon="history"
             gapNote={isUk ? MOCK_INCIDENTS.needUk : MOCK_INCIDENTS.need}>
        <div className="co-tablewrap">
          <table className="co-table">
            <thead>
              <tr>
                <th>ID</th><th>{T("Інцидент", "Incident")}</th><th>{T("Сервіс", "Service")}</th>
                <th>{T("Рівень", "Severity")}</th><th>{T("Тривалість", "Duration")}</th><th>{T("Коли", "When")}</th>
              </tr>
            </thead>
            <tbody>
              {MOCK_INCIDENTS.rows.map((r) => (
                <tr key={r.id}>
                  <td className="co-cell-sub"><code>{r.id}</code></td>
                  <td className="co-cell-title">{r.title}</td>
                  <td className="co-cell-sub">{r.service}</td>
                  <td><StatusBadge tone={r.severity === "major" ? "danger" : "warn"} label={r.severity} /></td>
                  <td className="co-cell-sub">{r.durationMin} {T("хв", "min")}</td>
                  <td className="co-cell-sub">{Math.round(r.startedAgoH / 24)} {T("д тому", "d ago")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="co-axis">
          <span><Provenance source="mock" lang={lang} note={MOCK_INCIDENTS.need} /></span>
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
