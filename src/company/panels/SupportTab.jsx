// SupportTab.jsx — the support queue. Entirely a placeholder, and it says so
// in the loudest terms available, because this is the tab most likely to be
// mistaken for real: a ticket table looks like data even when it is furniture.
//
// Klarnote has no helpdesk. Not "an unfinished integration" — none at all. The
// rows below are invented down to the subject lines. What IS real, and shown
// beside them, is the audit-derived signal that would seed a real queue: the
// platform already knows when a tenant's ASR jobs fail or its quota trips, and
// those are the tickets that would exist.
import React from "react";
import { useAsync } from "../../api/useAsync.js";
import { Panel } from "../../components/dashboard/Panel.jsx";
import { StatCard } from "../../components/dashboard/StatCard.jsx";
import { StatusBadge } from "../../components/dashboard/StatusBadge.jsx";
import { MiniBarChart } from "../../components/dashboard/MiniBarChart.jsx";
import { StatusBreakdown } from "../../components/dashboard/StatusBreakdown.jsx";
import { Icon } from "../../components/UI.jsx";
import { tr } from "../../i18n.js";
import { Provenance, MockBanner } from "../provenance.jsx";
import { fetchJobUsage, asrQuotaStatus } from "../../api/company.js";
import { MOCK_SUPPORT, MOCK_TICKETS } from "../mockData.js";

const PRIORITY_TONE = { urgent: "danger", high: "warn", normal: "info", low: "muted" };

