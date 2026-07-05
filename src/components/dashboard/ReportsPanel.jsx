// ReportsPanel.jsx — Reports volume + status breakdown + recently signed.
// Counts are exact (search `total=exact`); the window count uses encounter_date.
// [GAP] no /v1/reports/stats aggregate — derived from search.
import React, { useMemo } from "react";
import { useAsync } from "../../api/useAsync.js";
import { fetchReportStats, REPORT_STATUSES } from "../../api/dashboard.js";
import { Panel, PanelState } from "./Panel.jsx";
import { StatusBreakdown } from "./StatusBreakdown.jsx";

const STATUS_COLORS = {
  draft: "#9ca3af",
  finalized: "#0a8a7a",
  signed: "#10b981",
  amended: "#6366f1",
  cancelled: "#dc2626",
};

export function ReportsPanel({ lang, rangeDays, navigate }) {
  const T = (uk, en) => (lang === "uk" ? uk : en);
  const req = useAsync(() => fetchReportStats(rangeDays), [rangeDays]);
  const data = req.data;

  const segments = useMemo(
    () => REPORT_STATUSES.map((s) => ({
      key: s, label: s, count: data?.counts?.[s] || 0, color: STATUS_COLORS[s],
    })),
    [data],
  );
  const isEmpty = data && data.total === 0;

  return (
    <Panel title={T("Звіти", "Reports")} icon="fileText"
           gapNote={T(
             "Похідне з пошуку. Потрібен бекенд /v1/reports/stats.",
             "Derived from search. Backend /v1/reports/stats needed.",
           )}>
      {(req.loading || req.error || isEmpty) ? (
        <PanelState loading={req.loading} error={req.error} isEmpty={isEmpty}
                    onRetry={req.reload} lang={lang}
                    emptyText={T("Звітів ще немає", "No reports yet")} />
      ) : (
        <>
          <div className="dash-statrow" style={{ gridTemplateColumns: "1fr 1fr" }}>
            <div className="stat-card" style={{ minHeight: 0 }}>
              <div className="stat-card-label">{T("Усього звітів", "Reports total")}</div>
              <div className="stat-card-value">{data.total.toLocaleString()}</div>
              <div className="stat-card-sub">{(data.counts.signed || 0)} {T("підписано", "signed")}</div>
            </div>
            <div className="stat-card" style={{ minHeight: 0 }}>
              <div className="stat-card-label">
                {T("За період", "In period")} ({rangeDays}d)
              </div>
              <div className="stat-card-value">
                {data.inWindow != null ? data.inWindow.toLocaleString() : "—"}
              </div>
              <div className="stat-card-sub">{T("за датою візиту", "by encounter date")}</div>
            </div>
          </div>

          <StatusBreakdown segments={segments} total={data.total} />

          {data.recentSigned.length > 0 && (
            <div>
              <div className="stat-card-sub" style={{ marginBottom: 4 }}>
                {T("Нещодавно підписані", "Recently signed")}
              </div>
              <ul className="dash-signed-list">
                {data.recentSigned.map((r) => (
                  <li key={r.id}>
                    <a onClick={() => navigate && navigate(`/dictate/reports/${r.id}`)}>
                      <span className="dash-signed-title">
                        {r.title || r.code || (r.id ? String(r.id).slice(0, 8) + "…" : "—")}
                      </span>
                      <span className="dash-signed-when">{fmtWhen(r.updated_at, lang)}</span>
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}
    </Panel>
  );
}

function fmtWhen(v, lang) {
  if (!v) return "";
  const d = new Date(v);
  if (isNaN(d)) return "";
  return d.toLocaleDateString(lang === "uk" ? "uk-UA" : "en-US", { month: "short", day: "numeric" });
}
