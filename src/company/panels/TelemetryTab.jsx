// TelemetryTab.jsx — everything the browser can genuinely measure or read about
// the running platform:
//
//   1. Live readiness + round-trip latency for all nine services (/readyz, /healthz)
//   2. The hash-chained audit stream (/audit/events) — the richest real telemetry
//      the SPA can reach: every login, invite, role change, tenant switch, sign,
//      break-glass grant and quota trip, with actor, severity and sequence.
//   3. Audit chain verification (/audit/verify) — tamper-evidence, on demand.
//
// Prometheus/Grafana/Loki/OTel are configured under infra/ but are not
// browser-reachable (no CORS, no auth bridge) — that is a listed gap, not a
// silently missing chart.
import React, { useMemo, useState } from "react";
import { useAsync } from "../../api/useAsync.js";
import { Panel, PanelState } from "../../components/dashboard/Panel.jsx";
import { StatusBadge } from "../../components/dashboard/StatusBadge.jsx";
import { MiniBarChart } from "../../components/dashboard/MiniBarChart.jsx";
import { StatusBreakdown } from "../../components/dashboard/StatusBreakdown.jsx";
import { Icon } from "../../components/UI.jsx";
import { tr } from "../../i18n.js";
import { verifyAuditChain } from "../../api/endpoints.js";
import { fetchPlatformHealth, fetchAuditTelemetry, SERVICE_ROLE } from "../../api/company.js";

const SEV_COLORS = { info: "#3b82f6", sec: "#8b5cf6", warn: "#f59e0b", error: "#ef4444" };

