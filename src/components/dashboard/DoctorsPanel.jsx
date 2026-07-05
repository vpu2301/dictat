// DoctorsPanel.jsx — clinicians + nurses with status and report activity.
// Rows link to /admin/users for management. Activity is report-authorship count
// (session summaries carry no user_id, so per-doctor session counts aren't
// derivable client-side — noted as a gap).
import React from "react";
import { useAsync } from "../../api/useAsync.js";
import { fetchDoctors } from "../../api/dashboard.js";
import { Panel, PanelState } from "./Panel.jsx";
import { StatusBadge } from "./StatusBadge.jsx";

export function DoctorsPanel({ lang, navigate }) {
  const T = (uk, en) => (lang === "uk" ? uk : en);
  const req = useAsync(() => fetchDoctors(), []);
  const doctors = req.data?.doctors || [];
  const isEmpty = req.data && doctors.length === 0;

  return (
    <Panel title={T("Лікарі", "Doctors")} icon="users"
           sub={req.data ? `${doctors.length}` : undefined}
           gapNote={T(
             "Активність = авторство звітів (на сесію — потрібен бекенд).",
             "Activity = report authorship (per-session needs backend).",
           )}>
      {(req.loading || req.error || isEmpty) ? (
        <PanelState loading={req.loading} error={req.error} isEmpty={isEmpty}
                    onRetry={req.reload} lang={lang}
                    emptyText={T("Лікарів не знайдено", "No doctors found")} />
      ) : (
        <div className="dash-table-wrap">
          <table className="dash-table">
            <thead>
              <tr>
                <th>{T("Лікар", "Doctor")}</th>
                <th>{T("Роль", "Role")}</th>
                <th>{T("Статус", "Status")}</th>
                <th className="dash-num">{T("Звіти", "Reports")}</th>
              </tr>
            </thead>
            <tbody>
              {doctors.map((d) => (
                <tr key={d.sub} onClick={() => navigate && navigate("/admin/users")}
                    title={T("Керувати в Адмін → Користувачі", "Manage in Admin → Users")}>
                  <td>
                    <div className="dash-doc-name">{d.display_name || "—"}</div>
                    <div className="dash-doc-email">{d.email}</div>
                  </td>
                  <td style={{ textTransform: "capitalize", color: "var(--text-2)" }}>
                    {String(d.role || "").replace("_", " ")}
                  </td>
                  <td><StatusBadge status={d.status} label={d.status} /></td>
                  <td className="dash-num">{d.reports != null ? d.reports : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Panel>
  );
}
