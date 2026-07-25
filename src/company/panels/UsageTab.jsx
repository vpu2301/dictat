// UsageTab.jsx — what the platform is actually being used for.
//
// Scope: the ACTIVE tenant. Dictation sessions, ASR jobs, reports and the seat
// roster are all RLS-scoped to the tid in the JWT, so this is a per-tenant view
// wearing a platform header. The banner says so; the Gaps tab says what would
// make it portfolio-wide.
import React, { useMemo } from "react";
import { useAsync } from "../../api/useAsync.js";
import { Panel, PanelState } from "../../components/dashboard/Panel.jsx";
import { StatCard } from "../../components/dashboard/StatCard.jsx";
import { MiniBarChart } from "../../components/dashboard/MiniBarChart.jsx";
import { Sparkline } from "../../components/dashboard/Sparkline.jsx";
import { StatusBreakdown } from "../../components/dashboard/StatusBreakdown.jsx";
import { Icon } from "../../components/UI.jsx";
import { tr } from "../../i18n.js";
import {
  fetchSessionUsage,
  fetchJobUsage,
  fetchReportStats,
  fetchAllUsers,
  seatSummary,
} from "../../api/company.js";

const REPORT_COLORS = {
  draft: "#94a3b8",
  finalized: "#3b82f6",
  signed: "#10b981",
  amended: "#f59e0b",
  cancelled: "#ef4444",
};

const JOB_COLORS = {
  queued: "#94a3b8",
  running: "#f59e0b",
  complete: "#10b981",
  failed: "#ef4444",
  cancelled: "#6b7280",
};