export function TelemetryTab({ lang, rangeDays, navigate }) {
  const T = (uk, en) => tr(lang, uk, en);
  const healthReq = useAsync(() => fetchPlatformHealth(), []);
  const auditReq = useAsync(() => fetchAuditTelemetry(rangeDays), [rangeDays]);
  const [severityFilter, setSeverityFilter] = useState("");

  const sevSegments = auditReq.data
    ? Object.entries(auditReq.data.bySeverity).map(([k, v]) => ({
        key: k, label: k, count: v, color: SEV_COLORS[k] || "#94a3b8",
      }))
    : [];

  const topActors = useMemo(() => {
    if (!auditReq.data) return [];
    return Object.entries(auditReq.data.byActor)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8);
  }, [auditReq.data]);

  const recent = useMemo(() => {
    const rows = auditReq.data?.events || [];
    const filtered = severityFilter
      ? rows.filter((e) => String(e.severity || "info").toLowerCase() === severityFilter)
      : rows;
    return filtered.slice(0, 40);
  }, [auditReq.data, severityFilter]);

  return (
    <div className="co-stack">
      {/* ── Service matrix ────────────────────────────────────────────── */}
      <Panel
        title={T("Матриця сервісів", "Service matrix")}
        icon="pulse"
        sub={healthReq.data ? `${healthReq.data.ready}/${healthReq.data.total} ${T("готові", "ready")}` : undefined}
      >
        {(healthReq.loading || healthReq.error) ? (
          <PanelState loading={healthReq.loading} error={healthReq.error}
                      onRetry={healthReq.reload} lang={lang} />
        ) : (
          <>
            <div className="co-tablewrap">
              <table className="co-table">
                <thead>
                  <tr>
                    <th>{T("Сервіс", "Service")}</th>
                    <th>{T("Відповідає за", "Powers")}</th>
                    <th>{T("Стан", "State")}</th>
                    <th>{T("Відгук", "RTT")}</th>
                    <th>{T("Версія", "Version")}</th>
                    <th>{T("Адреса", "Base")}</th>
                  </tr>
                </thead>
                <tbody>
                  {healthReq.data.services.map((s) => (
                    <tr key={s.key} className={"co-row s-" + s.state}>
                      <td className="co-cell-title">{s.key}</td>
                      <td className="co-cell-sub">
                        {SERVICE_ROLE[s.key] ? T(SERVICE_ROLE[s.key].uk, SERVICE_ROLE[s.key].en) : "—"}
                      </td>
                      <td>
                        <StatusBadge
                          tone={s.state === "ready" ? "ok" : s.state === "notready" ? "warn" : "danger"}
                          label={s.state === "ready" ? T("готовий", "ready")
                            : s.state === "notready" ? T("запуск", "starting")
                            : T("недоступний", "down")}
                        />
                      </td>
                      <td>{s.state === "down" ? "—" : `${s.ms} ms`}</td>
                      <td className="co-cell-sub">{s.version || "—"}</td>
                      <td className="co-cell-sub"><code>{s.base}</code></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {healthReq.data.services.some((s) => s.state !== "ready") && (
              <div className="co-detail-note">
                <Icon name="info" size={13} />
                {T("Браузер не розрізняє «сервіс не запущено» і «відповідь заблокована CORS» — обидва виглядають як недоступний.",
                   "The browser cannot distinguish \"service not running\" from \"response blocked by CORS\" — both surface as down.")}
                {" "}
                {healthReq.data.services.filter((s) => s.state !== "ready")
                  .map((s) => `${s.key}: ${s.detail}`).join(" · ")}
              </div>
            )}
            <div className="co-axis">
              <span>{T("Перевірено", "Checked")} {new Date(healthReq.data.checkedAt).toLocaleTimeString()}</span>
              <span><code>GET /readyz</code> · <code>GET /healthz</code></span>
            </div>
          </>
        )}
      </Panel>

      {/* ── Audit telemetry ───────────────────────────────────────────── */}
      <div className="co-2col">
        <Panel title={T("Події за днями", "Events by day")} icon="history"
               sub={auditReq.data?.capped
                 ? T(`обмежено ${auditReq.data.cap}`, `capped at ${auditReq.data.cap}`)
                 : undefined}>
          {(auditReq.loading || auditReq.error) ? (
            <PanelState loading={auditReq.loading} error={auditReq.error}
                        onRetry={auditReq.reload} lang={lang} />
          ) : (
            <>
              <MiniBarChart data={auditReq.data.series} height={80}
                            formatLabel={(b) => `${b.key}: ${b.value}`} />
              <div className="co-axis">
                <span>{auditReq.data.series[0]?.key}</span>
                <span>{auditReq.data.series[auditReq.data.series.length - 1]?.key}</span>
              </div>
              <div className="co-inline-facts">
                <span>{T("Послідовність", "Sequence")}: {auditReq.data.minSeq ?? "—"} → {auditReq.data.maxSeq ?? "—"}</span>
                <span>{T("Усього", "Total")}: <b>{auditReq.data.total}</b></span>
              </div>
            </>
          )}
        </Panel>

        <Panel title={T("Серйозність", "Severity")} icon="shield">
          {(auditReq.loading || auditReq.error) ? (
            <PanelState loading={auditReq.loading} error={auditReq.error}
                        onRetry={auditReq.reload} lang={lang} />
          ) : (
            <>
              <StatusBreakdown segments={sevSegments} total={auditReq.data.total} />
              <ChainVerify lang={lang} auditReq={auditReq} />
            </>
          )}
        </Panel>
      </div>

      {/* ── Kinds + actors ────────────────────────────────────────────── */}
      <div className="co-2col">
        <Panel title={T("Види подій", "Event kinds")} icon="list">
          {(auditReq.loading || auditReq.error) ? (
            <PanelState loading={auditReq.loading} error={auditReq.error} lang={lang} />
          ) : !auditReq.data.topKinds.length ? (
            <div className="co-empty">{T("Немає подій.", "No events.")}</div>
          ) : (
            <div className="co-kindrow">
              {auditReq.data.topKinds.map(([kind, n]) => (
                <span className="co-kindchip" key={kind}><code>{kind}</code><b>{n}</b></span>
              ))}
            </div>
          )}
        </Panel>

        <Panel title={T("Найактивніші актори", "Most active actors")} icon="users"
               gapNote={T("Актор — це sub; імена не приєднуються сервером аудиту.",
                          "The actor is a sub; the audit service does not join names.")}>
          {(auditReq.loading || auditReq.error) ? (
            <PanelState loading={auditReq.loading} error={auditReq.error} lang={lang} />
          ) : !topActors.length ? (
            <div className="co-empty">{T("Немає подій.", "No events.")}</div>
          ) : (
            <ul className="co-actors">
              {topActors.map(([sub, n]) => (
                <li key={sub}>
                  <code>{sub === "system" ? "system" : String(sub).slice(0, 8)}</code>
                  <span className="co-actor-bar">
                    <span style={{ width: `${(n / topActors[0][1]) * 100}%` }} />
                  </span>
                  <b>{n}</b>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>

      {/* ── Raw stream ────────────────────────────────────────────────── */}
      <Panel title={T("Потік подій", "Event stream")} icon="activity"
             sub={severityFilter ? `${T("фільтр", "filter")}: ${severityFilter}` : undefined}>
        {(auditReq.loading || auditReq.error) ? (
          <PanelState loading={auditReq.loading} error={auditReq.error}
                      onRetry={auditReq.reload} lang={lang} />
        ) : (
          <>
            <div className="co-toolbar">
              <div className="co-segmented" role="tablist">
                <button className={!severityFilter ? "on" : ""} onClick={() => setSeverityFilter("")}>
                  {T("усі", "all")}
                </button>
                {Object.keys(auditReq.data.bySeverity).map((s) => (
                  <button key={s} className={severityFilter === s ? "on" : ""}
                          onClick={() => setSeverityFilter(s)}>
                    {s} <b>{auditReq.data.bySeverity[s]}</b>
                  </button>
                ))}
              </div>
              <button className="co-link" onClick={() => navigate("/audit/events")}>
                {T("Повний журнал аудиту", "Full audit log")} <Icon name="chevRight" size={12} />
              </button>
            </div>

            {!recent.length ? (
              <div className="co-empty">{T("Немає подій за цим фільтром.", "No events match this filter.")}</div>
            ) : (
              <div className="co-tablewrap">
                <table className="co-table co-table-dense">
                  <thead>
                    <tr>
                      <th>seq</th>
                      <th>{T("Час", "Time")}</th>
                      <th>{T("Вид", "Kind")}</th>
                      <th>{T("Актор", "Actor")}</th>
                      <th>{T("Ціль", "Target")}</th>
                      <th>{T("Серйозність", "Severity")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recent.map((e, i) => (
                      <tr key={e.seq ?? i}>
                        <td className="co-cell-sub">{e.seq ?? "—"}</td>
                        <td className="co-cell-sub">{fmtTime(e.created_at || e.at || e.ts)}</td>
                        <td><code>{e.kind}</code></td>
                        <td className="co-cell-sub">
                          <code>{e.actor_sub ? String(e.actor_sub).slice(0, 8) : "system"}</code>
                          {e.actor_role ? ` · ${e.actor_role}` : ""}
                        </td>
                        <td className="co-cell-sub">
                          {e.target_kind ? `${e.target_kind}${e.target_id ? ` ${String(e.target_id).slice(0, 8)}` : ""}` : "—"}
                        </td>
                        <td><StatusBadge tone={sevTone(e.severity)} label={String(e.severity || "info")} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </Panel>

      <div className="co-note">
        <Icon name="info" size={13} />
        <span>
          {T("Ряди латентності з Prometheus, логи з Loki й трейси Jaeger недосяжні для ЗАПИТІВ із браузера — немає CORS і мосту автентифікації. Але їхні інтерфейси відкриті: посилання на кожен — у розділі «Інфраструктура».",
             "Prometheus latency series, Loki logs and Jaeger traces are unreachable for QUERYING from the browser — no CORS, no auth bridge. Their UIs are open, though: every one is linked from Infrastructure.")}
          {" "}
          <button className="co-link" onClick={() => navigate("/company/infrastructure")}>
            {T("Відкрити інфраструктуру", "Open Infrastructure")} <Icon name="chevRight" size={12} />
          </button>
        </span>
      </div>
    </div>
  );
}

// Chain verification is a write-shaped read: it asks the server to re-walk the
// hash chain. Kept behind an explicit button so a page load never triggers it.
function ChainVerify({ lang, auditReq }) {
  const T = (uk, en) => tr(lang, uk, en);
  const [state, setState] = useState({ status: "idle" });

  const run = async () => {
    setState({ status: "running" });
    try {
      const from = auditReq.data?.minSeq || 1;
      const r = await verifyAuditChain({ from_seq: from });
      const ok = r?.ok ?? r?.valid ?? r?.verified;
      setState({ status: "done", ok: ok !== false, result: r });
    } catch (e) {
      setState({ status: "error", error: e });
    }
  };

  return (
    <div className="co-chainverify">
      <div>
        <strong>{T("Цілісність ланцюга аудиту", "Audit chain integrity")}</strong>
        <p className="co-cell-sub">
          {T("Сервер повторно проходить хеш-ланцюг і повідомляє про будь-який розрив.",
             "The server re-walks the hash chain and reports any break.")}
        </p>
      </div>
      <div className="co-chainverify-r">
        {state.status === "done" && (
          <StatusBadge tone={state.ok ? "ok" : "danger"}
                       label={state.ok ? T("цілий", "intact") : T("розрив!", "broken!")} />
        )}
        {state.status === "error" && (
          <StatusBadge tone="danger" label={state.error?.message || T("помилка", "failed")} />
        )}
        <button className="btn btn-ghost" onClick={run} disabled={state.status === "running"}>
          <Icon name="shield" size={13} />
          {state.status === "running" ? T("Перевірка…", "Verifying…") : T("Перевірити", "Verify")}
        </button>
      </div>
    </div>
  );
}

function sevTone(s) {
  const v = String(s || "info").toLowerCase();
  if (v === "error") return "danger";
  if (v === "warn") return "warn";
  if (v === "sec") return "info";
  return "muted";
}

function fmtTime(v) {
  if (!v) return "—";
  const d = new Date(v);
  return isNaN(d) ? "—" : d.toLocaleString();
}