export function SupportTab({ lang, rangeDays }) {
  const T = (uk, en) => tr(lang, uk, en);
  const isUk = lang === "uk";

  const jobsReq = useAsync(() => fetchJobUsage(rangeDays), [rangeDays]);
  const quotaReq = useAsync(() => asrQuotaStatus(30).catch(() => ({ exceeded: false, unknown: true })), []);

  const failedJobs = jobsReq.data?.byStatus?.failed || 0;

  return (
    <div className="co-stack">
      <MockBanner
        lang={lang}
        what={T("Klarnote не має служби підтримки — не «незавершена інтеграція», а взагалі. Рядки нижче вигадані аж до тем звернень.",
                "Klarnote has no helpdesk — not an unfinished integration, none at all. The rows below are invented down to the subject lines.")}
        need={isUk ? MOCK_TICKETS.needUk : MOCK_TICKETS.need}
      />

      <div className="co-kpis">
        <StatCard label={T("Відкриті звернення", "Open tickets")} icon="inbox" accent
                  value={MOCK_TICKETS.byStatus.open}
                  sublabel={`${MOCK_TICKETS.byStatus.pending} ${T("в очікуванні", "pending")}`}>
          <Provenance source="mock" lang={lang} note={MOCK_TICKETS.need} />
        </StatCard>
        <StatCard label={T("Порушення SLA", "SLA breaches")} icon="clock"
                  value={MOCK_TICKETS.slaBreaches}>
          <Provenance source="mock" lang={lang} note={MOCK_TICKETS.need} />
        </StatCard>
        <StatCard label={T("Медіана першої відповіді", "Median first response")} icon="activity"
                  value={`${MOCK_SUPPORT.medianFirstResponseHours} ${T("год", "h")}`}>
          <Provenance source="mock" lang={lang} note={MOCK_SUPPORT.need} />
        </StatCard>
        <StatCard label="CSAT" icon="heart" value={`${MOCK_SUPPORT.csatPct}%`}>
          <Provenance source="mock" lang={lang} note={MOCK_SUPPORT.need} />
        </StatCard>
      </div>

      <div className="co-2col">
        <Panel title={T("Черга за пріоритетом", "Queue by priority")} icon="filter">
          <StatusBreakdown
            total={Object.values(MOCK_TICKETS.byPriority).reduce((a, b) => a + b, 0)}
            segments={Object.entries(MOCK_TICKETS.byPriority).map(([k, v]) => ({
              key: k, label: k, count: v,
              color: { urgent: "#ef4444", high: "#f59e0b", normal: "#3b82f6", low: "#94a3b8" }[k],
            }))}
          />
          <div className="co-axis">
            <span><Provenance source="mock" lang={lang} note={MOCK_TICKETS.need} /></span>
          </div>
        </Panel>

        <Panel title={T("Беклог за 7 днів", "Backlog over 7 days")} icon="activity">
          <MiniBarChart data={MOCK_TICKETS.backlogTrend} height={78}
                        formatLabel={(b) => `${b.key}: ${b.value}`} />
          <div className="co-axis">
            <span><Provenance source="mock" lang={lang} note={MOCK_TICKETS.need} /></span>
            <span>{MOCK_TICKETS.backlogTrend[MOCK_TICKETS.backlogTrend.length - 1].value} {T("відкритих", "open")}</span>
          </div>
        </Panel>
      </div>

      <Panel title={T("Черга звернень", "Ticket queue")} icon="inbox"
             gapNote={isUk ? MOCK_TICKETS.needUk : MOCK_TICKETS.need}>
        <div className="co-tablewrap">
          <table className="co-table">
            <thead>
              <tr>
                <th>ID</th><th>{T("Тема", "Subject")}</th><th>{T("Клініка", "Clinic")}</th>
                <th>{T("Пріоритет", "Priority")}</th><th>{T("Статус", "Status")}</th><th>{T("Вік", "Age")}</th>
              </tr>
            </thead>
            <tbody>
              {MOCK_TICKETS.rows.map((r) => (
                <tr key={r.id}>
                  <td className="co-cell-sub"><code>{r.id}</code></td>
                  <td className="co-cell-title">{r.subject}</td>
                  <td className="co-cell-sub">{r.tenant}</td>
                  <td><StatusBadge tone={PRIORITY_TONE[r.priority]} label={r.priority} /></td>
                  <td><StatusBadge status={r.status === "open" ? "running" : "pending"} label={r.status} /></td>
                  <td className="co-cell-sub">
                    {r.ageHours < 48 ? `${r.ageHours} ${T("год", "h")}` : `${Math.round(r.ageHours / 24)} ${T("д", "d")}`}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>

      {/* The real half — what a genuine queue would actually be fed by. */}
      <h3 className="co-sectionhead">{T("Справжні сигнали, які живили б чергу", "Real signals a queue would be fed by")}</h3>
      <Panel title={T("Що платформа вже знає", "What the platform already knows")} icon="check"
             gapNote={T("Це виміряно. Служба підтримки не потрібна, щоб це побачити — потрібна, щоб на це відреагувати.",
                        "This is measured. A helpdesk is not needed to see it — it is needed to act on it.")}>
        <div className="co-metricrows">
          <div className="co-metricrow">
            <span className="co-metricrow-l">
              {T("Невдалі завдання ASR за період", "Failed ASR jobs in window")}
              <Provenance source="live" lang={lang} note="GET /asr/jobs" compact />
            </span>
            <span className={"co-metricrow-v" + (failedJobs > 0 ? " bad" : "")}>
              {jobsReq.loading ? "…" : failedJobs}
            </span>
          </div>
          <div className="co-metricrow">
            <span className="co-metricrow-l">
              {T("Місячна квота ASR", "ASR monthly quota")}
              <Provenance source="live" lang={lang} note="asr.quota_exceeded audit event" compact />
            </span>
            <span className="co-metricrow-v">
              {quotaReq.loading ? "…"
                : quotaReq.data?.unknown ? T("невідомо", "unknown")
                : quotaReq.data?.exceeded ? T("перевищено", "exceeded")
                : T("у межах", "within limit")}
            </span>
          </div>
        </div>
        <p className="co-prose" style={{ marginTop: 12 }}>
          {T("Кожне невдале завдання й кожне перевищення квоти — це звернення, яке клініка збирається надіслати. Найдешевша перша версія підтримки: таблиця звернень плюс правило, що створює чернетку з цих подій.",
             "Every failed job and every quota trip is a ticket a clinic is about to raise. The cheapest first version of support: a tickets table plus a rule that drafts one from these events.")}
        </p>
      </Panel>
    </div>
  );
}