export function UsageTab({ lang, rangeDays, navigate }) {
  const T = (uk, en) => tr(lang, uk, en);

  const sessionsReq = useAsync(() => fetchSessionUsage(rangeDays), [rangeDays]);
  const jobsReq = useAsync(() => fetchJobUsage(rangeDays), [rangeDays]);
  const reportsReq = useAsync(() => fetchReportStats(rangeDays), [rangeDays]);
  const usersReq = useAsync(() => fetchAllUsers(), []);

  const seats = useMemo(
    () => (usersReq.data ? seatSummary(usersReq.data.users) : null),
    [usersReq.data],
  );

  // Minutes per clinical seat — the single number that says whether the product
  // is landing. Real on both sides: audio ms from finalized sessions, seats from
  // the user roster.
  const clinicalSeats = seats ? (seats.byRole.clinician || 0) + (seats.byRole.nurse || 0) : 0;
  const minutesPerSeat = (sessionsReq.data && clinicalSeats)
    ? Math.round(sessionsReq.data.minutes / clinicalSeats)
    : null;

  const jobSegments = jobsReq.data
    ? Object.entries(jobsReq.data.byStatus).map(([k, v]) => ({
        key: k, label: k, count: v, color: JOB_COLORS[k] || "#94a3b8",
      }))
    : [];

  const reportSegments = reportsReq.data
    ? Object.entries(reportsReq.data.counts).map(([k, v]) => ({
        key: k, label: k, count: v, color: REPORT_COLORS[k] || "#94a3b8",
      }))
    : [];

  return (
    <div className="co-stack">
      <div className="co-note">
        <Icon name="info" size={13} />
        {T("Ці цифри стосуються активного тенанта — глибокі дані обмежені RLS до tid у токені.",
           "These figures are for the active tenant — deep data is RLS-scoped to the tid in your token.")}
      </div>

      <div className="co-kpis">
        <StatCard
          label={T("Хвилин диктування", "Dictation minutes")}
          icon="mic" accent
          loading={sessionsReq.loading} error={sessionsReq.error}
          value={sessionsReq.data ? sessionsReq.data.minutes.toLocaleString() : "—"}
          approx={sessionsReq.data?.capped}
          sublabel={sessionsReq.data
            ? `${sessionsReq.data.sessions} ${T("завершених сесій", "finalized sessions")} · ${rangeDays}d`
            : undefined}
        >
          {sessionsReq.data && <Sparkline data={sessionsReq.data.series} width={150} height={30} />}
        </StatCard>

        <StatCard
          label={T("Завдань ASR", "ASR jobs")}
          icon="bot"
          loading={jobsReq.loading} error={jobsReq.error}
          value={jobsReq.data ? jobsReq.data.total.toLocaleString() : "—"}
          approx={jobsReq.data?.capped}
          sublabel={jobsReq.data
            ? `${jobsReq.data.byStatus.complete || 0} ${T("завершено", "complete")} · ${jobsReq.data.byStatus.failed || 0} ${T("невдалих", "failed")}`
            : undefined}
        >
          {jobsReq.data && <Sparkline data={jobsReq.data.series} width={150} height={30} />}
        </StatCard>

        <StatCard
          label={T("Звітів усього", "Reports total")}
          icon="fileText"
          loading={reportsReq.loading} error={reportsReq.error}
          value={reportsReq.data ? reportsReq.data.total.toLocaleString() : "—"}
          sublabel={reportsReq.data
            ? `${reportsReq.data.counts.signed || 0} ${T("підписано", "signed")}`
            : undefined}
        />

        <StatCard
          label={T("Хвилин на клінічне місце", "Minutes per clinical seat")}
          icon="activity"
          loading={sessionsReq.loading || usersReq.loading}
          error={sessionsReq.error || usersReq.error}
          value={minutesPerSeat != null ? minutesPerSeat.toLocaleString() : "—"}
          sublabel={clinicalSeats
            ? `${clinicalSeats} ${T("клінічних місць", "clinical seats")} · ${rangeDays}d`
            : T("немає клінічних місць", "no clinical seats")}
        />
      </div>

      <div className="co-2col">
        <Panel title={T("Диктування за днями", "Dictation by day")} icon="mic"
               sub={sessionsReq.data?.capped ? T("обмежено", "capped") : undefined}>
          {(sessionsReq.loading || sessionsReq.error) ? (
            <PanelState loading={sessionsReq.loading} error={sessionsReq.error}
                        onRetry={sessionsReq.reload} lang={lang} />
          ) : (
            <>
              <MiniBarChart data={sessionsReq.data.series} height={80}
                            formatLabel={(b) => `${b.key}: ${Math.round(b.value)} min`} />
              <div className="co-axis">
                <span>{sessionsReq.data.series[0]?.key}</span>
                <span>{sessionsReq.data.series[sessionsReq.data.series.length - 1]?.key}</span>
              </div>
            </>
          )}
        </Panel>

        <Panel title={T("Завдання ASR за статусом", "ASR jobs by status")} icon="bot">
          {(jobsReq.loading || jobsReq.error) ? (
            <PanelState loading={jobsReq.loading} error={jobsReq.error}
                        onRetry={jobsReq.reload} lang={lang} />
          ) : (
            <StatusBreakdown segments={jobSegments} total={jobsReq.data.total} />
          )}
        </Panel>
      </div>

      <Panel title={T("Звіти за статусом", "Reports by status")} icon="fileText"
             gapNote={reportsReq.data && reportsReq.data.inWindow == null
               ? T("Фільтр за періодом недоступний — пошук звітів фільтрує лише за датою прийому.",
                   "No window filter available — report search only filters by encounter date.")
               : undefined}>
        {(reportsReq.loading || reportsReq.error) ? (
          <PanelState loading={reportsReq.loading} error={reportsReq.error}
                      onRetry={reportsReq.reload} lang={lang} />
        ) : (
          <>
            <StatusBreakdown segments={reportSegments} total={reportsReq.data.total} />
            {reportsReq.data.inWindow != null && (
              <div className="co-inline-facts">
                <span>
                  {T("Прийоми з", "Encounters since")} {reportsReq.data.windowFromDate}:{" "}
                  <b>{reportsReq.data.inWindow}</b>
                </span>
              </div>
            )}
            {reportsReq.data.recentSigned.length > 0 && (
              <>
                <h4 className="co-subhead">{T("Нещодавно підписані", "Recently signed")}</h4>
                <ul className="co-recent">
                  {reportsReq.data.recentSigned.map((r) => (
                    <li key={r.id}>
                      <button className="co-link-inline"
                              onClick={() => navigate(`/dictate/reports/${r.id}`)}>
                        {r.title || r.code || String(r.id).slice(0, 8)}
                      </button>
                      <span className="co-cell-sub">{fmtDateTime(r.updated_at)}</span>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </>
        )}
      </Panel>

      <Panel title={T("Склад місць", "Seat composition")} icon="users"
             sub={usersReq.data?.capped ? T("обмежено", "capped") : undefined}>
        {(usersReq.loading || usersReq.error) ? (
          <PanelState loading={usersReq.loading} error={usersReq.error}
                      onRetry={usersReq.reload} lang={lang} />
        ) : (
          <div className="co-kindrow">
            {Object.entries(seats.byRole).map(([role, n]) => (
              <span className="co-kindchip" key={role}><code>{role}</code><b>{n}</b></span>
            ))}
            <span className="co-kindchip"><code>active</code><b>{seats.active}</b></span>
            <span className="co-kindchip"><code>invited</code><b>{seats.invited}</b></span>
            <span className="co-kindchip"><code>deactivated</code><b>{seats.deactivated}</b></span>
          </div>
        )}
      </Panel>
    </div>
  );
}

function fmtDateTime(v) {
  if (!v) return "—";
  const d = new Date(v);
  return isNaN(d) ? "—" : d.toLocaleString();
}
