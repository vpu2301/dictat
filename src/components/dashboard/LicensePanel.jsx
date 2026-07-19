// LicensePanel.jsx — Licenses / Seats. Seats-in-use + role breakdown + ASR
// quota status, all derived client-side from /admin/users + audit events.
// [GAP] there is no license/plan/seat-limit resource yet.
import React, { useMemo } from "react";
import { useAsync } from "../../api/useAsync.js";
import { fetchAllUsers, seatSummary, asrQuotaStatus, ROLE_KEYS } from "../../api/dashboard.js";
import { Panel, PanelState } from "./Panel.jsx";
import { StatusBadge } from "./StatusBadge.jsx";
import { tr } from "../../i18n.js";

export function LicensePanel({ lang }) {
  const T = (uk, en) => tr(lang, uk, en);
  const usersReq = useAsync(() => fetchAllUsers(), []);
  const quotaReq = useAsync(() => asrQuotaStatus(30), []);

  const summary = useMemo(
    () => (usersReq.data ? seatSummary(usersReq.data.users) : null),
    [usersReq.data],
  );
  const maxRole = summary ? Math.max(1, ...ROLE_KEYS.map((r) => summary.byRole[r] || 0)) : 1;

  return (
    <Panel title={T("Ліцензії та місця", "Licenses & seats")} icon="users"
           sub={usersReq.data?.capped ? T("обмежено", "capped") : undefined}>
      {(usersReq.loading || usersReq.error) ? (
        <PanelState loading={usersReq.loading} error={usersReq.error}
                    onRetry={usersReq.reload} lang={lang} />
      ) : (
        <>
          <div className="stat-card" style={{ boxShadow: "none", border: 0, padding: 0, minHeight: 0 }}>
            <div className="stat-card-value">
              {summary.active}
              <span className="stat-card-sub" style={{ fontSize: 14, fontWeight: 500 }}>
                / {summary.total} {T("відомих", "known")}
              </span>
            </div>
            <div className="stat-card-sub">
              {T("активних місць", "seats in use")}
              {summary.invited > 0 && ` · ${summary.invited} ${T("запрошено", "invited")}`}
              {summary.deactivated > 0 && ` · ${summary.deactivated} ${T("деактивовано", "deactivated")}`}
            </div>
          </div>

          <div className="dash-rolebars">
            {ROLE_KEYS.map((r) => (
              <div className="dash-rolebar" key={r}>
                <span className="dash-rolebar-name">{r.replace("_", " ")}</span>
                <span className="dash-rolebar-track">
                  <span className="dash-rolebar-fill" style={{ width: `${((summary.byRole[r] || 0) / maxRole) * 100}%` }} />
                </span>
                <span className="dash-rolebar-val">{summary.byRole[r] || 0}</span>
              </div>
            ))}
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <span className="stat-card-sub">{T("Квота ASR:", "ASR quota:")}</span>
            {quotaReq.loading ? (
              <StatusBadge tone="muted" label={T("перевірка…", "checking…")} dot={false} />
            ) : quotaReq.error ? (
              <StatusBadge tone="muted" label={T("невідомо", "unknown")} />
            ) : quotaReq.data?.exceeded ? (
              <StatusBadge tone="danger" label={T("перевищено", "exceeded")} />
            ) : (
              <StatusBadge tone="ok" label={T("у межах", "within limit")} />
            )}
            <span className="dash-gap-note">{T("точні байти — потрібен бекенд", "exact bytes — backend needed")}</span>
          </div>

          <div className="dash-seatlimit">
            {T(
              "Ліміт місць: не налаштовано — потрібен бекенд /admin/licenses.",
              "Seat limit: not configured — backend /admin/licenses needed.",
            )}
          </div>
        </>
      )}
    </Panel>
  );
}
