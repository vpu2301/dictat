// UsagePanel.jsx — Usage trend over the selected range. Minutes dictated, ASR
// jobs, and an "activity by day" bar chart, aggregated client-side.
// [GAP] no /admin/usage endpoint — bounded + labelled "approximate".
import React from "react";
import { useAsync } from "../../api/useAsync.js";
import { fetchSessionUsage, fetchJobUsage } from "../../api/dashboard.js";
import { Panel, PanelState } from "./Panel.jsx";
import { Sparkline } from "./Sparkline.jsx";
import { MiniBarChart } from "./MiniBarChart.jsx";

export function UsagePanel({ lang, rangeDays }) {
  const T = (uk, en) => (lang === "uk" ? uk : en);
  const sessReq = useAsync(() => fetchSessionUsage(rangeDays), [rangeDays]);
  const jobReq = useAsync(() => fetchJobUsage(rangeDays), [rangeDays]);

  const loading = sessReq.loading || jobReq.loading;
  const error = sessReq.error || jobReq.error;
  const capped = sessReq.data?.capped || jobReq.data?.capped;

  // Day labels for bar hover.
  const fmtDay = (b) => {
    const d = b.date instanceof Date ? b.date : new Date(b.key);
    return `${d.toLocaleDateString(lang === "uk" ? "uk-UA" : "en-US", { month: "short", day: "numeric" })}: ${b.value}`;
  };

  return (
    <Panel title={T("Використання", "Usage")} icon="waveform"
           sub={`${rangeDays}d`}
           gapNote={T(
             "Обчислено на клієнті (приблизно). Потрібен бекенд /admin/usage.",
             "Computed client-side (approximate). Backend /admin/usage needed.",
           )}>
      {(loading || error) ? (
        <PanelState loading={loading} error={error}
                    onRetry={() => { sessReq.reload(); jobReq.reload(); }} lang={lang} />
      ) : (
        <>
          <div className="dash-statrow" style={{ gridTemplateColumns: "1fr 1fr 1fr" }}>
            <UsageStat
              label={T("Хвилин надиктовано", "Minutes dictated")}
              value={sessReq.data.minutes.toLocaleString()}
              sub={`${sessReq.data.sessions} ${T("сесій", "sessions")}`}
              series={sessReq.data.series}
            />
            <UsageStat
              label={T("Завдань ASR", "ASR jobs")}
              value={jobReq.data.total.toLocaleString()}
              sub={`${jobReq.data.byStatus.complete} ${T("готово", "done")} · ${jobReq.data.byStatus.failed} ${T("збій", "failed")}`}
              series={jobReq.data.series}
            />
            <UsageStat
              label={T("Хв./сесію", "Min / session")}
              value={sessReq.data.sessions ? Math.round(sessReq.data.minutes / sessReq.data.sessions) : 0}
              sub={T("середнє", "average")}
            />
          </div>

          <div>
            <div className="stat-card-sub" style={{ marginBottom: 6 }}>
              {T("Активність надиктовування за днями", "Dictation activity by day")}
            </div>
            <MiniBarChart data={sessReq.data.series} formatLabel={fmtDay} />
          </div>

          {capped && (
            <div className="dash-gap-note">
              {T("Показано останні сторінки даних (обмежено).", "Based on the most recent pages (capped).")}
            </div>
          )}
        </>
      )}
    </Panel>
  );
}

function UsageStat({ label, value, sub, series }) {
  return (
    <div className="stat-card" style={{ minHeight: 0 }}>
      <div className="stat-card-h"><span className="stat-card-label">{label}</span></div>
      <div className="stat-card-value">{value}</div>
      <div className="stat-card-sub">{sub}</div>
      {series && series.length > 0 && <Sparkline data={series} width={140} height={28} />}
    </div>
  );
}
